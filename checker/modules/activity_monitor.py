import pygetwindow as gw
import keyboard
import asyncio
import time
from typing import Optional
from modules.integrity_logger import log_violation

is_running = False
EXAM_WINDOW_TITLE = "ExamShield"
last_logged_time = {}
DEBOUNCE_SECONDS = 2.0  # Prevent duplicate logs within 2 seconds

def should_log_violation(event_type: str) -> bool:
    """Debounce logging to prevent spam."""
    current_time = time.time()
    if event_type in last_logged_time:
        if current_time - last_logged_time[event_type] < DEBOUNCE_SECONDS:
            return False
    last_logged_time[event_type] = current_time
    return True

def on_keyboard_event(event):
    if not is_running or event.event_type != keyboard.KEY_DOWN:
        return
    
    # Check for suspicious key combinations with proper state checking
    try:
        # Alt+Tab detection
        if event.name == 'tab' and (keyboard.is_pressed('alt') or keyboard.is_pressed('alt gr')):
            if should_log_violation("ALT_TAB"):
                log_violation("KEYBOARD_NAVIGATION_ATTEMPT", 1.0, {"key": "ALT+TAB"})
        
        # Alt+Esc detection  
        elif event.name == 'esc' and keyboard.is_pressed('alt'):
            if should_log_violation("ALT_ESC"):
                log_violation("KEYBOARD_NAVIGATION_ATTEMPT", 1.0, {"key": "ALT+ESC"})
        
        # Ctrl+Esc detection
        elif event.name == 'esc' and keyboard.is_pressed('ctrl'):
            if should_log_violation("CTRL_ESC"):
                log_violation("KEYBOARD_NAVIGATION_ATTEMPT", 1.0, {"key": "CTRL+ESC"})
        
        # Windows key detection (only when pressed alone)
        elif event.name in ['left windows', 'right windows']:
            if should_log_violation("WINDOWS_KEY"):
                log_violation("KEYBOARD_NAVIGATION_ATTEMPT", 1.0, {"key": "WINDOWS_KEY"})
                
    except Exception as e:
        print(f"Keyboard event error: {e}")

async def start_activity_monitor():
    global is_running
    is_running = True
    
    # Setup keyboard hooks
    try:
        keyboard.hook(on_keyboard_event)
    except Exception as e:
        print(f"Warning: Could not setup keyboard hooks: {e}")
    
    # Track OS Window Focus
    last_active_window = ""
    
    while is_running:
        try:
            active_window = gw.getActiveWindow()
            if active_window:
                title = active_window.title
                if title != last_active_window:
                    last_active_window = title
                    # If this is active and we're not in the "ExamShield" window context:
                    # In a real environment, uncomment this block when the frontend has "ExamShield" window title:
                    # if EXAM_WINDOW_TITLE not in title:
                    #     log_violation("WINDOW_SWITCH_DETECTED", 1.0, {"active_window": title})
        except Exception:
            pass
            
        await asyncio.sleep(1.0)
        
    try:
        keyboard.unhook_all()
    except Exception:
        pass

def stop_activity_monitor():
    global is_running
    is_running = False
