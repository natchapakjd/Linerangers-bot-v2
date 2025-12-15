"""
Test script to verify start_game and restart_game functions
"""
import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.services.adb_service import AdbService

async def test_game_functions():
    """Test start_game and restart_game"""
    adb = AdbService()
    
    # Use emulator device
    adb.device_address = "emulator-5558"  # Hardcoded for now
    print(f"✓ Using device: {adb.device_address}")
    
    package = "com.linecorp.LGBJM"
    
    # Test 1: Force stop
    print(f"\n1️⃣ Testing force_stop_app({package})...")
    result = adb.force_stop_app(package)
    print(f"   Result: {result}")
    await asyncio.sleep(2)
    
    # Test 2: Start game
    print(f"\n2️⃣ Testing start_app({package})...")
    result = adb.start_app(package)
    print(f"   Result: {result}")
    await asyncio.sleep(5)
    
    # Test 3: Check if running
    print(f"\n3️⃣ Checking if game is running...")
    # Use dumpsys to check if app is running
    import subprocess
    result = subprocess.run(
        ["adb", "-s", adb.device_address, "shell", "dumpsys", "window", "windows"],
        capture_output=True,
        text=True
    )
    if package in result.stdout:
        print(f"   ✅ Game is running!")
    else:
        print(f"   ❌ Game is NOT running")
        print(f"   Output sample: {result.stdout[:500]}")
    
    print("\n✅ Test complete!")

if __name__ == "__main__":
    asyncio.run(test_game_functions())
