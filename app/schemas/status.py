"""
Pydantic models for data validation and serialization.
"""
from enum import Enum
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class BotState(str, Enum):
    STOPPED = "stopped"
    RUNNING = "running"
    PAUSED = "paused"
    ERROR = "error"


class BotStatus(BaseModel):
    state: BotState = BotState.STOPPED
    message: str = ""
    adb_connected: bool = False
    current_action: str = "Idle"
    loop_count: int = 0
    last_update: Optional[datetime] = None


class CommandResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None
