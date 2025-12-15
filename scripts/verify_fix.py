import sys
import os
import asyncio
from loguru import logger

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.adb_service import AdbService

async def test_adb():
    logger.info("Initializing AdbService...")
    adb = AdbService()
    
    logger.info("Connecting...")
    if not adb.connect():
        logger.error("Failed to connect!")
        return
        
    logger.info(f"Connected: {adb.is_connected}")
    
    package = "com.linecorp.LGBJM"
    logger.info(f"Attempting to start app: {package}")
    
    # Try start_app
    success = adb.start_app(package)
    if success:
        logger.success("App started successfully!")
    else:
        logger.error("Failed to start app.")

if __name__ == "__main__":
    asyncio.run(test_adb())
