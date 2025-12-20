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
                encoding='utf-8',
                errors='replace',
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
                    encoding='utf-8',
                    errors='replace',
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
            logger.info(f"Tapping at ({x}, {y}) on device {self.device_address}")
            result = subprocess.run(
                ["adb", "-s", self.device_address, "shell", "input", "tap", str(x), str(y)],
                capture_output=True,
                timeout=5
            )
            if result.returncode != 0:
                logger.error(f"Tap failed: {result.stderr.decode()}")
                return False
            logger.info(f"Tap successful at ({x}, {y})")
            return True
        except Exception as e:
            logger.error(f"Tap error: {e}")
            return False
    
    def press_key(self, keycode: str) -> bool:
        """Press an Android key (e.g., KEYCODE_BACK, KEYCODE_HOME)."""
        cmd = [
            "adb", "-s", self.device_address,
            "shell", "input", "keyevent", keycode
        ]
        
        try:
            result = subprocess.run(cmd, capture_output=True, timeout=5)
            return result.returncode == 0
        except Exception as e:
            logger.error(f"Failed to press key {keycode}: {e}")
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
                encoding='utf-8',
                errors='replace',
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
    
    def push_file(self, local_path: str, remote_path: str) -> bool:
        """Push a file to the device."""
        try:
            result = subprocess.run(
                ["adb", "-s", self.device_address, "push", local_path, remote_path],
                capture_output=True,
                encoding='utf-8', 
                errors='replace',
                timeout=30
            )
            if result.returncode == 0:
                logger.success(f"Pushed {local_path} to {remote_path}")
                return True
            else:
                logger.error(f"Push failed: {result.stderr}")
                return False
        except Exception as e:
            logger.error(f"Push file error: {e}")
            return False
    
    def pull_file(self, remote_path: str, local_path: str) -> bool:
        """Pull a file from the device to local."""
        try:
            result = subprocess.run(
                ["adb", "-s", self.device_address, "pull", remote_path, local_path],
                capture_output=True,
                encoding='utf-8', 
                errors='replace',
                timeout=30
            )
            if result.returncode == 0:
                logger.success(f"Pulled {remote_path} to {local_path}")
                return True
            else:
                logger.error(f"Pull failed: {result.stderr}")
                return False
        except Exception as e:
            logger.error(f"Pull file error: {e}")
            return False
    
    def shell(self, command: str) -> str:
        """Run a shell command without root."""
        try:
            result = subprocess.run(
                ["adb", "-s", self.device_address, "shell", command],
                capture_output=True,
                encoding='utf-8',
                errors='replace',
                timeout=30
            )
            return result.stdout + result.stderr
        except Exception as e:
            logger.error(f"Shell error: {e}")
            return ""
    
    def shell_su(self, command: str) -> Tuple[bool, str]:
        """Run a shell command with root (su) privileges."""
        try:
            # Wrap command in quotes for su -c as it expects the entire command as one argument
            # Use double quotes to wrap, escape any existing double quotes in the command
            escaped_command = command.replace('"', '\\"')
            full_shell_cmd = f'su -c "{escaped_command}"'
            
            logger.debug(f"Running: adb -s {self.device_address} shell {full_shell_cmd}")
            
            result = subprocess.run(
                ["adb", "-s", self.device_address, "shell", full_shell_cmd],
                capture_output=True,
                encoding='utf-8',
                errors='replace',
                timeout=30
            )
            success = result.returncode == 0
            output = result.stdout + result.stderr
            if success:
                logger.debug(f"Shell su command succeeded: {command}")
            else:
                logger.warning(f"Shell su failed: {output}")
            return success, output
        except Exception as e:
            logger.error(f"Shell su error: {e}")
            return False, str(e)
    
    def force_stop_app(self, package: str) -> bool:
        """Force stop an application."""
        try:
            subprocess.run(
                ["adb", "-s", self.device_address, "shell", "am", "force-stop", package],
                capture_output=True,
                timeout=10
            )
            logger.info(f"Force stopped: {package}")
            return True
        except Exception as e:
            logger.error(f"Force stop error: {e}")
            return False
    
    def start_app(self, package: str, activity: str = None) -> bool:
        """Start an application with multiple fallback methods."""
        try:
            # Method 1: If activity is specified, use am start directly
            if activity:
                cmd = ["adb", "-s", self.device_address, "shell", "am", "start", "-n", f"{package}/{activity}"]
                logger.debug(f"Method 1: Running command: {' '.join(cmd)}")
                result = subprocess.run(cmd, capture_output=True, encoding='utf-8', errors='replace', timeout=10)
                
                if result.returncode == 0 and "Error" not in result.stdout:
                    logger.info(f"Started (method 1): {package}")
                    return True
        
            # Method 2: Try to find and launch main activity using pm dump
            logger.debug(f"Method 2: Trying to find launcher activity...")
            dump_cmd = ["adb", "-s", self.device_address, "shell", "pm", "dump", package]
            # Use utf-8 with replace to avoid UnicodeDecodeError on Windows/Thai locale
            dump_result = subprocess.run(dump_cmd, capture_output=True, encoding='utf-8', errors='replace', timeout=15)
            
            detected_activity = None
            if dump_result.returncode == 0 and dump_result.stdout:
                # Parse for MAIN/LAUNCHER activity
                lines = dump_result.stdout.split('\n')
                for i, line in enumerate(lines):
                    if 'android.intent.action.MAIN' in line:
                        # Look at next few lines for activity
                        for j in range(1, 10): # Check next 10 lines
                            if i + j >= len(lines):
                                break
                            next_line = lines[i+j].strip()
                            if package in next_line and '/' in next_line:
                                # Extract component name: com.package/.Activity or .Activity
                                import re
                                match = re.search(f'({package}/[^ ]+)', next_line)
                                if match:
                                    detected_activity = match.group(1)
                                    logger.debug(f"Found activity via dump: {detected_activity}")
                                    break
                                # Try simpler match if package name not repeated fully
                                match = re.search(r' ([^ ]+/[^ ]+) ', next_line)
                                if match and package in match.group(1):
                                    detected_activity = match.group(1)
                                    logger.debug(f"Found activity via dump (alt): {detected_activity}")
                                    break
                        if detected_activity:
                            break
            
            if detected_activity:
                cmd = ["adb", "-s", self.device_address, "shell", "am", "start", "-n", detected_activity]
                result = subprocess.run(cmd, capture_output=True, encoding='utf-8', errors='replace', timeout=10)
                if result.returncode == 0 and "Error" not in result.stdout:
                    logger.info(f"Started (method 2 - detected): {package}")
                    return True
        
            # Method 3: Use am start with implicit intent
            logger.debug(f"Method 3: Using implicit intent...")
            cmd = ["adb", "-s", self.device_address, "shell", "am", "start", 
                   "-a", "android.intent.action.MAIN",
                   "-c", "android.intent.category.LAUNCHER",
                   "-n", f"{package}/.MainActivity"]
            
            result = subprocess.run(cmd, capture_output=True, encoding='utf-8', errors='replace', timeout=10)
            if result.returncode == 0 and "Error" not in result.stdout:
                logger.info(f"Started (method 3): {package}")
                return True
            
            # Method 3.5: Implicit intent without activity inference (let system resolve)
            logger.debug(f"Method 3.5: Implicit intent (package only)...")
            cmd = ["adb", "-s", self.device_address, "shell", "am", "start", 
                   "-a", "android.intent.action.MAIN",
                   "-c", "android.intent.category.LAUNCHER", 
                   package]
            result = subprocess.run(cmd, capture_output=True, encoding='utf-8', errors='replace', timeout=10)
            if result.returncode == 0 and "Error" not in result.stdout:
                 logger.info(f"Started (method 3.5): {package}")
                 return True

            # Method 4: Use monkey (with category)
            logger.debug(f"Method 4: Using monkey with category...")
            cmd = ["adb", "-s", self.device_address, "shell", "monkey", 
                   "-p", package, 
                   "-c", "android.intent.category.LAUNCHER", 
                   "1"]
            
            result = subprocess.run(cmd, capture_output=True, encoding='utf-8', errors='replace', timeout=10)
            
            # Log output for debugging
            if result.stdout:
                logger.debug(f"Monkey stdout: {result.stdout}")
            if result.stderr:
                logger.warning(f"Monkey stderr: {result.stderr}")
            
            # Monkey might fail but app could still launch
            # Check if app is now in foreground
            check_cmd = ["adb", "-s", self.device_address, "shell", "dumpsys", "window", "windows"]
            check_result = subprocess.run(check_cmd, capture_output=True, encoding='utf-8', errors='replace', timeout=5)
            
            if package in check_result.stdout:
                logger.info(f"Started (monkey): {package}")
                return True
            
            # All methods failed
            logger.error(f"All methods failed to start: {package}")
            return False
            
        except Exception as e:
            logger.error(f"Start app error: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return False
    
    def copy_file_with_root(self, source: str, dest: str) -> bool:
        """Copy a file with root privileges (useful for /data/data/ paths)."""
        success, _ = self.shell_su(f"cp '{source}' '{dest}'")
        if success:
            # Set proper permissions
            self.shell_su(f"chmod 660 '{dest}'")
            # Get the correct owner from the parent directory (shared_prefs)
            parent_dir = dest.rsplit('/', 1)[0]
            _, stat_output = self.shell_su(f"stat -c '%U:%G' '{parent_dir}'")
            owner = stat_output.strip() if stat_output.strip() else "system:system"
            self.shell_su(f"chown {owner} '{dest}'")
        return success
