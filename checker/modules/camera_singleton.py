import cv2
import time
import threading
import numpy as np
import os

class CameraSingleton:
    """Singleton class to manage the webcam instance across all monitors."""
    _instance = None
    _cap = None
    _lock = threading.Lock()
    _selected_index = None
    _selected_backend = None
    _failed_read_count = 0
    _last_reopen_time = 0

    @classmethod
    def _configure_capture(cls, cap):
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    @classmethod
    def _open_source(cls, index, backend):
        cap = cv2.VideoCapture(index, backend)
        if not cap.isOpened():
            cap.release()
            return None

        cls._configure_capture(cap)
        return cap

    @classmethod
    def _try_open_camera(cls):
        # Try stable backends first, CAP_DSHOW as last resort
        backends = [cv2.CAP_ANY, cv2.CAP_MSMF, cv2.CAP_DSHOW]
        best_cap = None
        best_score = -1.0

        preferred_index = os.getenv("EXAMSHIELD_CAMERA_INDEX")
        if preferred_index is not None:
            try:
                camera_indexes = [int(preferred_index)]
            except ValueError:
                camera_indexes = [0, 1, 2]
        else:
            # Prefer built-in webcam first for laptop stability
            camera_indexes = [0, 1, 2]

        for index in camera_indexes:
            for backend in backends:
                cap = cls._open_source(index, backend)
                if cap is None:
                    continue

                # Warm-up: give camera time to adjust exposure
                for _ in range(10):
                    cap.read()
                    time.sleep(0.05)

                # Test sustained readability with longer sequence
                success_count = 0
                non_black_count = 0
                last_mean = 0.0
                last_std = 0.0
                variation_count = 0
                previous_gray = None

                # Test 15 frames to verify stability
                for _ in range(15):
                    ok, frame = cap.read()
                    if ok and frame is not None:
                        success_count += 1
                        mean_brightness = float(np.mean(frame))
                        contrast = float(np.std(frame))
                        last_mean = mean_brightness
                        last_std = contrast

                        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                        if previous_gray is not None:
                            diff = cv2.absdiff(gray, previous_gray)
                            if float(np.mean(diff)) > 0.5:
                                variation_count += 1
                        previous_gray = gray

                        if mean_brightness > 5.0 and contrast > 2.0:
                            non_black_count += 1
                    time.sleep(0.02)

                if success_count == 0:
                    print(f"Camera index {index} backend {backend}: opened but no frame")
                    cap.release()
                    continue

                # Prefer stable source: many successful and non-black frames
                # Heavily penalize CAP_DSHOW as it's unstable for continuous reads
                backend_bonus = -500.0 if backend == cv2.CAP_DSHOW else 10.0
                score = (
                    (success_count * 50.0)
                    + (non_black_count * 20.0)
                    + (variation_count * 30.0)
                    + last_mean
                    + last_std
                    + backend_bonus
                )
                print(
                    f"Camera index {index} backend {backend}: "
                    f"success={success_count}/15, non_black={non_black_count}/15, "
                    f"variation={variation_count}/14, "
                    f"mean={last_mean:.2f}, std={last_std:.2f}, score={score:.2f}"
                )

                # Require high success rate for reliability
                # Some cameras start black, so be lenient with non_black requirement
                if success_count < 12:
                    cap.release()
                    continue

                if score > best_score:
                    if best_cap is not None:
                        best_cap.release()
                    best_cap = cap
                    best_score = score
                    cls._selected_index = index
                    cls._selected_backend = backend
                    
                    # Stop testing if we have a high-quality source
                    # Testing additional backends can interfere with current capture
                    if score > 1500:
                        print("Found high-quality camera source, skipping remaining backends")
                        return best_cap
                else:
                    cap.release()

        if best_cap is not None:
            print(
                f"Selected camera source index={cls._selected_index} "
                f"backend={cls._selected_backend} score={best_score:.2f}"
            )
        return best_cap

    @classmethod
    def get_cap(cls):
        """Get or create the camera capture object."""
        if cls._cap is None or not cls._cap.isOpened():
            with cls._lock:
                if cls._cap is None or not cls._cap.isOpened():
                    print("Initializing camera...")
                    cls._cap = cls._try_open_camera()

                    if cls._cap is None or not cls._cap.isOpened():
                        print("ERROR: Could not open camera with any backend!")
                        return cls._cap

                    # Warm-up: flush buffer with a few reads to stabilize
                    for _ in range(5):
                        cls._cap.read()
                        time.sleep(0.02)
                    
                    print("Camera ready!")

        return cls._cap

    @classmethod
    def read_frame(cls):
        """Thread-safe frame read for all consumers."""
        cap = cls.get_cap()
        if cap is None or not cap.isOpened():
            return False, None

        with cls._lock:
            # Try reading a few times with short delays
            for attempt in range(3):
                ok, frame = cap.read()
                if ok and frame is not None:
                    cls._failed_read_count = 0
                    return True, frame
                time.sleep(0.02)

            cls._failed_read_count += 1

            # Only reopen if we've had sustained failures AND enough time has passed
            current_time = time.time()
            if cls._failed_read_count < 5:
                # Not enough failures yet, just return False
                return False, None

            if current_time - cls._last_reopen_time < 3.0:
                # Don't reopen too frequently (prevents blinking)
                return False, None

            print(f"Camera read failed {cls._failed_read_count} times, attempting source reopen...")
            cls._last_reopen_time = current_time
            cls._failed_read_count = 0

            if cls._cap is not None:
                cls._cap.release()

            reopened = None
            if cls._selected_index is not None and cls._selected_backend is not None:
                reopened = cls._open_source(cls._selected_index, cls._selected_backend)

            if reopened is None:
                reopened = cls._try_open_camera()

            cls._cap = reopened
            if cls._cap is None or not cls._cap.isOpened():
                return False, None

            # Try a few reads after reopen
            for _ in range(5):
                ok, frame = cls._cap.read()
                if ok and frame is not None:
                    return True, frame
                time.sleep(0.02)

        return False, None

    @classmethod
    def release(cls):
        """Release the camera resource."""
        with cls._lock:
            if cls._cap is not None:
                cls._cap.release()
            cls._cap = None
            cls._selected_index = None
            cls._selected_backend = None

        print("Camera released")

    @classmethod
    def get_camera_source_info(cls):
        return {
            "index": cls._selected_index,
            "backend": cls._selected_backend,
        }
