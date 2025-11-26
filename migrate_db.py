"""
Migration script to add default_user_prompt column to user_settings table
Run this script to update your database: python migrate_db.py
"""
import sqlite3
from pathlib import Path

DB_PATH = Path("voice_transcript.db")

def migrate():
    if not DB_PATH.exists():
        print(f"Database {DB_PATH} not found. No migration needed.")
        return
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(user_settings)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'default_user_prompt' in columns:
            print("✅ Column 'default_user_prompt' already exists. No migration needed.")
        else:
            # Add the new column
            cursor.execute("""
                ALTER TABLE user_settings 
                ADD COLUMN default_user_prompt TEXT
            """)
            conn.commit()
            print("✅ Successfully added 'default_user_prompt' column to user_settings table")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
