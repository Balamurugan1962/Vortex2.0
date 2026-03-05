import cv2
import asyncio

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

def _run_model_inference(frame):
    return list(model(frame, stream=True, verbose=False))

async def start_gadget_monitor():
    global is_running
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
        
        for r in results:
            boxes = r.boxes
            for box in boxes:
                cls_id = int(box.cls[0])
                if cls_id in GADGET_CLASSES:
                    conf = float(box.conf[0])
                    if conf > 0.6: # Confidence threshold
                        event_type = GADGET_CLASSES[cls_id]
                        xyxy = box.xyxy[0].tolist()
                        log_violation(event_type, conf, {"bounding_box": xyxy})

        # Process approximately 1 frame per second to save CPU cycles
        await asyncio.sleep(1.0)

def stop_gadget_monitor():
    global is_running
    is_running = False
