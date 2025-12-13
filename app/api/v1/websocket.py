"""
WebSocket Handler - Real-time communication with frontend.
"""
import asyncio
import base64
import cv2
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List
from loguru import logger
from app.api.v1.endpoints import get_bot

router = APIRouter()


class ConnectionManager:
    """Manages WebSocket connections."""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total: {len(self.active_connections)}")
    
    async def broadcast(self, message: dict):
        """Send message to all connected clients."""
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass


manager = ConnectionManager()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates."""
    await manager.connect(websocket)
    
    bot = get_bot()
    
    # Register log callback
    async def send_log(message: str):
        await manager.broadcast({"type": "log", "message": message})
    
    def log_callback(message: str):
        asyncio.create_task(send_log(message))
    
    bot.add_log_callback(log_callback)
    
    try:
        while True:
            # Send status updates periodically
            status = bot.status
            await websocket.send_json({
                "type": "status",
                "data": {
                    "state": status.state.value,
                    "adb_connected": status.adb_connected,
                    "current_action": status.current_action,
                    "loop_count": status.loop_count
                }
            })
            
            # Send screenshot if connected
            if status.adb_connected and bot.adb.is_connected:
                screen = bot.adb.screenshot()
                if screen is not None:
                    # Resize for preview
                    h, w = screen.shape[:2]
                    preview = cv2.resize(screen, (w // 2, h // 2))
                    _, buffer = cv2.imencode('.jpg', preview, [cv2.IMWRITE_JPEG_QUALITY, 50])
                    img_base64 = base64.b64encode(buffer).decode('utf-8')
                    await websocket.send_json({
                        "type": "screen",
                        "image": f"data:image/jpeg;base64,{img_base64}"
                    })
            
            await asyncio.sleep(1)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
