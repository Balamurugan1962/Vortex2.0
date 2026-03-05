import cv2
import mediapipe as mp
import asyncio
import time
from typing import Optional

from modules.integrity_logger import log_violation
from modules.camera_singleton import CameraSingleton

mp_face_detection = mp.solutions.face_detection
is_running = False

# Debouncing and state tracking
last_no_face_log = 0
last_multiple_face_log = 0
last_face_count = 1  # Assume 1 face is normal
DEBOUNCE_SECONDS = 5.0  # Only log same violation once per 5 seconds

def _process_face_frame(face_detection, image):
    image.flags.writeable = False
    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    return face_detection.process(rgb_image)

async def start_face_monitor():
    global is_running, last_no_face_log, last_multiple_face_log, last_face_count
    if is_running:
        return
        
    is_running = True
    with mp_face_detection.FaceDetection(model_selection=0, min_detection_confidence=0.5) as face_detection:
        while is_running:
            success, image = CameraSingleton.read_frame()
            if not success:
                await asyncio.sleep(0.1)
                continue

            results = await asyncio.to_thread(_process_face_frame, face_detection, image)

            face_count = 0
            best_confidence = 0.0
            
            if results.detections:
                face_count = len(results.detections)
                best_confidence = max(detection.score[0] for detection in results.detections)
            
            # Only log if status changed from last detection
            current_time = time.time()
            
            if face_count == 0 and last_face_count > 0:
                if current_time - last_no_face_log > DEBOUNCE_SECONDS:
                    log_violation("NO_FACE_DETECTED", 1.0)
                    last_no_face_log = current_time
                    last_face_count = 0
            elif face_count > 1 and last_face_count <= 1:
                if current_time - last_multiple_face_log > DEBOUNCE_SECONDS:
                    log_violation("MULTIPLE_FACE_DETECTED", float(best_confidence))
                    last_multiple_face_log = current_time
                    last_face_count = face_count
            elif 0 < face_count <= 1 and last_face_count != face_count:
                # Face detected when it wasn't before or vice versa
                last_face_count = face_count

            # Sleep to yield control, run effectively at roughly 0.5-1 frame per second
            await asyncio.sleep(1.0)

def stop_face_monitor():
    global is_running
    is_running = False
