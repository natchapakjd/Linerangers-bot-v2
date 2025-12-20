"""
Multi-Device Service - Orchestrates parallel account processing across multiple devices.
"""
import threading
import time
from typing import List, Dict, Optional, Set, Callable
from dataclasses import dataclass, field
from enum import Enum
from loguru import logger

from app.services.daily_login_service import DailyLoginService, AccountInfo, DailyLoginState


class MultiDeviceState(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    COMPLETED = "completed"
    ERROR = "error"


@dataclass
class DeviceProgress:
    """Progress info for a single device."""
    serial: str
    current_account: str = ""
    processed_count: int = 0
    success_count: int = 0
    error_count: int = 0
    is_running: bool = False
    last_error: str = ""


class SharedAccountQueue:
    """Thread-safe queue for distributing accounts across multiple devices."""
    
    def __init__(self):
        self._accounts: List[AccountInfo] = []
        self._current_index = 0
        self._processed: Set[str] = set()  # filenames that have been processed
        self._lock = threading.Lock()
        self._folder_path: str = ""
        self.move_on_complete: bool = True  # Move files to 'done' folder after processing
        self.custom_done_folder: str = ""  # Custom path for done folder, empty = auto-create subfolder
    
    @property
    def total_count(self) -> int:
        return len(self._accounts)
    
    @property
    def processed_count(self) -> int:
        return len(self._processed)
    
    @property
    def remaining_count(self) -> int:
        return self.total_count - self.processed_count
    
    def load_accounts(self, folder_path: str) -> int:
        """Load accounts from folder into the queue."""
        from pathlib import Path
        
        self._folder_path = folder_path
        self._accounts = []
        self._current_index = 0
        self._processed = set()
        
        path = Path(folder_path)
        if not path.exists() or not path.is_dir():
            logger.error(f"Invalid folder: {folder_path}")
            return 0
        
        # Find all XML files
        for xml_file in sorted(path.glob("*.xml")):
            self._accounts.append(AccountInfo(
                filename=xml_file.name,
                filepath=str(xml_file)
            ))
        
        logger.info(f"Loaded {len(self._accounts)} accounts into shared queue")
        return len(self._accounts)
    
    def get_next_account(self) -> Optional[AccountInfo]:
        """Get the next unprocessed account (thread-safe)."""
        with self._lock:
            while self._current_index < len(self._accounts):
                account = self._accounts[self._current_index]
                self._current_index += 1
                
                # Skip if already processed (shouldn't happen but safety check)
                if account.filename not in self._processed:
                    return account
            
            return None  # No more accounts
    
    def mark_processed(self, filename: str, success: bool = True):
        """Mark an account as processed."""
        with self._lock:
            self._processed.add(filename)
            # Update the account status
            for acc in self._accounts:
                if acc.filename == filename:
                    acc.processed = True
                    acc.success = success
                    break
    
    def reset(self):
        """Reset the queue for a new run."""
        with self._lock:
            self._current_index = 0
            self._processed = set()
            for acc in self._accounts:
                acc.processed = False
                acc.success = False
                acc.error_message = ""
    
    def prepare_for_resume(self):
        """Prepare the queue for resume by resetting index but keeping processed status.
        
        This allows get_next_account() to scan from the beginning and skip
        already processed accounts.
        """
        with self._lock:
            self._current_index = 0
    
    def get_accounts_status(self) -> List[dict]:
        """Get status of all accounts."""
        return [
            {
                "filename": acc.filename,
                "processed": acc.processed,
                "success": acc.success,
                "error_message": acc.error_message
            }
            for acc in self._accounts
        ]
    
    def move_to_done(self, filename: str) -> bool:
        """Move a processed file to the done folder."""
        from pathlib import Path
        import shutil
        
        with self._lock:
            # Find the account
            account = None
            for acc in self._accounts:
                if acc.filename == filename:
                    account = acc
                    break
            
            if not account:
                logger.warning(f"Account {filename} not found in queue")
                return False
            
            source = Path(account.filepath)
            if not source.exists():
                logger.warning(f"Source file {source} does not exist")
                return False
            
            # Use custom folder or create 'done' subfolder
            if self.custom_done_folder:
                done_folder = Path(self.custom_done_folder)
            else:
                done_folder = source.parent / "done"
            
            # Create folder if not exists
            done_folder.mkdir(parents=True, exist_ok=True)
            
            # Move file
            dest = done_folder / filename
            try:
                shutil.move(str(source), str(dest))
                account.filepath = str(dest)  # Update filepath
                logger.info(f"Moved {filename} to {done_folder}")
                return True
            except Exception as e:
                logger.error(f"Failed to move {filename}: {e}")
                return False
    
    def mark_as_bugged(self, filename: str) -> bool:
        """Mark a file as bugged and delete it from disk."""
        from pathlib import Path
        
        with self._lock:
            # Find the account
            account = None
            account_index = -1
            for i, acc in enumerate(self._accounts):
                if acc.filename == filename:
                    account = acc
                    account_index = i
                    break
            
            if not account:
                logger.warning(f"Account {filename} not found in queue")
                return False
            
            source = Path(account.filepath)
            
            # Delete file from disk
            try:
                if source.exists():
                    source.unlink()
                    logger.info(f"Deleted bugged file: {filename}")
                
                # Remove from accounts list
                self._accounts.pop(account_index)
                
                # Add to processed to skip if somehow re-scanned
                self._processed.add(filename)
                
                return True
            except Exception as e:
                logger.error(f"Failed to delete {filename}: {e}")
                return False


class MultiDeviceOrchestrator:
    """Orchestrates daily login across multiple devices in parallel."""
    
    def __init__(self):
        self.queue = SharedAccountQueue()
        self._devices: Dict[str, DailyLoginService] = {}
        self._device_progress: Dict[str, DeviceProgress] = {}
        self._state = MultiDeviceState.IDLE
        self._stop_event = threading.Event()
        self._threads: Dict[str, threading.Thread] = {}
        self._log_callbacks: List[Callable[[str], None]] = []
        self._workflow_id: Optional[int] = None
        self._workflow_steps: List[dict] = []
    
    @property
    def state(self) -> MultiDeviceState:
        return self._state
    
    def add_log_callback(self, callback: Callable[[str], None]):
        """Register a callback for log messages."""
        self._log_callbacks.append(callback)
    
    def _emit_log(self, message: str):
        """Send log to all callbacks."""
        for cb in self._log_callbacks:
            try:
                cb(message)
            except:
                pass
    
    async def load_workflow(self, mode_name: str = "daily-login"):
        """Load workflow for the specified mode."""
        from app.services.workflow_service import get_workflow_service
        
        workflow_service = get_workflow_service()
        workflow = await workflow_service.get_workflow_for_mode(mode_name)
        
        if workflow and workflow.get("steps"):
            self._workflow_id = workflow["id"]
            self._workflow_steps = workflow["steps"]
            logger.info(f"Loaded workflow #{self._workflow_id} with {len(self._workflow_steps)} steps")
            return True
        
        logger.warning(f"No workflow found for mode: {mode_name}")
        return False
    
    def scan_folder(self, folder_path: str) -> int:
        """Scan folder and load accounts into shared queue."""
        count = self.queue.load_accounts(folder_path)
        self._emit_log(f"📂 Loaded {count} accounts into shared queue")
        return count
    
    def start(self, device_serials: List[str], resume: bool = False) -> bool:
        """
        Start parallel processing on multiple devices.
        
        Args:
            device_serials: List of ADB device serials to use
            resume: If True, continue from where stopped instead of resetting
        """
        if self._state == MultiDeviceState.RUNNING:
            logger.warning("Multi-device processing already running")
            return False
        
        if self.queue.total_count == 0:
            logger.error("No accounts in queue. Scan folder first.")
            return False
        
        if not device_serials:
            logger.error("No devices specified")
            return False
        
        # Reset queue only if not resuming
        if resume:
            remaining = self.queue.remaining_count
            if remaining == 0:
                logger.info("All accounts already processed, resetting for new run...")
                self.queue.reset()
            else:
                # Reset index to scan from beginning, but keep processed status
                # This allows get_next_account() to skip already processed accounts
                self.queue.prepare_for_resume()
                self._emit_log(f"▶️ Resuming from account #{self.queue.processed_count + 1} ({remaining} remaining)")
        else:
            self.queue.reset()
        
        self._stop_event.clear()
        self._state = MultiDeviceState.RUNNING
        self._devices = {}
        self._device_progress = {}
        self._threads = {}
        
        self._emit_log(f"🚀 Starting multi-device processing on {len(device_serials)} devices")
        
        # Create and start a thread for each device
        for serial in device_serials:
            # Create service for this device
            service = DailyLoginService()
            service.adb.device_address = serial
            
            # Set workflow
            if self._workflow_steps:
                service.workflow_id = self._workflow_id
                service.workflow_steps = self._workflow_steps
                self._emit_log(f"📋 Device {serial}: Using workflow #{self._workflow_id}")
            
            # Forward logs
            service.add_log_callback(lambda msg, s=serial: self._emit_log(f"[{s}] {msg}"))
            
            self._devices[serial] = service
            self._device_progress[serial] = DeviceProgress(serial=serial, is_running=True)
            
            # Start worker thread
            thread = threading.Thread(
                target=self._device_worker,
                args=(serial, service),
                daemon=True
            )
            self._threads[serial] = thread
            thread.start()
            
            self._emit_log(f"✅ Device {serial}: Started")
        
        return True
    
    def _device_worker(self, serial: str, service: DailyLoginService):
        """Worker thread for a single device - pulls accounts from queue."""
        logger.info(f"[{serial}] Worker started")
        progress = self._device_progress[serial]
        
        # Connect to ADB
        if not service.adb.connect():
            progress.is_running = False
            progress.last_error = "ADB connection failed"
            self._emit_log(f"[{serial}] ❌ ADB connection failed")
            return
        
        while not self._stop_event.is_set():
            # Get next account from queue
            account = self.queue.get_next_account()
            
            if account is None:
                # No more accounts
                logger.info(f"[{serial}] No more accounts in queue")
                break
            
            progress.current_account = account.filename
            self._emit_log(f"[{serial}] 📝 Processing: {account.filename}")
            
            try:
                # Process the account
                success = service._process_account(account)
                
                # Mark as processed AFTER processing completes
                # This ensures if we stop mid-processing, the account will be re-processed on resume
                self.queue.mark_processed(account.filename, success=success)
                
                if success:
                    progress.success_count += 1
                    self._emit_log(f"[{serial}] ✅ {account.filename} - Done")
                    # Move to 'done' folder if enabled
                    if self.queue.move_on_complete:
                        if self.queue.move_to_done(account.filename):
                            self._emit_log(f"[{serial}] 📁 Moved to done folder")
                else:
                    progress.error_count += 1
                    self._emit_log(f"[{serial}] ⚠️ {account.filename} - Failed")
                
                progress.processed_count += 1
                
            except Exception as e:
                # Mark as processed even on error to avoid infinite retry
                self.queue.mark_processed(account.filename, success=False)
                progress.processed_count += 1
                progress.error_count += 1
                progress.last_error = str(e)
                self._emit_log(f"[{serial}] ❌ {account.filename} - Error: {e}")
                logger.error(f"[{serial}] Process account error: {e}")
            
            # Small delay between accounts
            if not self._stop_event.is_set():
                time.sleep(2)
        
        progress.is_running = False
        progress.current_account = ""
        logger.info(f"[{serial}] Worker finished. Processed: {progress.processed_count}")
        self._emit_log(f"[{serial}] 🏁 Finished. Processed: {progress.processed_count}")
        
        # Check if all workers are done
        self._check_completion()
    
    def _check_completion(self):
        """Check if all workers have completed."""
        all_done = all(not p.is_running for p in self._device_progress.values())
        if all_done and self._state == MultiDeviceState.RUNNING:
            self._state = MultiDeviceState.COMPLETED
            total = sum(p.processed_count for p in self._device_progress.values())
            success = sum(p.success_count for p in self._device_progress.values())
            self._emit_log(f"🏁 All devices completed! Total: {total}, Success: {success}")
    
    def stop(self) -> bool:
        """Stop all devices."""
        if self._state != MultiDeviceState.RUNNING:
            return False
        
        self._emit_log("🛑 Stopping all devices...")
        self._stop_event.set()
        
        # Stop each device's service
        for serial, service in self._devices.items():
            try:
                service.stop()
            except:
                pass
        
        # Wait for threads to finish (with timeout)
        for serial, thread in self._threads.items():
            thread.join(timeout=5)
        
        self._state = MultiDeviceState.IDLE
        self._emit_log("🛑 All devices stopped")
        return True
    
    def get_status(self) -> dict:
        """Get current status of multi-device processing."""
        return {
            "state": self._state.value,
            "folder_path": self.queue._folder_path,
            "total_accounts": self.queue.total_count,
            "processed_count": self.queue.processed_count,
            "remaining_count": self.queue.remaining_count,
            "workflow_id": self._workflow_id,
            "devices": [
                {
                    "serial": p.serial,
                    "current_account": p.current_account,
                    "processed_count": p.processed_count,
                    "success_count": p.success_count,
                    "error_count": p.error_count,
                    "is_running": p.is_running,
                    "last_error": p.last_error
                }
                for p in self._device_progress.values()
            ],
            "accounts": self.queue.get_accounts_status()
        }


# Singleton instance
_multi_device_orchestrator: Optional[MultiDeviceOrchestrator] = None


def get_multi_device_orchestrator() -> MultiDeviceOrchestrator:
    """Get or create multi-device orchestrator instance."""
    global _multi_device_orchestrator
    if _multi_device_orchestrator is None:
        _multi_device_orchestrator = MultiDeviceOrchestrator()
    return _multi_device_orchestrator
