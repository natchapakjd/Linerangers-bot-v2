"""
ADB Service - Handles all Android Debug Bridge communication.
"""
import subprocess
from typing import Optional, Tuple
from loguru import logger
import numpy as np
import cv2


class AdbService:
    """Service class for ADB operations."""
    
    def __init__(self, host: str = "127.0.0.1", port: int = 5555, device_serial: str = None):
        self.host = host
        self.port = port
        # Use device_serial if provided, otherwise use host:port format
        self.device_address = device_serial if device_serial else f"{host}:{port}"
        self._connected = False
    
    @property
    def is_connected(self) -> bool:
        return self._connected
    
    def connect(self) -> bool:
        """Connect to the ADB device/emulator."""
        try:
            # First check if device is already available
            result = subprocess.run(
                ["adb", "devices"],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            # Check if our device is in the list
            if self.device_address in result.stdout:
                self._connected = True
                logger.success(f"Device {self.device_address} is available")
                return True
            
            # If not found and using host:port format, try to connect via TCP/IP
            if ":" in self.device_address:
                result = subprocess.run(
                    ["adb", "connect", self.device_address],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                if "connected" in result.stdout.lower():
                    self._connected = True
                    logger.success(f"Connected to {self.device_address}")
                    return True
                else:
                    logger.warning(f"Connection response: {result.stdout}")
                    return False
            
            logger.warning(f"Device {self.device_address} not found in: {result.stdout}")
            return False
        except FileNotFoundError:
            logger.error("ADB not found. Please install Android Platform Tools.")
            return False
        except Exception as e:
            logger.error(f"ADB connect error: {e}")
            return False
    
    def disconnect(self) -> bool:
        """Disconnect from the ADB device."""
        try:
            subprocess.run(["adb", "disconnect", self.device_address], capture_output=True)
            self._connected = False
            logger.info(f"Disconnected from {self.device_address}")
            return True
        except Exception as e:
            logger.error(f"ADB disconnect error: {e}")
            return False
    
    def tap(self, x: int, y: int) -> bool:
        """Tap at the specified coordinates."""
        try:
            subprocess.run(
                ["adb", "-s", self.device_address, "shell", "input", "tap", str(x), str(y)],
                capture_output=True,
                timeout=5
            )
            logger.debug(f"Tapped at ({x}, {y})")
            return True
        except Exception as e:
            logger.error(f"Tap error: {e}")
            return False
    
    def swipe(self, x1: int, y1: int, x2: int, y2: int, duration_ms: int = 300) -> bool:
        """Swipe from one point to another."""
        try:
            subprocess.run(
                ["adb", "-s", self.device_address, "shell", "input", "swipe", 
                 str(x1), str(y1), str(x2), str(y2), str(duration_ms)],
                capture_output=True,
                timeout=5
            )
            logger.debug(f"Swiped from ({x1},{y1}) to ({x2},{y2})")
            return True
        except Exception as e:
            logger.error(f"Swipe error: {e}")
            return False
    
    def screenshot(self) -> Optional[np.ndarray]:
        """Capture a screenshot and return as numpy array (OpenCV format)."""
        try:
            result = subprocess.run(
                ["adb", "-s", self.device_address, "exec-out", "screencap", "-p"],
                capture_output=True,
                timeout=10
            )
            if result.returncode == 0 and len(result.stdout) > 0:
                # Decode PNG bytes to numpy array
                nparr = np.frombuffer(result.stdout, np.uint8)
                img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                return img
            return None
        except Exception as e:
            logger.error(f"Screenshot error: {e}")
            return None
    
    def get_screen_size(self) -> Optional[Tuple[int, int]]:
        """Get the screen resolution."""
        try:
            result = subprocess.run(
                ["adb", "-s", self.device_address, "shell", "wm", "size"],
                capture_output=True,
                text=True,
                timeout=5
            )
            # Parse "Physical size: 1080x1920"
            if "x" in result.stdout:
                size_str = result.stdout.split(":")[-1].strip()
                w, h = size_str.split("x")
                return int(w), int(h)
            return None
        except Exception as e:
            logger.error(f"Get screen size error: {e}")
            return None
