"""
API Endpoints - HTTP routes for bot control.
"""
from fastapi import APIRouter
from app.schemas.status import CommandResponse, BotStatus
from app.core import BotLifecycle

router = APIRouter(prefix="/api/v1", tags=["Bot Control"])

# Singleton bot instance
_bot: BotLifecycle = None


def get_bot() -> BotLifecycle:
    global _bot
    if _bot is None:
        _bot = BotLifecycle()
    return _bot


@router.get("/status", response_model=BotStatus)
async def get_status():
    """Get current bot status."""
    return get_bot().status


@router.post("/start", response_model=CommandResponse)
async def start_bot():
    """Start the bot."""
    bot = get_bot()
    success = bot.start()
    return CommandResponse(
        success=success,
        message=bot.status.message
    )


@router.post("/stop", response_model=CommandResponse)
async def stop_bot():
    """Stop the bot."""
    bot = get_bot()
    success = bot.stop()
    return CommandResponse(
        success=success,
        message="Bot stopped" if success else "Failed to stop"
    )


@router.post("/pause", response_model=CommandResponse)
async def pause_bot():
    """Pause the bot."""
    bot = get_bot()
    success = bot.pause()
    return CommandResponse(
        success=success,
        message="Bot paused" if success else "Cannot pause"
    )


@router.post("/resume", response_model=CommandResponse)
async def resume_bot():
    """Resume the bot."""
    bot = get_bot()
    success = bot.resume()
    return CommandResponse(
        success=success,
        message="Bot resumed" if success else "Cannot resume"
    )


# ==================== Daily Login Endpoints ====================

from app.services import get_daily_login_service
from app.services.device_manager import get_device_manager, DeviceTask
from pydantic import BaseModel
from typing import List


class ScanFolderRequest(BaseModel):
    folder_path: str


class AccountInfoResponse(BaseModel):
    filename: str
    filepath: str
    processed: bool
    success: bool
    error_message: str


class DailyLoginStatusResponse(BaseModel):
    state: str
    folder_path: str
    total_accounts: int
    processed_count: int
    current_account: str
    accounts: List[AccountInfoResponse]
    message: str


class DailyLoginSettingsRequest(BaseModel):
    delay_after_push: float = 2.0
    delay_for_game_load: float = 60.0
    delay_between_accounts: float = 5.0
    auto_claim_enabled: bool = True


@router.post("/daily-login/scan")
async def scan_folder(request: ScanFolderRequest):
    """Scan a folder for XML account files."""
    service = get_daily_login_service()
    accounts = service.scan_folder(request.folder_path)
    return {
        "success": len(accounts) > 0,
        "message": service.status.message,
        "total_accounts": len(accounts),
        "accounts": [
            {"filename": a.filename, "filepath": a.filepath}
            for a in accounts
        ]
    }


@router.post("/daily-login/start", response_model=CommandResponse)
async def start_daily_login():
    """Start the daily login automation."""
    service = get_daily_login_service()
    success = service.start()
    return CommandResponse(
        success=success,
        message="Daily login started" if success else service.status.message
    )


@router.post("/daily-login/stop", response_model=CommandResponse)
async def stop_daily_login():
    """Stop the daily login automation."""
    service = get_daily_login_service()
    success = service.stop()
    return CommandResponse(
        success=success,
        message="Daily login stopped"
    )


@router.get("/daily-login/status")
async def get_daily_login_status():
    """Get current daily login status."""
    service = get_daily_login_service()
    status = service.status
    return {
        "state": status.state.value,
        "folder_path": status.folder_path,
        "total_accounts": status.total_accounts,
        "processed_count": status.processed_count,
        "current_account": status.current_account,
        "message": status.message,
        "auto_claim_enabled": service.auto_claim_enabled,
        "accounts": [
            {
                "filename": a.filename,
                "filepath": a.filepath,
                "processed": a.processed,
                "success": a.success,
                "error_message": a.error_message
            }
            for a in status.accounts
        ]
    }


@router.post("/daily-login/settings", response_model=CommandResponse)
async def update_daily_login_settings(settings: DailyLoginSettingsRequest):
    """Update daily login timing settings."""
    service = get_daily_login_service()
    service.delay_after_push = settings.delay_after_push
    service.delay_for_game_load = settings.delay_for_game_load
    service.delay_between_accounts = settings.delay_between_accounts
    service.auto_claim_enabled = settings.auto_claim_enabled
    return CommandResponse(
        success=True,
        message="Settings updated"
    )


@router.post("/daily-login/auto-claim/{enabled}", response_model=CommandResponse)
async def toggle_auto_claim(enabled: bool):
    """Toggle auto claim rewards feature."""
    service = get_daily_login_service()
    service.auto_claim_enabled = enabled
    return CommandResponse(
        success=True,
        message=f"Auto claim {'enabled' if enabled else 'disabled'}"
    )


@router.get("/daily-login/screenshot")
async def get_daily_login_screenshot():
    """Get current emulator screenshot."""
    service = get_daily_login_service()
    image_data = service.get_screenshot()
    if image_data:
        return {"success": True, "image": image_data}
    return {"success": False, "image": None, "message": "Failed to capture screenshot"}


# ==================== Device Management Endpoints ====================

@router.get("/devices")
async def list_devices():
    """List all connected ADB devices."""
    manager = get_device_manager()
    devices = manager.refresh_devices()
    return {
        "success": True,
        "devices": [d.to_dict() for d in devices]
    }


@router.get("/devices/{serial}")
async def get_device(serial: str):
    """Get device info by serial."""
    manager = get_device_manager()
    device = manager.get_device(serial)
    if device:
        return {"success": True, "device": device.to_dict()}
    return {"success": False, "message": f"Device {serial} not found"}


@router.post("/devices/{serial}/task/{task}", response_model=CommandResponse)
async def assign_device_task(serial: str, task: str):
    """Assign a task to a device."""
    manager = get_device_manager()
    
    # Parse task
    try:
        task_enum = DeviceTask(task)
    except ValueError:
        return CommandResponse(
            success=False,
            message=f"Invalid task: {task}. Valid options: none, daily_login, re_id"
        )
    
    success = manager.assign_task(serial, task_enum)
    return CommandResponse(
        success=success,
        message=f"Assigned {task} to {serial}" if success else f"Device {serial} not found"
    )


@router.post("/devices/{serial}/daily-login/start", response_model=CommandResponse)
async def start_daily_login_on_device(serial: str):
    """Start daily login on a specific device."""
    from app.services.daily_login_service import DailyLoginService
    
    manager = get_device_manager()
    device = manager.get_device(serial)
    
    if not device:
        return CommandResponse(success=False, message=f"Device {serial} not found")
    
    if device.status.value != "online":
        return CommandResponse(success=False, message=f"Device {serial} is {device.status.value}")
    
    # Get or create service for this device
    if serial not in manager._task_services:
        from app.config import ADB_HOST, ADB_PORT
        service = DailyLoginService()
        service.adb.device_address = serial  # Override device
        manager._task_services[serial] = service
    
    service = manager._task_services[serial]
    
    # Check if already scanned
    if not service.status.accounts:
        return CommandResponse(success=False, message="No accounts scanned. Scan folder first.")
    
    success = service.start()
    if success:
        manager.set_running(serial, True)
    
    return CommandResponse(
        success=success,
        message=f"Daily login started on {serial}" if success else service.status.message
    )


@router.post("/devices/{serial}/daily-login/stop", response_model=CommandResponse)
async def stop_daily_login_on_device(serial: str):
    """Stop daily login on a specific device."""
    manager = get_device_manager()
    
    if serial not in manager._task_services:
        return CommandResponse(success=False, message=f"No service running for {serial}")
    
    service = manager._task_services[serial]
    success = service.stop()
    manager.set_running(serial, False)
    
    return CommandResponse(
        success=success,
        message=f"Daily login stopped on {serial}"
    )


@router.post("/devices/{serial}/daily-login/scan")
async def scan_folder_for_device(serial: str, request: ScanFolderRequest):
    """Scan folder for a specific device."""
    from app.services.daily_login_service import DailyLoginService
    
    manager = get_device_manager()
    device = manager.get_device(serial)
    
    if not device:
        return {"success": False, "message": f"Device {serial} not found"}
    
    # Get or create service for this device
    if serial not in manager._task_services:
        service = DailyLoginService()
        service.adb.device_address = serial
        manager._task_services[serial] = service
    
    service = manager._task_services[serial]
    accounts = service.scan_folder(request.folder_path)
    
    return {
        "success": len(accounts) > 0,
        "message": service.status.message,
        "total_accounts": len(accounts)
    }


@router.get("/devices/{serial}/daily-login/status")
async def get_device_daily_login_status(serial: str):
    """Get daily login status for a specific device."""
    manager = get_device_manager()
    
    if serial not in manager._task_services:
        return {
            "state": "idle",
            "message": "No service for this device",
            "total_accounts": 0,
            "processed_count": 0,
            "accounts": []
        }
    
    service = manager._task_services[serial]
    status = service.status
    
    return {
        "state": status.state.value,
        "folder_path": status.folder_path,
        "total_accounts": status.total_accounts,
        "processed_count": status.processed_count,
        "current_account": status.current_account,
        "message": status.message,
        "auto_claim_enabled": service.auto_claim_enabled,
        "accounts": [
            {
                "filename": a.filename,
                "processed": a.processed,
                "success": a.success,
                "error_message": a.error_message
            }
            for a in status.accounts
        ]
    }


@router.get("/devices/{serial}/screenshot")
async def get_device_screenshot(serial: str):
    """Capture and return screenshot from a specific device."""
    import subprocess
    import base64
    
    manager = get_device_manager()
    device = manager.get_device(serial)
    
    if not device:
        return {"success": False, "message": f"Device {serial} not found", "image": None}
    
    if device.status.value != "online":
        return {"success": False, "message": f"Device {serial} is {device.status.value}", "image": None}
    
    try:
        # Capture screenshot using ADB
        result = subprocess.run(
            ["adb", "-s", serial, "exec-out", "screencap", "-p"],
            capture_output=True,
            timeout=10
        )
        
        if result.returncode != 0 or not result.stdout:
            return {"success": False, "message": "Failed to capture screenshot", "image": None}
        
        # Encode as base64
        image_base64 = base64.b64encode(result.stdout).decode('utf-8')
        
        return {
            "success": True,
            "image": f"data:image/png;base64,{image_base64}",
            "serial": serial
        }
        
    except subprocess.TimeoutExpired:
        return {"success": False, "message": "Screenshot capture timed out", "image": None}
    except Exception as e:
        return {"success": False, "message": str(e), "image": None}


@router.get("/devices/screenshots/all")
async def get_all_device_screenshots():
    """Get screenshots from all online devices."""
    import subprocess
    import base64
    
    manager = get_device_manager()
    manager.refresh_devices()
    
    results = []
    
    for device in manager.devices:
        if device.status.value != "online":
            results.append({
                "serial": device.serial,
                "status": device.status.value,
                "task": device.assigned_task.value,
                "is_running": device.is_running,
                "success": False,
                "image": None,
                "message": f"Device is {device.status.value}"
            })
            continue
        
        try:
            result = subprocess.run(
                ["adb", "-s", device.serial, "exec-out", "screencap", "-p"],
                capture_output=True,
                timeout=10
            )
            
            if result.returncode == 0 and result.stdout:
                image_base64 = base64.b64encode(result.stdout).decode('utf-8')
                results.append({
                    "serial": device.serial,
                    "status": device.status.value,
                    "task": device.assigned_task.value,
                    "is_running": device.is_running,
                    "screen_size": device.screen_size,
                    "success": True,
                    "image": f"data:image/png;base64,{image_base64}"
                })
            else:
                results.append({
                    "serial": device.serial,
                    "status": device.status.value,
                    "task": device.assigned_task.value,
                    "is_running": device.is_running,
                    "success": False,
                    "image": None,
                    "message": "Failed to capture"
                })
        except Exception as e:
            results.append({
                "serial": device.serial,
                "status": device.status.value,
                "task": device.assigned_task.value,
                "is_running": device.is_running,
                "success": False,
                "image": None,
                "message": str(e)
            })
    
    return {
        "success": True,
        "total": len(results),
        "devices": results
    }

