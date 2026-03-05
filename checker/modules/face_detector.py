import cv2
import mediapipe as mp
import asyncio
from typing import Optional

from modules.integrity_logger import log_violation
from modules.camera_singleton import CameraSingleton

mp_face_detection = mp.solutions.face_detection
is_running = False

def _process_face_frame(face_detection, image):
    image.flags.writeable = False
    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    return face_detection.process(rgb_image)

async def start_face_monitor():
    global is_running
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
            
            if face_count == 0:
                log_violation("NO_FACE_DETECTED", 1.0)
            elif face_count > 1:
                log_violation("MULTIPLE_FACE_DETECTED", float(best_confidence))

            # Sleep to yield control, run effectively at roughly 2 frames per second
            await asyncio.sleep(0.5)

def stop_face_monitor():
    global is_running
    is_running = False
