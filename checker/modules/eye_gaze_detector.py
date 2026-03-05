import cv2
import mediapipe as mp
import asyncio
import time
import numpy as np

from modules.integrity_logger import log_violation
from modules.camera_singleton import CameraSingleton

mp_face_mesh = mp.solutions.face_mesh
is_running = False

# Eye gaze tracking
gaze_start_time = None
last_gaze_warning = 0
GAZE_AWAY_THRESHOLD = 3.0  # Warn if looking away for 3 seconds
GAZE_WARNING_COOLDOWN = 10.0  # Don't spam warnings more than every 10 seconds

# Phone detection under laptop
last_phone_detection = 0
PHONE_DETECTION_COOLDOWN = 8.0  # Check phone detection once per 8 seconds

def calculate_iris_position(face_landmarks, frame_shape):
    """Calculate where the person is looking (iris position)."""
    h, w = frame_shape[:2]
    
    # Get iris/pupil landmarks (MediaPipe face mesh has iris landmarks)
    # Landmarks 468-472 are right iris, 473-477 are left iris
    right_iris = None
    left_iris = None
    
    if len(face_landmarks) > 472:
        right_iris = face_landmarks[468]  # Right iris center
        left_iris = face_landmarks[473]   # Left iris center
    
    # Fallback to eye landmarks if iris not available
    if right_iris is None or left_iris is None:
        # Use eye corners as fallback
        right_eye_left = face_landmarks[33]   # Right eye left corner
        right_eye_right = face_landmarks[133] # Right eye right corner
        left_eye_left = face_landmarks[263]   # Left eye left corner
        left_eye_right = face_landmarks[33]   # Left eye right corner
        
        right_iris = ((right_eye_left.x + right_eye_right.x) / 2,
                      (right_eye_left.y + right_eye_right.y) / 2)
        left_iris = ((left_eye_left.x + left_eye_right.x) / 2,
                     (left_eye_left.y + left_eye_right.y) / 2)
    
    # Convert to pixel coordinates
    right_x = right_iris.x * w
    right_y = right_iris.y * h
    left_x = left_iris.x * w
    left_y = left_iris.y * h
    
    avg_x = (right_x + left_x) / 2
    avg_y = (right_y + left_y) / 2
    
    # Determine gaze direction (center is ~350, 240 for 640x480)
    gaze_direction = "center"
    
    # Check horizontal (left/right)
    if avg_x < w * 0.35:
        gaze_direction = "left"
    elif avg_x > w * 0.65:
        gaze_direction = "right"
    
    # Check vertical (up/down)
    if avg_y < h * 0.25:
        gaze_direction = "up"
    elif avg_y > h * 0.75:
        gaze_direction = "down"
    
    return gaze_direction, avg_x, avg_y

def detect_hidden_phone(frame):
    """Detect if phone is hidden under laptop (bright area in keyboard region)."""
    h, w = frame.shape[:2]
    
    # Check lower portion (keyboard area where phone would be hidden)
    lower_region = frame[int(h * 0.6):, :]
    
    # Convert to grayscale
    gray = cv2.cvtColor(lower_region, cv2.COLOR_BGR2GRAY)
    
    # Check for bright spots (phone screen) in dark area (under table)
    brightness = np.mean(gray)
    brightness_std = np.std(gray)
    
    # If very dark overall but with bright spots, likely hidden phone
    if brightness < 50 and brightness_std > 30:
        # Additional check: look for rectangular bright regions (phone shape)
        _, binary = cv2.threshold(gray, 100, 255, cv2.THRESH_BINARY)
        contours, _ = cv2.findContours(binary, cv2.RETR_SIMPLE, cv2.CHAIN_APPROX_SIMPLE)
        
        for contour in contours:
            area = cv2.contourArea(contour)
            # Phone-like size (not too small, not huge)
            if 5000 < area < 50000:
                x, y, w_c, h_c = cv2.boundingRect(contour)
                ratio = float(w_c) / h_c if h_c > 0 else 0
                # Phone aspect ratio roughly 0.5-0.7
                if 0.4 < ratio < 0.8:
                    return True
    
    return False

async def start_eye_gaze_monitor():
    global is_running, gaze_start_time, last_gaze_warning, last_phone_detection
    if is_running:
        return
    
    is_running = True
    gaze_start_time = None
    last_gaze_warning = 0
    last_phone_detection = 0
    
    with mp_face_mesh.FaceMesh(
        static_image_mode=False,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    ) as face_mesh:
        while is_running:
            success, frame = CameraSingleton.read_frame()
            if not success or frame is None:
                await asyncio.sleep(0.1)
                continue
            
            current_time = time.time()
            
            # Process frame for face mesh
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = face_mesh.process(frame_rgb)
            
            if results.multi_face_landmarks:
                face_landmarks = results.multi_face_landmarks[0].landmark
                gaze_direction, iris_x, iris_y = calculate_iris_position(face_landmarks, frame.shape)
                
                # Track gaze direction
                if gaze_direction != "center":
                    if gaze_start_time is None:
                        gaze_start_time = current_time
                    
                    gaze_duration = current_time - gaze_start_time
                    
                    # Warn if looking away too long
                    if gaze_duration > GAZE_AWAY_THRESHOLD:
                        if current_time - last_gaze_warning > GAZE_WARNING_COOLDOWN:
                            log_violation("GAZE_AWAY_FROM_SCREEN", 0.9, {
                                "direction": gaze_direction,
                                "duration": round(gaze_duration, 2)
                            })
                            print(f"👀 Warning: Looking {gaze_direction} for {gaze_duration:.1f}s")
                            last_gaze_warning = current_time
                else:
                    # Looking at center/screen - reset timer
                    gaze_start_time = None
            else:
                # No face detected
                gaze_start_time = None
            
            # Check for hidden phone (every 8 seconds)
            if current_time - last_phone_detection > PHONE_DETECTION_COOLDOWN:
                if detect_hidden_phone(frame):
                    log_violation("PHONE_HIDDEN_DETECTED", 1.0, {
                        "location": "under_keyboard",
                        "detection_method": "brightness_analysis"
                    })
                    print("📱 WARNING: Possible hidden phone detected under keyboard area!")
                
                last_phone_detection = current_time
            
            await asyncio.sleep(0.5)  # Check eye gaze at ~2 FPS

def stop_eye_gaze_monitor():
    global is_running, gaze_start_time
    is_running = False
    gaze_start_time = None
    print("👀 Eye gaze monitoring stopped")
