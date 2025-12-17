"""
Configuration settings for the Line Rangers Bot.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

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

# ===== Security Settings (from environment) =====
SECRET_KEY = os.getenv("SECRET_KEY", "lrg-bot-secret-key-change-in-production-2024")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24 * 7  # 1 week

# Default admin credentials (only used if no admin exists in database)
DEFAULT_ADMIN_USERNAME = os.getenv("DEFAULT_ADMIN_USERNAME", "admin")
DEFAULT_ADMIN_PASSWORD = os.getenv("DEFAULT_ADMIN_PASSWORD", "ChangeThisPassword123!")

# ===== CORS Settings =====
_cors_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:4200,http://localhost:8000")
ALLOWED_ORIGINS = [origin.strip() for origin in _cors_origins.split(",")]

# ===== Rate Limiting Settings =====
RATE_LIMIT_LOGIN = int(os.getenv("RATE_LIMIT_LOGIN", "5"))
RATE_LIMIT_LICENSE = int(os.getenv("RATE_LIMIT_LICENSE", "10"))
RATE_LIMIT_GLOBAL = int(os.getenv("RATE_LIMIT_GLOBAL", "100"))

