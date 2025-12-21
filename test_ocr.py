"""
Comprehensive OCR test script
"""
print("=== Testing ALL OCR Dependencies ===\n")

# Test 1: PIL/Pillow
print("1. Testing PIL/Pillow...")
try:
    from PIL import Image
    print(f"   ✅ PIL installed: {Image.__version__}")
except Exception as e:
    print(f"   ❌ PIL error: {e}")

# Test 2: numpy
print("\n2. Testing numpy...")
try:
    import numpy as np
    print(f"   ✅ numpy installed: {np.__version__}")
except Exception as e:
    print(f"   ❌ numpy error: {e}")

# Test 3: cv2/OpenCV  
print("\n3. Testing OpenCV...")
try:
    import cv2
    print(f"   ✅ OpenCV installed: {cv2.__version__}")
except Exception as e:
    print(f"   ❌ OpenCV error: {e}")

# Test 4: pytesseract
print("\n4. Testing pytesseract...")
try:
    import pytesseract
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
    version = pytesseract.get_tesseract_version()
    print(f"   ✅ Tesseract installed: {version}")
except Exception as e:
    print(f"   ❌ pytesseract error: {e}")

# Test 5: OCR Service
print("\n5. Testing OCR Service...")
try:
    from app.services.ocr_service import get_ocr_service
    ocr = get_ocr_service()
    if ocr.is_available():
        print("   ✅ OCR Service is available")
    else:
        print("   ❌ OCR Service reports NOT available")
except Exception as e:
    print(f"   ❌ OCR Service error: {e}")

# Test 6: Actual OCR on test image
print("\n6. Testing actual OCR on screenshot...")
try:
    import subprocess
    import base64
    import io
    from PIL import Image
    import numpy as np
    
    # Capture screenshot from emulator
    result = subprocess.run(
        ["adb", "exec-out", "screencap", "-p"],
        capture_output=True,
        timeout=10
    )
    
    if result.returncode != 0 or not result.stdout:
        print("   ⚠️ No emulator connected, using test image")
        # Create test image with text
        img = Image.new('RGB', (320, 60), color='white')
        from PIL import ImageDraw
        draw = ImageDraw.Draw(img)
        draw.text((10, 10), "Test OCR Text", fill='black')
        screenshot = np.array(img)
    else:
        # Load screenshot
        img = Image.open(io.BytesIO(result.stdout))
        screenshot = np.array(img)
        print(f"   📷 Screenshot size: {screenshot.shape}")
    
    # Test OCR
    import pytesseract
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
    
    # Crop to OCR region (320, 140, 320x60)
    x, y, w, h = 320, 140, 320, 60
    if screenshot.shape[0] > y + h and screenshot.shape[1] > x + w:
        region = screenshot[y:y+h, x:x+w]
        text = pytesseract.image_to_string(region, lang='eng')
        print(f"   📝 OCR Result from region: '{text.strip()}'")
    else:
        text = pytesseract.image_to_string(screenshot, lang='eng')
        print(f"   📝 OCR Result from full image: '{text[:100].strip()}...'")
    
    print("   ✅ OCR extraction successful")
except Exception as e:
    import traceback
    print(f"   ❌ OCR test error: {e}")
    traceback.print_exc()

# Test 7: Check repeat_group data
print("\n7. Checking repeat_group configuration...")
try:
    import sqlite3
    conn = sqlite3.connect(r"c:\Users\welcome\Desktop\Project\lrg-bot\licenses.db")
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, step_type, loop_group_name FROM workflow_steps WHERE step_type = 'repeat_group'")
    rows = cursor.fetchall()
    
    if rows:
        for row in rows:
            print(f"   ID: {row[0]}, loop_group_name: {row[2]}")
    else:
        print("   ⚠️ No repeat_group steps found!")
    
    # Check if gacha_check is in the same group
    cursor.execute("SELECT id, step_type, group_name FROM workflow_steps WHERE step_type = 'gacha_check'")
    gacha_rows = cursor.fetchall()
    if gacha_rows:
        for row in gacha_rows:
            print(f"   gacha_check ID: {row[0]}, group_name: {row[2]}")
    else:
        print("   ⚠️ No gacha_check steps found!")
    
    conn.close()
except Exception as e:
    print(f"   ❌ DB check error: {e}")

print("\n=== Done! ===")
