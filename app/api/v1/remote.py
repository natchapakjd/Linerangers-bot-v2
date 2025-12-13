"""
Ngrok API Endpoints - Remote access control via Ngrok tunnels.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.ngrok_service import get_ngrok_service

router = APIRouter(prefix="/api/v1/remote", tags=["Remote Access"])


class TunnelStartRequest(BaseModel):
    port: int = 8000


@router.post("/start")
async def start_tunnel(request: TunnelStartRequest = TunnelStartRequest()):
    """Start an Ngrok tunnel for remote access."""
    service = get_ngrok_service()
    result = service.start(port=request.port)
    return result


@router.post("/stop")
async def stop_tunnel():
    """Stop the Ngrok tunnel."""
    service = get_ngrok_service()
    result = service.stop()
    return result


@router.get("/status")
async def get_tunnel_status():
    """Get current tunnel status."""
    service = get_ngrok_service()
    status = service.get_status()
    
    # Add QR code if tunnel is running
    if status["is_running"]:
        status["qr_code"] = service.generate_qr_code()
    
    return status


@router.get("/qr-code")
async def get_qr_code():
    """Get QR code for the public URL."""
    service = get_ngrok_service()
    
    if not service.is_running:
        return {
            "success": False,
            "message": "No tunnel running",
            "qr_code": None
        }
    
    qr_code = service.generate_qr_code()
    return {
        "success": True,
        "public_url": service.public_url,
        "qr_code": qr_code
    }
