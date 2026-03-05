import webrtcvad
import sounddevice as sd
import numpy as np
import asyncio
import time
from modules.integrity_logger import log_violation

# Configuration for WebRTC VAD
SAMPLE_RATE = 16000
FRAME_DURATION = 30  # ms
FRAME_SIZE = int(SAMPLE_RATE * (FRAME_DURATION / 1000.0))  # 480 samples

try:
    vad = webrtcvad.Vad(3) # Aggressiveness level (0 to 3)
except Exception:
    vad = None

is_running = False
continuous_voice_start = None
last_speech_log = 0  # Track last time we logged speech detection

def audio_callback(indata, frames, time_info, status):
    global continuous_voice_start, last_speech_log
    if not is_running or not vad:
        return

    # Convert audio to mono, 16-bit PCM
    audio_data = np.int16(indata[:, 0] * 32768).tobytes()
    
    # Process in 30ms frames
    for i in range(0, len(audio_data), FRAME_SIZE * 2):
        frame = audio_data[i:i + FRAME_SIZE * 2]
        if len(frame) < FRAME_SIZE * 2:
            break
            
        is_speech = vad.is_speech(frame, SAMPLE_RATE)
        
        current_time = time.time()
        if is_speech:
            # Debug log (throttled to once per 5 seconds)
            if current_time - last_speech_log > 5.0:
                print(f"🎤 Speech detected!")
                last_speech_log = current_time
            
            if continuous_voice_start is None:
                continuous_voice_start = current_time
            else:
                duration = current_time - continuous_voice_start
                if duration > 3.0: # Continuous conversation > 3 seconds
                    log_violation("VOICE_DETECTED", 1.0, {"duration": round(duration, 2), "speech_probability": 0.95})
                    print(f"Logged Violation: VOICE_DETECTED (duration: {duration:.2f}s)")
                    continuous_voice_start = current_time # Reset to avoid spam
        else:
            continuous_voice_start = None

async def start_audio_monitor():
    global is_running
    is_running = True
    
    if not vad:
        print("❌ WebRTC VAD not initialized. Audio monitoring skipped.")
        return
    
    print("🎤 Starting audio monitor...")
        
    try:
        # List available devices
        devices = sd.query_devices()
        print(f"🎤 Found {len(devices)} audio devices")
        default_input = sd.query_devices(kind='input')
        print(f"🎤 Using default input device: {default_input['name']}")
        
        # Start the sounddevice InputStream as background
        with sd.InputStream(samplerate=SAMPLE_RATE, channels=1, callback=audio_callback, blocksize=FRAME_SIZE*10):
            print("🎤 Audio monitoring started successfully!")
            while is_running:
                await asyncio.sleep(1.0)
    except Exception as e:
        print(f"❌ Audio monitor error: {type(e).__name__}: {e}")

def stop_audio_monitor():
    global is_running
    is_running = False
    print("🎤 Audio monitoring stopped")
