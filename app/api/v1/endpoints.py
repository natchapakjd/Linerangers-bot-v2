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
