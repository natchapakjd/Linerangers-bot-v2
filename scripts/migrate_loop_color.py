# Migration script - fixes for loop_click and wait_for_color
import sqlite3

db_path = r"c:\Users\welcome\Desktop\Project\lrg-bot\licenses.db"
print(f"Database: {db_path}")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# New columns
new_columns = [
    ("max_iterations", "INTEGER DEFAULT 20"),
    ("not_found_threshold", "INTEGER DEFAULT 3"),
    ("click_delay", "REAL DEFAULT 1.5"),
    ("retry_delay", "REAL DEFAULT 2.0"),
    ("expected_color", "TEXT"),
    ("tolerance", "INTEGER DEFAULT 30"),
    ("check_interval", "REAL DEFAULT 1.0"),
]

cursor.execute("PRAGMA table_info(workflow_steps)")
existing = {row[1] for row in cursor.fetchall()}

for col, dtype in new_columns:
    if col not in existing:
        cursor.execute(f"ALTER TABLE workflow_steps ADD COLUMN {col} {dtype}")
        print(f"✅ Added: {col}")
    else:
        print(f"⏭️ Exists: {col}")

conn.commit()
conn.close()
print("✅ Done!")
