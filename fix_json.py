"""
Fix all corrupted JSON fields in workflow_steps
"""
import sqlite3
import json

DB_PATH = r"c:\Users\welcome\Desktop\Project\lrg-bot\licenses.db"

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

print("=== Fixing corrupted JSON fields ===\n")

# Fix all ocr_region fields that are corrupted
correct_ocr_region = json.dumps({"x": 320, "y": 140, "width": 320, "height": 60})

# Update all ocr_region fields with proper JSON
cursor.execute("""
    UPDATE workflow_steps 
    SET ocr_region = ? 
    WHERE step_type = 'gacha_check'
""", (correct_ocr_region,))

# Set null for non-gacha_check steps that might have garbage
cursor.execute("""
    UPDATE workflow_steps 
    SET ocr_region = NULL 
    WHERE step_type != 'gacha_check' AND ocr_region IS NOT NULL
""")

conn.commit()

print(f"✅ Fixed ocr_region for gacha_check steps")
print(f"✅ Cleared ocr_region for non-gacha_check steps")

# Verify
cursor.execute("""
    SELECT id, step_type, ocr_region, target_characters 
    FROM workflow_steps 
    WHERE ocr_region IS NOT NULL OR target_characters IS NOT NULL
""")
rows = cursor.fetchall()

print("\n=== Verification ===")
for row in rows:
    step_id, step_type, ocr_region, target_chars = row
    print(f"ID: {step_id}, Type: {step_type}")
    if ocr_region:
        try:
            json.loads(ocr_region)
            print(f"  ✅ ocr_region: {ocr_region}")
        except Exception as e:
            print(f"  ❌ ocr_region STILL BAD: {e}")
    if target_chars:
        try:
            json.loads(target_chars)
            print(f"  ✅ target_characters: {target_chars}")
        except Exception as e:
            print(f"  ❌ target_characters STILL BAD: {e}")
    print()

conn.close()
print("Done!")
