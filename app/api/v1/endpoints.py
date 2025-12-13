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
