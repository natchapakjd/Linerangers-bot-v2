"""
Database migration script to add mode_name and month_year columns to workflows table.
Run this once to update existing database.
"""
import sqlite3
import os

# Path to database
db_path = os.path.join(os.path.dirname(__file__), "..", "licenses.db")

print(f"Migrating database: {db_path}")

# Connect to database
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Add mode_name column
    print("Adding mode_name column...")
    cursor.execute("ALTER TABLE workflows ADD COLUMN mode_name VARCHAR(100)")
    print("✓ mode_name added")
except sqlite3.OperationalError as e:
    if "duplicate column name" in str(e):
        print("✓ mode_name already exists")
    else:
        print(f"✗ Error adding mode_name: {e}")

try:
    # Add month_year column
    print("Adding month_year column...")
    cursor.execute("ALTER TABLE workflows ADD COLUMN month_year VARCHAR(7)")
    print("✓ month_year added")
except sqlite3.OperationalError as e:
    if "duplicate column name" in str(e):
        print("✓ month_year already exists")
    else:
        print(f"✗ Error adding month_year: {e}")

# Commit changes
conn.commit()
conn.close()

print("\n✅ Migration complete!")
print("You can now restart the backend: python -m app.main")
