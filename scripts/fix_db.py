
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'licenses.db')

def add_group_name_column():
    print(f"Connecting to database at: {DB_PATH}")
    if not os.path.exists(DB_PATH):
        print("Database file not found!")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if column exists
        cursor.execute("PRAGMA table_info(workflow_steps)")
        columns = [info[1] for info in cursor.fetchall()]
        
        if 'group_name' in columns:
            print("Column 'group_name' already exists.")
        else:
            print("Adding column 'group_name'...")
            cursor.execute("ALTER TABLE workflow_steps ADD COLUMN group_name TEXT DEFAULT NULL")
            conn.commit()
            print("Column added successfully.")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    add_group_name_column()
