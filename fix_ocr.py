"""
Script to fix OCR region in database and test OCR service
"""
import sqlite3
import json

# Fix database
DB_PATH = r"c:\Users\welcome\Desktop\Project\lrg-bot\licenses.db"

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Update ocr_region
ocr_region = json.dumps({"x": 320, "y": 140, "width": 320, "height": 60})
cursor.execute(
    "UPDATE workflow_steps SET ocr_region = ? WHERE step_type = 'gacha_check'",
    (ocr_region,)
)
conn.commit()

# Verify
cursor.execute("SELECT id, step_type, ocr_region, target_characters, gacha_save_folder FROM workflow_steps WHERE step_type = 'gacha_check'")
rows = cursor.fetchall()
for row in rows:
    print(f"ID: {row[0]}, Type: {row[1]}")
    print(f"  OCR Region: {row[2]}")
    print(f"  Target Characters: {row[3]}")
    print(f"  Save Folder: {row[4]}")

conn.close()
print("\n✅ Database updated!")

# Test OCR service
print("\n=== Testing OCR Service ===")
try:
    import pytesseract
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
    
    print(f"Tesseract version: {pytesseract.get_tesseract_version()}")
    print("✅ Tesseract is working!")
    
except Exception as e:
    print(f"❌ Tesseract error: {e}")
