"""
Ngrok Service - Provides remote access via Ngrok tunnels.
"""
from typing import Optional
from loguru import logger
from pyngrok import ngrok, conf
import threading
import qrcode
import io
import base64


class NgrokService:
    """Service for managing Ngrok tunnels for remote access."""
    
    def __init__(self):
        self._tunnel = None
        self._public_url: Optional[str] = None
        self._is_running = False
    
    @property
    def is_running(self) -> bool:
        return self._is_running
    
    @property
    def public_url(self) -> Optional[str]:
        return self._public_url
    
    def start(self, port: int = 8000) -> dict:
        """
        Start an Ngrok tunnel.
        
        Args:
            port: The local port to expose (default: 8000)
            
        Returns:
            dict with success status and public_url
        """
        if self._is_running:
            return {
                "success": True,
                "message": "Tunnel already running",
                "public_url": self._public_url
            }
        
        try:
            # Configure ngrok
            conf.get_default().region = "ap"  # Asia Pacific for better latency
            
            # Start HTTP tunnel
            self._tunnel = ngrok.connect(port, "http")
            self._public_url = self._tunnel.public_url
            self._is_running = True
            
            logger.info(f"🌐 Ngrok tunnel started: {self._public_url}")
            
            return {
                "success": True,
                "message": "Tunnel started successfully",
                "public_url": self._public_url
            }
            
        except Exception as e:
            logger.error(f"Failed to start Ngrok tunnel: {e}")
            return {
                "success": False,
                "message": str(e),
                "public_url": None
            }
    
    def stop(self) -> dict:
        """Stop the Ngrok tunnel."""
        if not self._is_running:
            return {
                "success": True,
                "message": "No tunnel running"
            }
        
        try:
            ngrok.disconnect(self._tunnel.public_url)
            ngrok.kill()
            
            self._tunnel = None
            self._public_url = None
            self._is_running = False
            
            logger.info("🔌 Ngrok tunnel stopped")
            
            return {
                "success": True,
                "message": "Tunnel stopped"
            }
            
        except Exception as e:
            logger.error(f"Failed to stop tunnel: {e}")
            return {
                "success": False,
                "message": str(e)
            }
    
    def get_status(self) -> dict:
        """Get current tunnel status."""
        return {
            "is_running": self._is_running,
            "public_url": self._public_url,
            "tunnels": ngrok.get_tunnels() if self._is_running else []
        }
    
    def generate_qr_code(self) -> Optional[str]:
        """
        Generate a QR code for the public URL.
        
        Returns:
            Base64 encoded PNG image, or None if no tunnel is running
        """
        if not self._public_url:
            return None
        
        try:
            # Generate QR code
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            qr.add_data(self._public_url)
            qr.make(fit=True)
            
            # Create image
            img = qr.make_image(fill_color="black", back_color="white")
            
            # Convert to base64
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            buffer.seek(0)
            
            img_base64 = base64.b64encode(buffer.read()).decode('utf-8')
            return f"data:image/png;base64,{img_base64}"
            
        except Exception as e:
            logger.error(f"Failed to generate QR code: {e}")
            return None


# Singleton instance
_ngrok_service: Optional[NgrokService] = None


def get_ngrok_service() -> NgrokService:
    """Get or create ngrok service instance."""
    global _ngrok_service
    if _ngrok_service is None:
        _ngrok_service = NgrokService()
    return _ngrok_service
