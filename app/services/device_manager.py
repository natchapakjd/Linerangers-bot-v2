"""
Device Manager Service - Manages multiple ADB devices and task assignments.
"""
import subprocess
from typing import List, Optional, Dict
from dataclasses import dataclass, field
from enum import Enum
from loguru import logger


class DeviceTask(str, Enum):
    """Tasks that can be assigned to a device."""
    NONE = "none"
    DAILY_LOGIN = "daily_login"
    RE_ID = "re_id"


class DeviceStatus(str, Enum):
    """Device connection status."""
    ONLINE = "online"
    OFFLINE = "offline"
    UNAUTHORIZED = "unauthorized"


@dataclass
class DeviceInfo:
    """Information about an ADB device."""
    serial: str
    status: DeviceStatus = DeviceStatus.OFFLINE
    assigned_task: DeviceTask = DeviceTask.NONE
    screen_size: str = ""  # e.g., "960x540"
    is_running: bool = False
    
    def to_dict(self) -> dict:
        return {
            "serial": self.serial,
            "status": self.status.value,
            "assigned_task": self.assigned_task.value,
            "screen_size": self.screen_size,
            "is_running": self.is_running
        }


class DeviceManager:
    """Manages multiple ADB devices and their task assignments."""
    
    def __init__(self):
        self._devices: Dict[str, DeviceInfo] = {}
        self._task_services: Dict[str, any] = {}  # device_serial -> service instance
    
    @property
    def devices(self) -> List[DeviceInfo]:
        """Get all known devices."""
        return list(self._devices.values())
    
    def refresh_devices(self) -> List[DeviceInfo]:
        """Scan for ADB devices and update the device list."""
        try:
            result = subprocess.run(
                ["adb", "devices", "-l"],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            new_devices: Dict[str, DeviceInfo] = {}
            
            for line in result.stdout.strip().split('\n')[1:]:  # Skip header
                if not line.strip():
                    continue
                    
                parts = line.split()
                if len(parts) >= 2:
                    serial = parts[0]
                    status_str = parts[1]
                    
                    # Determine status
                    if status_str == "device":
                        status = DeviceStatus.ONLINE
                    elif status_str == "offline":
                        status = DeviceStatus.OFFLINE
                    elif status_str == "unauthorized":
                        status = DeviceStatus.UNAUTHORIZED
                    else:
                        status = DeviceStatus.OFFLINE
                    
                    # Keep existing device info or create new
                    if serial in self._devices:
                        device = self._devices[serial]
                        device.status = status
                    else:
                        device = DeviceInfo(serial=serial, status=status)
                    
                    # Get screen size for online devices
                    if status == DeviceStatus.ONLINE and not device.screen_size:
                        device.screen_size = self._get_screen_size(serial)
                    
                    new_devices[serial] = device
            
            self._devices = new_devices
            logger.info(f"Found {len(self._devices)} devices")
            return self.devices
            
        except FileNotFoundError:
            logger.error("ADB not found. Please install Android Platform Tools.")
            return []
        except Exception as e:
            logger.error(f"Error refreshing devices: {e}")
            return []
    
    def _get_screen_size(self, serial: str) -> str:
        """Get screen size for a device."""
        try:
            result = subprocess.run(
                ["adb", "-s", serial, "shell", "wm", "size"],
                capture_output=True,
                text=True,
                timeout=5
            )
            # Parse "Physical size: 960x540"
            if "x" in result.stdout:
                size_str = result.stdout.split(":")[-1].strip()
                return size_str
            return ""
        except Exception:
            return ""
    
    def get_device(self, serial: str) -> Optional[DeviceInfo]:
        """Get device info by serial."""
        return self._devices.get(serial)
    
    def assign_task(self, serial: str, task: DeviceTask) -> bool:
        """Assign a task to a device."""
        device = self._devices.get(serial)
        if not device:
            logger.warning(f"Device {serial} not found")
            return False
        
        device.assigned_task = task
        logger.info(f"Assigned {task.value} to {serial}")
        return True
    
    def get_devices_by_task(self, task: DeviceTask) -> List[DeviceInfo]:
        """Get all devices assigned to a specific task."""
        return [d for d in self._devices.values() if d.assigned_task == task]
    
    def set_running(self, serial: str, is_running: bool) -> None:
        """Set the running status of a device."""
        device = self._devices.get(serial)
        if device:
            device.is_running = is_running


# Singleton instance
_device_manager: Optional[DeviceManager] = None


def get_device_manager() -> DeviceManager:
    """Get or create device manager instance."""
    global _device_manager
    if _device_manager is None:
        _device_manager = DeviceManager()
    return _device_manager
