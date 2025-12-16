"""
Daily Login Service - Manages account switching for daily login automation.
"""
import os
import threading
import time
from pathlib import Path
from typing import List, Optional, Callable
from dataclasses import dataclass, field
from enum import Enum
from loguru import logger

from app.services.adb_service import AdbService
from app.services.template_service import TemplateService, DailyClaimTemplates
from app.config import ADB_HOST, ADB_PORT, ADB_DEVICE_SERIAL


class DailyLoginState(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    ERROR = "error"


@dataclass
class AccountInfo:
    """Information about an account XML file."""
    filename: str
    filepath: str
    processed: bool = False
    success: bool = False
    error_message: str = ""


@dataclass  
class DailyLoginStatus:
    """Current status of daily login process."""
    state: DailyLoginState = DailyLoginState.IDLE
    folder_path: str = ""
    total_accounts: int = 0
    processed_count: int = 0
    current_account: str = ""
    accounts: List[AccountInfo] = field(default_factory=list)
    message: str = ""


# Line Rangers package info
LINERANGERS_PACKAGE = "com.linecorp.LGRGS"
LINERANGERS_PREF_PATH = "/data/data/com.linecorp.LGRGS/shared_prefs/_LINE_COCOS_PREF_KEY.xml"


class DailyLoginService:
    """Service to handle daily login automation with account switching."""
    
    def __init__(self):
        self.adb = AdbService(host=ADB_HOST, port=ADB_PORT, device_serial=ADB_DEVICE_SERIAL)
        self.template_service = TemplateService(threshold=0.6)  # Lower threshold for better matching
        self._status = DailyLoginStatus()
        self._stop_event = threading.Event()
        self._loop_thread: Optional[threading.Thread] = None
        self._log_callbacks: List[Callable[[str], None]] = []
        
        # Feature toggles
        self.auto_claim_enabled = True  # Enable auto claim by default
        
        # Workflow configuration - if set, run this workflow instead of auto_claim
        self.workflow_id: Optional[int] = None
        self.workflow_steps: List[dict] = []
        
        # Configurable delays
        self.delay_after_push = 2.0  # seconds after pushing XML
        self.delay_for_game_load = 60.0  # max seconds to wait for game to load
        self.delay_between_accounts = 5.0  # seconds between accounts
        self.template_check_interval = 2.0  # seconds between template checks
    
    @property
    def status(self) -> DailyLoginStatus:
        return self._status
    
    def add_log_callback(self, callback: Callable[[str], None]):
        """Register a callback to receive log messages."""
        self._log_callbacks.append(callback)
    
    def _emit_log(self, message: str):
        """Send log to all callbacks."""
        for cb in self._log_callbacks:
            try:
                cb(message)
            except:
                pass
    
    def scan_folder(self, folder_path: str) -> List[AccountInfo]:
        """Scan folder for XML account files."""
        accounts = []
        path = Path(folder_path)
        
        if not path.exists():
            self._status.message = f"Folder not found: {folder_path}"
            logger.error(self._status.message)
            return accounts
        
        if not path.is_dir():
            self._status.message = f"Not a directory: {folder_path}"
            logger.error(self._status.message)
            return accounts
        
        # Find all XML files
        for xml_file in path.glob("*.xml"):
            accounts.append(AccountInfo(
                filename=xml_file.name,
                filepath=str(xml_file)
            ))
        
        # Sort by filename
        accounts.sort(key=lambda x: x.filename)
        
        self._status.folder_path = folder_path
        self._status.accounts = accounts
        self._status.total_accounts = len(accounts)
        self._status.processed_count = 0
        self._status.message = f"Found {len(accounts)} XML files"
        
        logger.info(f"Scanned {folder_path}: found {len(accounts)} XML files")
        self._emit_log(f"📂 Found {len(accounts)} account files")
        
        return accounts
    
    def start(self) -> bool:
        """Start the daily login automation loop."""
        if self._status.state == DailyLoginState.RUNNING:
            return False
        
        if not self._status.accounts:
            self._status.message = "No accounts to process"
            return False
        
        # Connect to ADB
        if not self.adb.connect():
            self._status.state = DailyLoginState.ERROR
            self._status.message = "Failed to connect to ADB"
            self._emit_log("❌ ADB connection failed")
            return False
        
        self._stop_event.clear()
        self._status.state = DailyLoginState.RUNNING
        self._status.processed_count = 0
        
        # Reset processed status
        for acc in self._status.accounts:
            acc.processed = False
            acc.success = False
            acc.error_message = ""
        
        # Start loop thread
        self._loop_thread = threading.Thread(target=self._run_loop, daemon=True)
        self._loop_thread.start()
        
        self._emit_log("🚀 Daily Login started")
        return True
    
    def stop(self) -> bool:
        """Stop the automation loop."""
        self._stop_event.set()
        if self._loop_thread and self._loop_thread.is_alive():
            self._loop_thread.join(timeout=5)
        
        self._status.state = DailyLoginState.IDLE
        self._emit_log("🛑 Daily Login stopped")
        return True
    
    def _run_loop(self):
        """Main loop - process each account."""
        logger.info("Daily login loop started")
        
        for i, account in enumerate(self._status.accounts):
            if self._stop_event.is_set():
                break
            
            self._status.current_account = account.filename
            self._status.processed_count = i
            self._emit_log(f"📝 Processing account {i+1}/{self._status.total_accounts}: {account.filename}")
            
            try:
                success = self._process_account(account)
                account.processed = True
                account.success = success
                
                if success:
                    self._emit_log(f"✅ {account.filename} - Done")
                else:
                    self._emit_log(f"⚠️ {account.filename} - Failed")
                
            except Exception as e:
                account.processed = True
                account.success = False
                account.error_message = str(e)
                self._emit_log(f"❌ {account.filename} - Error: {e}")
                logger.error(f"Process account error: {e}")
            
            # Delay between accounts
            if not self._stop_event.is_set() and i < len(self._status.accounts) - 1:
                self._wait(self.delay_between_accounts)
        
        self._status.processed_count = len([a for a in self._status.accounts if a.processed])
        self._status.state = DailyLoginState.COMPLETED if not self._stop_event.is_set() else DailyLoginState.IDLE
        self._status.current_account = ""
        self._emit_log(f"🏁 Completed: {self._status.processed_count}/{self._status.total_accounts} accounts")
        logger.info("Daily login loop ended")
    
    def _process_account(self, account: AccountInfo) -> bool:
        """Process a single account - close game, push XML, restart game, claim rewards."""
        # Step 1: Force stop game FIRST (ensure clean state)
        self._emit_log(f"  ⏹️ Closing Line Rangers...")
        self.adb.force_stop_app(LINERANGERS_PACKAGE)
        self._wait(2)  # Wait for app to fully close
        
        # Step 2: Clear app cache to ensure fresh login (optional but recommended)
        self._emit_log(f"  🧹 Clearing app cache...")
        self.adb.shell_su(f"rm -rf /data/data/{LINERANGERS_PACKAGE}/cache/*")
        self._wait(1)
        
        # Step 3: Push XML to temp location
        temp_path = "/sdcard/_temp_lr_account.xml"
        self._emit_log(f"  📤 Pushing account file...")
        if not self.adb.push_file(account.filepath, temp_path):
            account.error_message = "Failed to push XML file"
            return False
        
        # Step 4: Copy with root to app's shared_prefs
        self._emit_log(f"  🔐 Replacing account data...")
        success = self.adb.copy_file_with_root(temp_path, LINERANGERS_PREF_PATH)
        if not success:
            account.error_message = "Failed to copy file with root"
            return False
        
        self._wait(self.delay_after_push)
        
        # Step 5: Start game fresh
        self._emit_log(f"  🎮 Starting Line Rangers...")
        self.adb.start_app(LINERANGERS_PACKAGE)
        
        # Step 6: Smart wait - wait until we detect a known UI element
        self._emit_log(f"  ⏳ Waiting for game to load...")
        if not self._wait_for_game_ready():
            self._emit_log(f"  ⚠️ Game load timeout, continuing anyway...")
        
        # Step 7: Run workflow or auto claim
        if self.workflow_steps:
            self._emit_log(f"  🔄 Running workflow ({len(self.workflow_steps)} steps)...")
            success = self._execute_workflow_steps()
            if not success:
                self._emit_log(f"  ⚠️ Workflow execution failed")
        elif self.auto_claim_enabled:
            self._claim_daily_rewards()
        else:
            # Just wait a fixed time if auto claim is disabled
            self._emit_log(f"  ⏳ Waiting {int(self.delay_for_game_load)}s...")
            self._wait(self.delay_for_game_load)
        
        # Step 8: Force stop after daily login is done
        self._emit_log(f"  ✅ Daily login complete, waiting before closing game...")
        self._wait(5)  # Wait 5 seconds for any pending actions to complete
        self._emit_log(f"  ⏹️ Closing game...")
        self.adb.force_stop_app(LINERANGERS_PACKAGE)
        
        return True
    
    def _wait_for_game_ready(self) -> bool:
        """Wait until game is loaded by detecting known UI elements."""
        start_time = time.time()
        timeout = self.delay_for_game_load
        
        while not self._stop_event.is_set():
            elapsed = time.time() - start_time
            if elapsed >= timeout:
                return False
            
            # Take screenshot
            screen = self.adb.screenshot()
            if screen is None:
                self._wait(self.template_check_interval)
                continue
            
            # Look for any known button (GIFTBOX, CLOSE, or OK)
            result = self.template_service.find_any_template(
                screen,
                [DailyClaimTemplates.GIFTBOX, DailyClaimTemplates.CLOSE, DailyClaimTemplates.OK]
            )
            
            if result:
                template_name, x, y = result
                self._emit_log(f"  ✅ Game loaded! Found: {template_name}")
                return True
            
            remaining = int(timeout - elapsed)
            if remaining % 5 == 0:  # Log every 5 seconds
                self._emit_log(f"  ⏳ Waiting for game... ({remaining}s remaining)")
            
            self._wait(self.template_check_interval)
        
        return False
    
    def _execute_workflow_steps(self) -> bool:
        """Execute workflow steps from self.workflow_steps."""
        if not self.workflow_steps:
            self._emit_log(f"  ⚠️ No workflow steps to execute")
            return False
        
        step_index = 0
        while step_index < len(self.workflow_steps) and not self._stop_event.is_set():
            step = self.workflow_steps[step_index]
            step_type = step.get("step_type", "")
            
            self._emit_log(f"  📍 Step {step_index + 1}/{len(self.workflow_steps)}: {step_type}")
            logger.info(f"Step {step_index + 1}: {step}")  # Log full step data
            
            try:
                if step_type == "start_game":
                    # Start game step - the game is already started by _process_account
                    # This step is a marker, just log and continue
                    self._emit_log(f"    ✅ Game already started (handled by process_account)")
                    
                elif step_type == "click":
                    self.adb.tap(step.get("x", 0), step.get("y", 0))
                    self._wait(0.3)
                
                elif step_type == "swipe":
                    self.adb.swipe(
                        step.get("x", 0), step.get("y", 0),
                        step.get("end_x", 0), step.get("end_y", 0),
                        step.get("swipe_duration_ms", 300)
                    )
                    self._wait(0.5)
                
                elif step_type == "wait":
                    wait_ms = step.get("wait_duration_ms", 1000)
                    self._wait(wait_ms / 1000)
                
                elif step_type in ["image_match", "find_all_click"]:
                    success = self._execute_image_step(step, step_type == "find_all_click")
                    if not success and not step.get("skip_if_not_found", False):
                        self._emit_log(f"  ❌ Image not found: {step.get('template_name', 'unknown')}")
                        return False
                
                elif step_type == "loop_click":
                    self._execute_loop_click_step(step)
                
                elif step_type == "wait_for_color":
                    # Skip if expected_color is not set
                    expected = step.get("expected_color")
                    if not expected:
                        self._emit_log(f"    ⚠️ No expected_color set, skipping wait_for_color")
                    else:
                        success = self._execute_wait_for_color_step(step)
                        if not success:
                            self._emit_log(f"  ❌ Color not matched at ({step.get('x')}, {step.get('y')})")
                            return False
                
                elif step_type == "press_back":
                    self.adb.press_key("KEYCODE_BACK")
                    self._wait(0.5)
                
                else:
                    self._emit_log(f"    ⚠️ Unknown step type: {step_type}, skipping...")
                
                step_index += 1
                
            except Exception as e:
                self._emit_log(f"  ❌ Error at step {step_index + 1}: {str(e)}")
                logger.error(f"Workflow step error: {e}")
                return False
        
        self._emit_log(f"  ✅ Workflow completed successfully")
        return True
    
    def _execute_image_step(self, step: dict, find_all: bool = False) -> bool:
        """Execute an image matching step with retry logic."""
        template_path = step.get("template_path", "")
        threshold = step.get("threshold", 0.8)
        max_wait = step.get("max_wait_seconds", 10)
        retry_interval = step.get("retry_interval", 1)
        
        self._emit_log(f"    🔍 Looking for: {step.get('template_name', template_path)} (threshold={threshold}, find_all={find_all})")
        
        start_time = time.time()
        
        while (time.time() - start_time) < max_wait and not self._stop_event.is_set():
            screen = self.adb.screenshot()
            if screen is None:
                self._emit_log(f"    ⚠️ Screenshot failed, retrying...")
                self._wait(retry_interval)
                continue
            
            if find_all:
                matches = self.template_service.find_all_templates(screen, template_path, threshold, max_matches=50)
                self._emit_log(f"    📊 Found {len(matches)} matches for find_all_click")
                if matches:
                    for i, match in enumerate(matches):
                        self._emit_log(f"    👆 Clicking match {i+1} at ({match[0]}, {match[1]})")
                        self.adb.tap(match[0], match[1])
                        self._wait(0.5)  # Slightly longer delay between clicks
                    # Wait for all popup animations to finish
                    self._emit_log(f"    ⏳ Waiting for animations to settle...")
                    self._wait(2.0)
                    return True
            else:
                result = self.template_service.find_template_fast(screen, template_path, threshold)
                if result:
                    self._emit_log(f"    ✅ Found at ({result[0]}, {result[1]})")
                    self.adb.tap(result[0], result[1])
                    self._wait(0.3)
                    return True
            
            self._wait(retry_interval)
        
        self._emit_log(f"    ❌ Not found after {max_wait}s of waiting")
        return False
    
    def _execute_loop_click_step(self, step: dict):
        """Execute a loop click step - keep clicking until template not found."""
        template_path = step.get("template_path", "")
        threshold = step.get("threshold", 0.8)
        max_iterations = step.get("max_iterations", 20)
        not_found_threshold = step.get("not_found_threshold", 3)
        click_delay = step.get("click_delay", 1.5)
        retry_delay = step.get("retry_delay", 2)
        
        iteration = 0
        not_found_count = 0
        
        while iteration < max_iterations and not self._stop_event.is_set():
            iteration += 1
            screen = self.adb.screenshot()
            if screen is None:
                self._wait(1)
                continue
            
            result = self.template_service.find_template_fast(screen, template_path, threshold)
            
            if result:
                self.adb.tap(result[0], result[1])
                not_found_count = 0
                self._wait(click_delay)
            else:
                not_found_count += 1
                if not_found_count >= not_found_threshold:
                    self._emit_log(f"  ✅ Loop complete ({iteration} iterations)")
                    break
                self._wait(retry_delay)
    
    def _execute_wait_for_color_step(self, step: dict) -> bool:
        """Wait until color at position matches expected color."""
        x = step.get("x", 0)
        y = step.get("y", 0)
        expected_color = step.get("expected_color")
        if expected_color is None:
            expected_color = [255, 255, 255]  # Default to white
        tolerance = step.get("tolerance", 30)
        max_wait = step.get("max_wait_seconds", 30)
        check_interval = step.get("check_interval", 1)
        
        start_time = time.time()
        
        while (time.time() - start_time) < max_wait and not self._stop_event.is_set():
            screen = self.adb.screenshot()
            if screen is None:
                self._wait(check_interval)
                continue
            
            h, w = screen.shape[:2]
            if y >= h or x >= w:
                return False
            
            pixel = screen[y, x]
            diff = abs(int(pixel[0]) - expected_color[0]) + \
                   abs(int(pixel[1]) - expected_color[1]) + \
                   abs(int(pixel[2]) - expected_color[2])
            
            if diff <= tolerance:
                return True
            
            self._wait(check_interval)
        
        return False
    
    def _claim_daily_rewards(self):
        """Auto claim daily rewards using template matching."""
        self._emit_log(f"  🎁 Starting auto claim...")
        self._emit_log(f"  📍 Looking for buttons: X, GIFTBOX, ACCEPT ALL, OK")
        logger.info(f"Auto claim starting. Templates: CLOSE={DailyClaimTemplates.CLOSE}")
        
        max_iterations = 20  # Safety limit
        iteration = 0
        no_button_count = 0  # Count consecutive "no button" iterations
        
        while not self._stop_event.is_set() and iteration < max_iterations:
            iteration += 1
            self._emit_log(f"  🔍 Scan #{iteration}...")
            
            # Take screenshot
            screen = self.adb.screenshot()
            if screen is None:
                self._emit_log(f"  ⚠️ Screenshot failed")
                self._wait(1)
                continue
            
            screen_h, screen_w = screen.shape[:2]
            self._emit_log(f"  📸 Screenshot: {screen_w}x{screen_h}")
            
            found_button = False
            
            # Priority 1: Close X buttons first (popups)
            pos = self.template_service.find_template(screen, DailyClaimTemplates.CLOSE)
            if pos:
                self._emit_log(f"  ❌ Found X button at ({pos[0]}, {pos[1]}), tapping...")
                self.adb.tap(pos[0], pos[1])
                self._wait(1.5)
                found_button = True
                no_button_count = 0
                continue
            
            # Priority 2: GIFTBOX to open rewards
            pos = self.template_service.find_template(screen, DailyClaimTemplates.GIFTBOX)
            if pos:
                self._emit_log(f"  🎁 Found GIFTBOX at ({pos[0]}, {pos[1]}), tapping...")
                self.adb.tap(pos[0], pos[1])
                self._wait(2)
                found_button = True
                no_button_count = 0
                continue
            
            # Priority 3: ACCEPT ALL to claim
            pos = self.template_service.find_template(screen, DailyClaimTemplates.ACCEPT_ALL)
            if pos:
                self._emit_log(f"  ✨ Found ACCEPT ALL at ({pos[0]}, {pos[1]}), tapping...")
                self.adb.tap(pos[0], pos[1])
                self._wait(2)
                found_button = True
                no_button_count = 0
                continue
            
            # Priority 4: OK to confirm
            pos = self.template_service.find_template(screen, DailyClaimTemplates.OK)
            if pos:
                self._emit_log(f"  👍 Found OK at ({pos[0]}, {pos[1]}), tapping...")
                self.adb.tap(pos[0], pos[1])
                self._wait(1.5)
                found_button = True
                no_button_count = 0
                continue
            
            # No buttons found this iteration
            if not found_button:
                no_button_count += 1
                self._emit_log(f"  ⏳ No buttons found ({no_button_count}/3)")
                
                # Exit after 3 consecutive "no button" iterations
                if no_button_count >= 3:
                    self._emit_log(f"  ✅ No more buttons found, claim complete!")
                    break
                    
                self._wait(2)
        
        if iteration >= max_iterations:
            self._emit_log(f"  ⚠️ Reached max iterations, stopping claim loop")
    
    def _wait_for_game_load(self):
        """Legacy: Wait for game to load with periodic screenshot updates."""
        remaining = self.delay_for_game_load
        interval = 5.0  # Update every 5 seconds
        
        while remaining > 0 and not self._stop_event.is_set():
            wait_time = min(interval, remaining)
            self._stop_event.wait(wait_time)
            remaining -= wait_time
            if remaining > 0:
                self._emit_log(f"  ⏳ {int(remaining)}s remaining...")
    
    def get_screenshot(self) -> Optional[bytes]:
        """Get current screenshot from device."""
        import cv2
        import base64
        
        if not self.adb.is_connected:
            if not self.adb.connect():
                return None
        
        screen = self.adb.screenshot()
        if screen is None:
            return None
        
        # Resize for preview (50%)
        h, w = screen.shape[:2]
        preview = cv2.resize(screen, (w // 2, h // 2))
        _, buffer = cv2.imencode('.jpg', preview, [cv2.IMWRITE_JPEG_QUALITY, 60])
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        return f"data:image/jpeg;base64,{img_base64}"
    
    def _wait(self, seconds: float):
        """Wait with stop event check."""
        self._stop_event.wait(seconds)


# Singleton instance
_daily_login_service: Optional[DailyLoginService] = None


def get_daily_login_service() -> DailyLoginService:
    """Get or create daily login service instance."""
    global _daily_login_service
    if _daily_login_service is None:
        _daily_login_service = DailyLoginService()
    return _daily_login_service
