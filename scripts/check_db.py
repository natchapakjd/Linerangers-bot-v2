"""
Check database structure for workflows table
"""
import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "..", "licenses.db")
print(f"Checking database: {db_path}")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get table structure
cursor.execute("PRAGMA table_info(workflows)")
columns = cursor.fetchall()

print("\n📋 Workflows table structure:")
print("-" * 60)
for col in columns:
    print(f"  {col[1]:<20} {col[2]:<15} {'NULL' if not col[3] else 'NOT NULL'}")

print("\n📊 Workflow count:")
cursor.execute("SELECT COUNT(*) FROM workflows")
count = cursor.fetchone()[0]
print(f"  Total workflows: {count}")

if count > 0:
    print("\n🔍 Sample workflows:")
    cursor.execute("SELECT id, name, mode_name, month_year FROM workflows LIMIT 5")
    for row in cursor.fetchall():
        print(f"  ID:{row[0]} | {row[1]} | Mode:{row[2]} | Month:{row[3]}")

conn.close()
