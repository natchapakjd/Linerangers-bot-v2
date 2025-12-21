"""
Save OCR region to file to see what area is being captured
"""
import subprocess
import io
from PIL import Image, ImageDraw
import numpy as np

print("Capturing screenshot...")

# Capture screenshot from emulator
result = subprocess.run(
    ["adb", "exec-out", "screencap", "-p"],
    capture_output=True,
    timeout=10
)

if result.returncode != 0 or not result.stdout:
    print("❌ Failed to capture screenshot!")
    exit(1)

# Load screenshot
img = Image.open(io.BytesIO(result.stdout))
screenshot = np.array(img)
print(f"Screenshot size: {screenshot.shape}")

# OCR region from database
x, y, w, h = 320, 140, 320, 60

# Draw rectangle on full screenshot
img_with_rect = img.copy()
draw = ImageDraw.Draw(img_with_rect)
draw.rectangle([x, y, x+w, y+h], outline='red', width=3)
draw.text((x, y-20), f"OCR Region ({x},{y}) {w}x{h}", fill='red')

# Save full image with rectangle
img_with_rect.save("ocr_region_marked.png")
print(f"✅ Saved full screenshot with OCR region marked: ocr_region_marked.png")

# Crop and save the OCR region
region = img.crop((x, y, x+w, y+h))
region.save("ocr_region_cropped.png")
print(f"✅ Saved cropped OCR region: ocr_region_cropped.png")

# Do OCR on the cropped region
import pytesseract
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

text = pytesseract.image_to_string(region, lang='eng')
print(f"\n📝 OCR Result: '{text.strip()}'")

print("\n=== ดู ocr_region_marked.png เพื่อเช็คว่าตำแหน่งถูกหรือไม่ ===")
