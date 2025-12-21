"""Check gacha_check and repeat_group steps in database"""
import sqlite3

conn = sqlite3.connect('licenses.db')
cursor = conn.cursor()

print("=== GACHA CHECK STEPS ===")
cursor.execute("""
    SELECT id, workflow_id, order_index, step_type, group_name, description, 
           ocr_region, target_characters, gacha_save_folder 
    FROM workflow_steps 
    WHERE step_type = 'gacha_check'
""")
rows = cursor.fetchall()
for r in rows:
    print(f"ID: {r[0]}")
    print(f"  Workflow ID: {r[1]}")  
    print(f"  Order: {r[2]}")
    print(f"  Type: {r[3]}")
    print(f"  Group Name: {r[4]}")
    print(f"  Description: {r[5]}")
    print(f"  OCR Region: {r[6]}")
    print(f"  Target Characters: {r[7]}")
    print(f"  Save Folder: {r[8]}")
    print()

print("\n=== REPEAT GROUP STEPS ===")
cursor.execute("""
    SELECT id, workflow_id, order_index, step_type, group_name, loop_group_name, description 
    FROM workflow_steps 
    WHERE step_type = 'repeat_group'
""")
rows = cursor.fetchall()
for r in rows:
    print(f"ID: {r[0]}")
    print(f"  Workflow ID: {r[1]}")
    print(f"  Order: {r[2]}")
    print(f"  Type: {r[3]}")
    print(f"  Group Name: {r[4]}")
    print(f"  Loop Group Name: {r[5]}")
    print(f"  Description: {r[6]}")
    print()

print("\n=== ALL STEPS WITH GROUP_NAME ===")
cursor.execute("""
    SELECT id, workflow_id, order_index, step_type, group_name, description 
    FROM workflow_steps 
    WHERE group_name IS NOT NULL AND group_name != ''
    ORDER BY workflow_id, order_index
""")
rows = cursor.fetchall()
for r in rows:
    print(f"ID:{r[0]} WF:{r[1]} Order:{r[2]} Type:{r[3]} Group:{r[4]} Desc:{r[5]}")

conn.close()
