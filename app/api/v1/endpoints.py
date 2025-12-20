"""
API Endpoints - HTTP routes for bot control.
"""
from fastapi import APIRouter
from app.schemas.status import CommandResponse, BotStatus
from app.core import BotLifecycle
from loguru import logger

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


@router.get("/browse-folder")
async def browse_folder():
    """Open a native folder picker dialog and return the selected path."""
    import threading
    from typing import Optional
    
    selected_path: Optional[str] = None
    dialog_closed = threading.Event()
    
    def open_dialog():
        nonlocal selected_path
        try:
            import tkinter as tk
            from tkinter import filedialog
            
            root = tk.Tk()
            root.withdraw()  # Hide the main window
            root.attributes('-topmost', True)  # Bring dialog to front
            root.lift()
            root.focus_force()
            
            selected_path = filedialog.askdirectory(
                title="Select Folder containing XML Account Files",
                mustexist=True
            )
            
            root.destroy()
        except Exception as e:
            print(f"Error opening folder dialog: {e}")
        finally:
            dialog_closed.set()
    
    # Run dialog in a separate thread to not block the event loop
    thread = threading.Thread(target=open_dialog)
    thread.start()
    dialog_closed.wait(timeout=60)  # Wait up to 60 seconds
    thread.join(timeout=1)
    
    if selected_path:
        return {"success": True, "folder_path": selected_path}
    return {"success": False, "folder_path": "", "message": "No folder selected"}


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


class StartWithWorkflowRequest(BaseModel):
    workflow_id: int = None
    mode_name: str = None


@router.post("/devices/{serial}/daily-login/start", response_model=CommandResponse)
async def start_daily_login_on_device(serial: str, request: StartWithWorkflowRequest = None):
    """Start daily login on a specific device with optional workflow."""
    from app.services.daily_login_service import DailyLoginService
    from app.services.workflow_service import get_workflow_service
    
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
    
    # Load workflow if specified
    workflow_service = get_workflow_service()
    logger.info(f"Loading workflow for daily-login on {serial}...")
    
    if request and request.workflow_id:
        # Use specific workflow by ID
        workflow = await workflow_service.get_workflow(request.workflow_id)
        if workflow and workflow.get("steps"):
            service.workflow_id = request.workflow_id
            service.workflow_steps = workflow["steps"]
    elif request and request.mode_name:
        # Use workflow from mode configuration
        workflow = await workflow_service.get_workflow_for_mode(request.mode_name)
        if workflow and workflow.get("steps"):
            service.workflow_id = workflow["id"]
            service.workflow_steps = workflow["steps"]
    else:
        # Try to get workflow for daily-login mode automatically
        logger.info("No specific workflow requested, looking for mode='daily-login'...")
        workflow = await workflow_service.get_workflow_for_mode("daily-login")
        logger.info(f"Found workflow: {workflow.get('name') if workflow else None}, steps: {len(workflow.get('steps', [])) if workflow else 0}")
        if workflow and workflow.get("steps"):
            service.workflow_id = workflow["id"]
            service.workflow_steps = workflow["steps"]
            logger.info(f"Loaded workflow #{service.workflow_id} with {len(service.workflow_steps)} steps")
    
    success = service.start()
    if success:
        manager.set_running(serial, True)
    
    workflow_msg = f" with workflow #{service.workflow_id}" if service.workflow_id else ""
    return CommandResponse(
        success=success,
        message=f"Daily login started on {serial}{workflow_msg}" if success else service.status.message
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


@router.post("/devices/{serial}/key/back", response_model=CommandResponse)
async def press_back_key(serial: str):
    """Press the Android Back key on a device."""
    import subprocess
    
    manager = get_device_manager()
    device = manager.get_device(serial)
    
    if not device:
        return CommandResponse(success=False, message=f"Device {serial} not found")
    
    if device.status.value != "online":
        return CommandResponse(success=False, message=f"Device {serial} is {device.status.value}")
    
    try:
        result = subprocess.run(
            ["adb", "-s", serial, "shell", "input", "keyevent", "KEYCODE_BACK"],
            capture_output=True,
            timeout=5
        )
        
        if result.returncode == 0:
            return CommandResponse(success=True, message="Back key pressed")
        else:
            return CommandResponse(success=False, message=f"Failed: {result.stderr.decode()}")
            
    except Exception as e:
        return CommandResponse(success=False, message=str(e))


@router.post("/devices/{serial}/restart-game", response_model=CommandResponse)
async def restart_game(serial: str):
    """Force stop and restart Line Rangers game."""
    import subprocess
    import time
    
    manager = get_device_manager()
    device = manager.get_device(serial)
    
    if not device:
        return CommandResponse(success=False, message=f"Device {serial} not found")
    
    if device.status.value != "online":
        return CommandResponse(success=False, message=f"Device {serial} is {device.status.value}")
    
    # Line Rangers package name
    package_name = "com.linecorp.LGRGS"
    
    try:
        # Force stop the game
        subprocess.run(
            ["adb", "-s", serial, "shell", "am", "force-stop", package_name],
            capture_output=True,
            timeout=5
        )
        
        time.sleep(1)
        
        # Start the game
        result = subprocess.run(
            ["adb", "-s", serial, "shell", "monkey", "-p", package_name, "-c", "android.intent.category.LAUNCHER", "1"],
            capture_output=True,
            timeout=5
        )
        
        if result.returncode == 0:
            return CommandResponse(success=True, message="Game restarted")
        else:
            return CommandResponse(success=False, message=f"Failed to start: {result.stderr.decode()}")
            
    except Exception as e:
        return CommandResponse(success=False, message=str(e))


# ==================== Multi-Device Endpoints ====================

from app.services.multi_device_service import get_multi_device_orchestrator


class MultiDeviceStartRequest(BaseModel):
    device_serials: List[str]
    mode_name: str = "daily-login"
    resume: bool = False


@router.post("/multi-device/scan")
async def multi_device_scan(request: ScanFolderRequest):
    """Scan folder and load accounts into shared queue."""
    orchestrator = get_multi_device_orchestrator()
    count = orchestrator.scan_folder(request.folder_path)
    
    return {
        "success": count > 0,
        "message": f"Loaded {count} accounts into shared queue",
        "total_accounts": count
    }


@router.post("/multi-device/start", response_model=CommandResponse)
async def multi_device_start(request: MultiDeviceStartRequest):
    """Start parallel processing on multiple devices."""
    orchestrator = get_multi_device_orchestrator()
    
    # Load workflow for the mode
    workflow_loaded = await orchestrator.load_workflow(request.mode_name)
    if not workflow_loaded:
        logger.warning(f"No workflow found for mode {request.mode_name}, will use auto-claim")
    
    success = orchestrator.start(request.device_serials, resume=request.resume)
    
    if success:
        return CommandResponse(
            success=True,
            message=f"Started {len(request.device_serials)} devices in parallel"
        )
    
    return CommandResponse(
        success=False,
        message="Failed to start multi-device processing"
    )


@router.post("/multi-device/stop", response_model=CommandResponse)
async def multi_device_stop():
    """Stop all devices."""
    orchestrator = get_multi_device_orchestrator()
    success = orchestrator.stop()
    
    return CommandResponse(
        success=success,
        message="All devices stopped" if success else "Not running"
    )


@router.post("/multi-device/resume", response_model=CommandResponse)
async def multi_device_resume(request: MultiDeviceStartRequest):
    """Resume processing from where it stopped."""
    orchestrator = get_multi_device_orchestrator()
    
    # Load workflow for the mode
    workflow_loaded = await orchestrator.load_workflow(request.mode_name)
    if not workflow_loaded:
        logger.warning(f"No workflow found for mode {request.mode_name}, will use auto-claim")
    
    success = orchestrator.start(request.device_serials, resume=True)
    
    if success:
        remaining = orchestrator.queue.remaining_count
        return CommandResponse(
            success=True,
            message=f"Resumed on {len(request.device_serials)} devices ({remaining} accounts remaining)"
        )
    
    return CommandResponse(
        success=False,
        message="Failed to resume multi-device processing"
    )


@router.get("/multi-device/status")
async def multi_device_status():
    """Get status of multi-device processing."""
    orchestrator = get_multi_device_orchestrator()
    status = orchestrator.get_status()
    # Include settings
    status["move_on_complete"] = orchestrator.queue.move_on_complete
    status["done_folder"] = orchestrator.queue.custom_done_folder or "auto (done subfolder)"
    return status


class MultiDeviceSettingsRequest(BaseModel):
    move_on_complete: bool = True
    done_folder: str = ""  # Empty = auto-create subfolder


@router.post("/multi-device/settings", response_model=CommandResponse)
async def multi_device_settings(request: MultiDeviceSettingsRequest):
    """Update multi-device settings."""
    orchestrator = get_multi_device_orchestrator()
    orchestrator.queue.move_on_complete = request.move_on_complete
    orchestrator.queue.custom_done_folder = request.done_folder
    
    folder_msg = request.done_folder if request.done_folder else "auto (done subfolder)"
    return CommandResponse(
        success=True,
        message=f"Settings saved. Done folder: {folder_msg}"
    )


@router.post("/multi-device/account/{filename}/mark-bugged", response_model=CommandResponse)
async def mark_account_bugged(filename: str):
    """Mark an account as bugged and delete the file."""
    orchestrator = get_multi_device_orchestrator()
    success = orchestrator.queue.mark_as_bugged(filename)
    
    if success:
        return CommandResponse(
            success=True,
            message=f"Deleted bugged file: {filename}"
        )
    return CommandResponse(
        success=False,
        message=f"Failed to delete {filename}"
    )


class FindDuplicatesRequest(BaseModel):
    folder_a: str  # Master folder - ถ้าเนื้อหาเหมือนกัน จะไม่ลบจาก folder นี้
    folder_b: str  # Folder ที่จะลบไฟล์ซ้ำออก
    dry_run: bool = True  # Default เป็น True เพื่อ preview ก่อนลบจริง


@router.post("/daily-login/find-duplicates")
async def find_duplicates(request: FindDuplicatesRequest):
    """
    เปรียบเทียบไฟล์ XML ระหว่าง folder A และ folder B
    ถ้าพบว่าไฟล์ใน A มีเนื้อหาซ้ำกับไฟล์ใน B ให้ลบไฟล์นั้นออกจาก B
    
    - folder_a: Folder ต้นทาง (master) - ไม่ลบไฟล์จาก folder นี้
    - folder_b: Folder ที่จะลบไฟล์ซ้ำออก
    - dry_run: ถ้า True จะแค่แสดง preview ว่าจะลบอะไรบ้าง (default)
    """
    service = get_daily_login_service()
    result = service.find_duplicates_and_remove(
        folder_a=request.folder_a,
        folder_b=request.folder_b,
        dry_run=request.dry_run
    )
    
    return {
        "success": len(result["errors"]) == 0,
        "dry_run": result["dry_run"],
        "folder_a_count": result["folder_a_count"],
        "folder_b_count": result["folder_b_count"],
        "duplicates_found": len(result["duplicates"]),
        "removed_count": result["removed_count"],
        "duplicates": result["duplicates"],
        "errors": result["errors"],
        "message": f"{'Preview: ' if result['dry_run'] else ''}Found {len(result['duplicates'])} duplicates, {'would remove' if result['dry_run'] else 'removed'} {result['removed_count']} files from Folder B"
    }


class ExportAccountRequest(BaseModel):
    save_folder: str  # Folder ที่จะบันทึกไฟล์
    filename: str     # ชื่อไฟล์ที่ต้องการ
    device_serial: str = None  # Optional: device ที่จะดึงข้อมูล


@router.post("/daily-login/export-account")
async def export_account(request: ExportAccountRequest):
    """
    ดึงไฟล์ account XML จาก device และบันทึกเป็นไฟล์ใหม่
    
    - save_folder: Folder ที่จะบันทึกไฟล์
    - filename: ชื่อไฟล์ที่ต้องการ (เช่น "my_account" หรือ "my_account.xml")
    - device_serial: Serial ของ device (optional, ใช้ default ถ้าไม่ระบุ)
    """
    service = get_daily_login_service()
    result = service.export_account(
        save_folder=request.save_folder,
        filename=request.filename,
        device_serial=request.device_serial
    )
    
    return {
        "success": result["success"],
        "filepath": result["filepath"],
        "message": result["message"]
    }
