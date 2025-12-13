"""
Bot Lifecycle Manager - Controls the main bot loop and state.
"""
import asyncio
import threading
from datetime import datetime
from typing import Callable, Optional, List
from loguru import logger

from app.schemas.status import BotState, BotStatus
from app.services import AdbService, VisionService
from app.config import BOT_LOOP_INTERVAL, ADB_HOST, ADB_PORT, ADB_DEVICE_SERIAL


class BotLifecycle:
    """Manages the bot's lifecycle: start, stop, pause, and the main loop."""
    
    def __init__(self):
        self.adb = AdbService(host=ADB_HOST, port=ADB_PORT, device_serial=ADB_DEVICE_SERIAL)
        self.vision = VisionService()
        self._status = BotStatus()
        self._loop_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._pause_event = threading.Event()
        self._log_callbacks: List[Callable[[str], None]] = []
    
    @property
    def status(self) -> BotStatus:
        return self._status
    
    def add_log_callback(self, callback: Callable[[str], None]):
        """Register a callback to receive log messages."""
        self._log_callbacks.append(callback)
    
    def _emit_log(self, message: str):
        """Send log message to all registered callbacks."""
        for callback in self._log_callbacks:
            try:
                callback(message)
            except:
                pass
    
    def start(self) -> bool:
        """Start the bot loop."""
        if self._status.state == BotState.RUNNING:
            logger.warning("Bot is already running")
            return False
        
        # Connect to ADB
        if not self.adb.connect():
            self._status.state = BotState.ERROR
            self._status.message = "Failed to connect to ADB"
            self._emit_log("❌ ADB Connection Failed")
            return False
        
        self._status.adb_connected = True
        self._stop_event.clear()
        self._pause_event.clear()
        
        # Start the loop in a separate thread
        self._loop_thread = threading.Thread(target=self._run_loop, daemon=True)
        self._loop_thread.start()
        
        self._status.state = BotState.RUNNING
        self._status.message = "Bot started successfully"
        self._emit_log("✅ Bot Started")
        logger.success("Bot started")
        return True
    
    def stop(self) -> bool:
        """Stop the bot loop."""
        if self._status.state == BotState.STOPPED:
            return True
        
        self._stop_event.set()
        if self._loop_thread and self._loop_thread.is_alive():
            self._loop_thread.join(timeout=5)
        
        self.adb.disconnect()
        self._status.state = BotState.STOPPED
        self._status.adb_connected = False
        self._status.current_action = "Idle"
        self._status.message = "Bot stopped"
        self._emit_log("🛑 Bot Stopped")
        logger.info("Bot stopped")
        return True
    
    def pause(self) -> bool:
        """Pause the bot loop."""
        if self._status.state != BotState.RUNNING:
            return False
        
        self._pause_event.set()
        self._status.state = BotState.PAUSED
        self._emit_log("⏸️ Bot Paused")
        logger.info("Bot paused")
        return True
    
    def resume(self) -> bool:
        """Resume the bot loop."""
        if self._status.state != BotState.PAUSED:
            return False
        
        self._pause_event.clear()
        self._status.state = BotState.RUNNING
        self._emit_log("▶️ Bot Resumed")
        logger.info("Bot resumed")
        return True
    
    def _run_loop(self):
        """Main bot loop - runs in a separate thread."""
        logger.info("Bot loop started")
        
        while not self._stop_event.is_set():
            # Check if paused
            if self._pause_event.is_set():
                self._stop_event.wait(0.5)
                continue
            
            try:
                self._process_frame()
                self._status.loop_count += 1
                self._status.last_update = datetime.now()
            except Exception as e:
                logger.error(f"Loop error: {e}")
                self._emit_log(f"⚠️ Error: {str(e)}")
            
            self._stop_event.wait(BOT_LOOP_INTERVAL)
        
        logger.info("Bot loop ended")
    
    def _process_frame(self):
        """Process a single frame - override this for game-specific logic."""
        # Take screenshot
        screen = self.adb.screenshot()
        if screen is None:
            self._status.current_action = "Waiting for screen..."
            return
        
        self._status.current_action = "Scanning..."
        self._emit_log(f"🔍 Loop #{self._status.loop_count}: Scanning screen")
        
        # TODO: Add game-specific logic here
        # Example:
        # result = self.vision.find_template(screen, self.templates['start_button'])
        # if result:
        #     x, y, _ = result
        #     self.adb.tap(x, y)
