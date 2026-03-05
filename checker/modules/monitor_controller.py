import asyncio
from modules.face_detector import start_face_monitor, stop_face_monitor
from modules.gadget_detector import start_gadget_monitor, stop_gadget_monitor
from modules.audio_monitor import start_audio_monitor, stop_audio_monitor
from modules.activity_monitor import start_activity_monitor, stop_activity_monitor

monitoring_tasks = []

async def start_all_monitoring():
    global monitoring_tasks
    if monitoring_tasks:
        return # Already running
        
    tasks = [
        asyncio.create_task(start_face_monitor()),
        asyncio.create_task(start_gadget_monitor()),
        asyncio.create_task(start_audio_monitor()),
        asyncio.create_task(start_activity_monitor())
    ]
    monitoring_tasks.extend(tasks)

def stop_all_monitoring():
    global monitoring_tasks
    
    stop_face_monitor()
    stop_gadget_monitor()
    stop_audio_monitor()
    stop_activity_monitor()
    
    for task in monitoring_tasks:
        task.cancel()
        
    monitoring_tasks.clear()
