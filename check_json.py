"""
Script to check and fix corrupted JSON in database
"""
import sqlite3
import json

DB_PATH = r"c:\Users\welcome\Desktop\Project\lrg-bot\licenses.db"

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

print("=== Checking all workflow_steps for JSON issues ===\n")

# Check all steps with JSON fields
cursor.execute("""
    SELECT id, step_type, ocr_region, target_characters, expected_color 
    FROM workflow_steps 
    WHERE ocr_region IS NOT NULL OR target_characters IS NOT NULL OR expected_color IS NOT NULL
""")
rows = cursor.fetchall()

for row in rows:
    step_id, step_type, ocr_region, target_chars, expected_color = row
    print(f"ID: {step_id}, Type: {step_type}")
    
    # Check ocr_region
    if ocr_region:
        try:
            json.loads(ocr_region)
            print(f"  ✅ ocr_region: valid JSON")
        except:
            print(f"  ❌ ocr_region: INVALID JSON: {ocr_region[:50]}...")
    
    # Check target_characters
    if target_chars:
        try:
            json.loads(target_chars)
            print(f"  ✅ target_characters: valid JSON")
        except:
            print(f"  ❌ target_characters: INVALID JSON: {target_chars[:50]}...")
    
    # Check expected_color
    if expected_color:
        try:
            json.loads(expected_color)
            print(f"  ✅ expected_color: valid JSON")
        except:
            print(f"  ❌ expected_color: INVALID JSON: {expected_color[:50]}...")
    
    print()

# Also check for any steps where the JSON fields might have garbage
cursor.execute("""
    SELECT id, step_type, ocr_region, target_characters, expected_color 
    FROM workflow_steps
""")
all_rows = cursor.fetchall()

print("=== All steps with potential JSON fields ===\n")
for row in all_rows:
    step_id, step_type, ocr_region, target_chars, expected_color = row
    issues = []
    
    for field_name, field_value in [("ocr_region", ocr_region), ("target_characters", target_chars), ("expected_color", expected_color)]:
        if field_value:
            try:
                json.loads(field_value)
            except:
                issues.append(f"{field_name}: {field_value[:100] if len(field_value) > 100 else field_value}")
    
    if issues:
        print(f"ID: {step_id}, Type: {step_type}")
        for issue in issues:
            print(f"  ❌ {issue}")
        print()

conn.close()
print("Done!")
