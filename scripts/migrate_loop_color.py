# Migration script to add new columns for loop_click and wait_for_color
# Run this to update existing database

import sqlite3
import os

# Find database file
db_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'bot.db')
if not os.path.exists(db_path):
    db_path = 'data/bot.db'

print(f"Database path: {db_path}")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# New columns to add
new_columns = [
    ("max_iterations", "INTEGER DEFAULT 20"),
    ("not_found_threshold", "INTEGER DEFAULT 3"),
    ("click_delay", "REAL DEFAULT 1.5"),
    ("retry_delay", "REAL DEFAULT 2.0"),
    ("expected_color", "TEXT"),  # JSON
    ("tolerance", "INTEGER DEFAULT 30"),
    ("check_interval", "REAL DEFAULT 1.0"),
]

# Get existing columns
cursor.execute("PRAGMA table_info(workflow_steps)")
existing_columns = {row[1] for row in cursor.fetchall()}
print(f"Existing columns: {existing_columns}")

# Add missing columns
for col_name, col_type in new_columns:
    if col_name not in existing_columns:
        try:
            sql = f"ALTER TABLE workflow_steps ADD COLUMN {col_name} {col_type}"
            cursor.execute(sql)
            print(f"✅ Added column: {col_name}")
        except sqlite3.OperationalError as e:
            print(f"⚠️ Column {col_name} might already exist: {e}")
    else:
        print(f"⏭️ Column {col_name} already exists")

conn.commit()
conn.close()

print("\n✅ Migration complete!")
