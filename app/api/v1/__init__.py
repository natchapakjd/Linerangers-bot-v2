from .endpoints import router as endpoints_router
from .websocket import router as websocket_router
from .license import router as license_router, admin_router as admin_license_router

__all__ = ["endpoints_router", "websocket_router", "license_router", "admin_license_router"]
