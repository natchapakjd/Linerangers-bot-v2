"""
Configuration settings for the Line Rangers Bot.
"""
from pathlib import Path

# Project paths
PROJECT_ROOT = Path(__file__).parent.parent
TEMPLATES_DIR = PROJECT_ROOT / "templates"

# ADB Settings
ADB_HOST = "127.0.0.1"
ADB_PORT = 5558  # Use 'adb devices' to find your emulator port (emulator-XXXX means port XXXX)
ADB_DEVICE_SERIAL = "emulator-5558"  # Or set to None to use host:port format

# Bot Settings
BOT_LOOP_INTERVAL = 0.5  # seconds between each loop iteration
MATCH_THRESHOLD = 0.8  # OpenCV template match threshold (0.0 - 1.0)

# Server Settings
API_HOST = "0.0.0.0"
API_PORT = 8000
