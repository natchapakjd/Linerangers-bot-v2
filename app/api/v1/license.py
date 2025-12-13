"""
License API endpoints for user and admin operations.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from loguru import logger

from app.services.license_service import get_license_service, LicenseService
from app.core.database import init_db

router = APIRouter(prefix="/api/v1/license", tags=["License"])
admin_router = APIRouter(prefix="/api/v1/admin/license", tags=["Admin - License"])


# ===== Request/Response Models =====

class ActivateLicenseRequest(BaseModel):
    license_key: str


class CreateLicenseRequest(BaseModel):
    customer_name: str
    duration_days: int = 3  # Default 3 days


class LicenseResponse(BaseModel):
    success: bool
    message: str
    license: Optional[dict] = None
    hardware_id: Optional[str] = None
    days_remaining: Optional[int] = None


# ===== User Endpoints =====

@router.post("/activate", response_model=LicenseResponse)
async def activate_license(request: ActivateLicenseRequest):
    """
    Activate a license on this device.
    Binds the license to this hardware if not already activated.
    """
    service = get_license_service()
    hardware_id = service.get_hardware_id()
    
    success, message, license_obj = await service.activate_license(
        request.license_key,
        hardware_id
    )
    
    return LicenseResponse(
        success=success,
        message=message,
        license=license_obj.to_dict() if license_obj else None,
        hardware_id=hardware_id[:8] + "..." if success else None,
        days_remaining=license_obj.days_remaining if license_obj else None
    )


@router.get("/status", response_model=LicenseResponse)
async def get_license_status(license_key: str):
    """
    Check the status of a license on this device.
    """
    service = get_license_service()
    hardware_id = service.get_hardware_id()
    
    is_valid, message, license_obj = await service.validate_license(
        license_key,
        hardware_id
    )
    
    return LicenseResponse(
        success=is_valid,
        message=message,
        license=license_obj.to_dict() if license_obj else None,
        hardware_id=hardware_id[:8] + "...",
        days_remaining=license_obj.days_remaining if license_obj else None
    )


@router.get("/hardware-id")
async def get_hardware_id():
    """Get the hardware ID of this device."""
    service = get_license_service()
    hw_id = service.get_hardware_id()
    return {
        "hardware_id": hw_id,
        "hardware_id_short": hw_id[:8] + "..."
    }


# ===== Admin Endpoints =====

@admin_router.post("/create", response_model=LicenseResponse)
async def create_license(request: CreateLicenseRequest):
    """
    Create a new license (Admin only).
    """
    if request.duration_days < 1:
        raise HTTPException(status_code=400, detail="Duration must be at least 1 day")
    
    service = get_license_service()
    license_obj = await service.create_license(
        request.customer_name,
        request.duration_days
    )
    
    return LicenseResponse(
        success=True,
        message=f"License created: {license_obj.license_key}",
        license=license_obj.to_dict()
    )


@admin_router.get("/list")
async def list_licenses():
    """
    List all licenses (Admin only).
    """
    service = get_license_service()
    licenses = await service.list_licenses()
    
    return {
        "success": True,
        "total": len(licenses),
        "licenses": [lic.to_dict() for lic in licenses]
    }


@admin_router.delete("/{license_key}")
async def revoke_license(license_key: str):
    """
    Revoke a license (Admin only).
    """
    service = get_license_service()
    success, message = await service.revoke_license(license_key)
    
    return {
        "success": success,
        "message": message
    }


@admin_router.post("/{license_key}/reset-hardware")
async def reset_hardware_binding(license_key: str):
    """
    Reset hardware binding for a license (Admin only).
    Allows the license to be activated on a new device.
    """
    service = get_license_service()
    success, message = await service.reset_hardware(license_key)
    
    return {
        "success": success,
        "message": message
    }
