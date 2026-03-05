from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import cv2
import asyncio
import base64
from pydantic import BaseModel
import sqlite3
import os
import json
from datetime import datetime
from typing import Set

from modules.monitor_controller import start_all_monitoring, stop_all_monitoring
from modules.integrity_logger import get_logs, DB_FILE
from modules.camera_singleton import CameraSingleton

# Active WebSocket connections for violations
active_violation_connections: Set[WebSocket] = set()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Application startup logic
    # Start background violation monitoring task
    violation_task = asyncio.create_task(monitor_violations())
    yield
    # Application shutdown logic
    violation_task.cancel()
    CameraSingleton.release()
    stop_all_monitoring()

app = FastAPI(title="ExamShield AI Core Engine", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.websocket("/ws/video")
async def video_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("Video WebSocket client connected")
    
    try:
        # Camera should already be initialized from start_exam
        cap = CameraSingleton.get_cap()
        
        if not cap.isOpened():
            print("ERROR: Camera not opened!")
            await websocket.send_text("ERROR: Camera not available")
            await websocket.close()
            return
        
        # Quick test - camera should already be warmed up
        print("Verifying camera for streaming...")
        ret, test_frame = CameraSingleton.read_frame()
        if not ret or test_frame is None:
            print("ERROR: Cannot read from camera!")
            await websocket.send_text("ERROR: Cannot read from camera")
            await websocket.close()
            return
        
        print(f"Camera verified! Frame shape: {test_frame.shape}. Starting stream...")
        
        frame_count = 0
        consecutive_failures = 0
        
        while True:
            ret, frame = CameraSingleton.read_frame()
            
            if not ret or frame is None:
                consecutive_failures += 1
                print(f"Failed to read frame #{frame_count} (failures: {consecutive_failures})")
                
                if consecutive_failures > 10:
                    print("Too many consecutive failures, closing connection")
                    break
                    
                await asyncio.sleep(0.1)
                continue
            
            consecutive_failures = 0  # Reset on success
            
            try:
                # Encode frame to JPEG
                encode_success, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
                
                if not encode_success:
                    print("Failed to encode frame")
                    await asyncio.sleep(0.05)
                    continue
                
                frame_base64 = base64.b64encode(buffer).decode('utf-8')
                
                # Send to client
                await websocket.send_text(frame_base64)
                frame_count += 1
                
                if frame_count == 1:
                    print("✅ First frame sent successfully!")
                elif frame_count % 100 == 0:
                    print(f"Streamed {frame_count} frames")
                
            except WebSocketDisconnect:
                print(f"Video WebSocket client disconnected during send (sent {frame_count} frames)")
                break
            except Exception as send_error:
                print(f"Error sending frame: {type(send_error).__name__}: {str(send_error) or 'No error message'}")
                import traceback
                traceback.print_exc()
                break
            
            await asyncio.sleep(0.1)  # ~10fps for frontend stability
            
    except WebSocketDisconnect:
        print(f"Video WebSocket client disconnected (sent {frame_count if 'frame_count' in locals() else 0} frames)")
    except Exception as e:
        print(f"Video WebSocket error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
    finally:
        print("WebSocket connection ended")


@app.websocket("/ws/violations")
async def violations_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time violation streaming."""
    await websocket.accept()
    active_violation_connections.add(websocket)
    print(f"Violations WebSocket client connected. Total clients: {len(active_violation_connections)}")
    
    try:
        # Send initial violations from database
        recent_violations = get_logs(limit=10)
        for violation in recent_violations:
            await websocket.send_json(violation)
        
        # Keep connection alive and wait for disconnection
        while True:
            # Ping to keep connection alive
            await websocket.send_json({"type": "ping"})
            await asyncio.sleep(30)
            
    except WebSocketDisconnect:
        print("Violations WebSocket client disconnected")
    except Exception as e:
        print(f"Violations WebSocket error: {type(e).__name__}: {e}")
    finally:
        active_violation_connections.discard(websocket)
        print(f"Violations WebSocket removed. Remaining clients: {len(active_violation_connections)}")


async def monitor_violations():
    """Background task to monitor database and broadcast new violations."""
    last_violation_id = 0
    
    while True:
        try:
            if not os.path.exists(DB_FILE):
                await asyncio.sleep(1)
                continue
                
            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()
            
            # Get new violations since last check
            cursor.execute('''
                SELECT id, timestamp, event_type, confidence, metadata 
                FROM violations 
                WHERE id > ?
                ORDER BY id ASC
            ''', (last_violation_id,))
            
            new_violations = cursor.fetchall()
            conn.close()
            
            # Broadcast new violations to all connected clients
            for violation in new_violations:
                violation_id, timestamp, event_type, confidence, encrypted_metadata = violation
                last_violation_id = max(last_violation_id, violation_id)
                
                violation_data = {
                    "id": violation_id,
                    "timestamp": timestamp,
                    "event_type": event_type,
                    "confidence": confidence,
                    "type": "violation"  # Distinguish from ping messages
                }
                
                # Broadcast to all connected WebSocket clients
                disconnected = set()
                for connection in active_violation_connections:
                    try:
                        await connection.send_json(violation_data)
                    except Exception as e:
                        print(f"Error broadcasting to client: {e}")
                        disconnected.add(connection)
                
                # Remove disconnected clients
                for conn in disconnected:
                    active_violation_connections.discard(conn)
            
        except Exception as e:
            print(f"Violation monitor error: {e}")
        
        await asyncio.sleep(0.5)  # Check twice per second


@app.post("/start_exam")
async def start_exam():
    # Initialize camera FIRST before any monitoring or WebSocket connections
    print("Pre-initializing camera for exam...")
    cap = CameraSingleton.get_cap()
    
    if cap is None or not cap.isOpened():
        return {"status": "error", "message": "Camera not available"}
    
    # Test camera is actually working - try multiple times for stability
    ret, test_frame = False, None
    for attempt in range(5):
        ret, test_frame = CameraSingleton.read_frame()
        if ret and test_frame is not None:
            break
        await asyncio.sleep(0.05)
    
    if not ret:
        return {"status": "error", "message": "Camera not responding"}
    
    print(f"Camera verified: {test_frame.shape}")
    
    # Now start all monitoring tasks
    await start_all_monitoring()
    return {"status": "monitoring_started"}

@app.post("/stop_exam")
async def stop_exam():
    stop_all_monitoring()
    return {"status": "monitoring_stopped"}

@app.get("/logs")
async def handle_get_logs(limit: int = 50):
    logs = get_logs(limit=limit)
    return logs

@app.get("/integrity_score")
async def get_integrity_score():
    if not os.path.exists(DB_FILE):
        return {"integrity_score": 100}
        
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM violations')
    count = cursor.fetchone()[0]
    conn.close()
    
    score = max(0, 100 - (10 * count))
    return {"integrity_score": score}

@app.delete("/logs")
async def clear_logs():
    """Clear all violation logs (for testing/reset)."""
    if os.path.exists(DB_FILE):
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute('DELETE FROM violations')
        conn.commit()
        conn.close()
    return {"status": "logs_cleared"}

@app.get("/camera_test")
async def test_camera():
    """Test if camera is working."""
    cap = CameraSingleton.get_cap()
    if not cap.isOpened():
        return {"status": "error", "message": "Camera not opened"}
    
    ret, frame = CameraSingleton.read_frame()
    if not ret:
        return {"status": "error", "message": "Cannot read from camera"}

    source_info = CameraSingleton.get_camera_source_info()
    mean_brightness = float(frame.mean())
    contrast = float(frame.std())
    
    return {
        "status": "ok", 
        "resolution": f"{frame.shape[1]}x{frame.shape[0]}",
        "fps": cap.get(cv2.CAP_PROP_FPS),
        "camera_index": source_info.get("index"),
        "camera_backend": source_info.get("backend"),
        "mean_brightness": round(mean_brightness, 2),
        "contrast": round(contrast, 2)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
