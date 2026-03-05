import cv2
import asyncio
import time

from modules.integrity_logger import log_violation
from modules.camera_singleton import CameraSingleton

try:
    from ultralytics import YOLO
    model = YOLO("yolov8n.pt")
except Exception as e:
    print("Warning: Could not load YOLOv8 model.", e)
    model = None

# Simplistic mapping based on COCO classes that Yolov8 uses
GADGET_CLASSES = {
    67: "PHONE_DETECTED",      # Cell phone
    73: "LAPTOP_DETECTED",     # Laptop
    72: "MONITOR_DETECTED",    # TV
    # For actual implementation these ids mapping could be tailored or use a custom trained model.
    # Standard models might not directly map earbuds or microphones, but this covers the mock flow based on the requirement.
}

is_running = False
last_gadget_log = {}  # Track last log time for each gadget type
GADGET_DEBOUNCE_SECONDS = 8.0  # Only log same gadget once per 8 seconds

def _run_model_inference(frame):
    return list(model(frame, stream=True, verbose=False))

async def start_gadget_monitor():
    global is_running, last_gadget_log
    if not model:
        print("YOLO model not loaded, skipping gadget detection.")
        return
        
    is_running = True
    while is_running:
        success, frame = CameraSingleton.read_frame()
        if not success:
            await asyncio.sleep(0.1)
            continue
        
        results = await asyncio.to_thread(_run_model_inference, frame)
        current_time = time.time()
        
        for r in results:
            boxes = r.boxes
            for box in boxes:
                cls_id = int(box.cls[0])
                if cls_id in GADGET_CLASSES:
                    conf = float(box.conf[0])
                    if conf > 0.6: # Confidence threshold
                        event_type = GADGET_CLASSES[cls_id]
                        
                        # Debounce: only log if enough time has passed since last log
                        last_log_time = last_gadget_log.get(event_type, 0)
                        if current_time - last_log_time > GADGET_DEBOUNCE_SECONDS:
                            xyxy = box.xyxy[0].tolist()
                            log_violation(event_type, conf, {"bounding_box": xyxy})
                            last_gadget_log[event_type] = current_time

        # Process approximately 1 frame per second to save CPU cycles
        await asyncio.sleep(1.0)

def stop_gadget_monitor():
    global is_running
    is_running = False
