"""Check wait_for_color steps in database"""
import sqlite3

db_path = r"c:\Users\welcome\Desktop\Project\lrg-bot\licenses.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("""
SELECT id, step_type, tolerance, check_interval, expected_color, max_wait_seconds 
FROM workflow_steps 
WHERE step_type = 'wait_for_color' 
LIMIT 10
""")

rows = cursor.fetchall()
print(f"Found {len(rows)} wait_for_color steps:")
print("-" * 80)
for row in rows:
    print(f"ID: {row[0]}")
    print(f"  tolerance: {row[2]}")
    print(f"  check_interval: {row[3]}")
    print(f"  expected_color: {row[4]}")
    print(f"  max_wait_seconds: {row[5]}")
    print()

conn.close()
