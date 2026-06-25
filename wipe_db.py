import os
import sys

# Load environment variables from .env
env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(env_path):
    with open(env_path, "r") as f:
        for line in f:
            if line.strip() and not line.startswith("#"):
                parts = line.strip().split("=", 1)
                if len(parts) == 2:
                    os.environ[parts[0].strip()] = parts[1].strip()

from backend import database as db

def wipe():
    print("Wiping databases...")
    conn = db.get_db_connection()
    cursor = conn.cursor()
    
    if db.IS_POSTGRES:
        print("Connected to Supabase Postgres. Wiping tables...")
        # Drop with CASCADE to clear foreign key constraints cleanly
        cursor.execute("DROP TABLE IF EXISTS likes CASCADE;")
        cursor.execute("DROP TABLE IF EXISTS comments CASCADE;")
        cursor.execute("DROP TABLE IF EXISTS posts CASCADE;")
        cursor.execute("DROP TABLE IF EXISTS users CASCADE;")
        cursor.execute("DROP TABLE IF EXISTS security_logs CASCADE;")
        cursor.execute("DROP TABLE IF EXISTS follows CASCADE;")
        cursor.execute("DROP TABLE IF EXISTS communities CASCADE;")
        cursor.execute("DROP TABLE IF EXISTS community_members CASCADE;")
        cursor.execute("DROP TABLE IF EXISTS messages CASCADE;")
        cursor.execute("DROP TABLE IF EXISTS notifications CASCADE;")
        conn.commit()
        conn.close()
        
        # Reinitialize tables
        db.init_db()
        print("Supabase Postgres database wiped and reinitialized successfully.")
    else:
        print("Using SQLite database. Deleting database file...")
        conn.close()
        if os.path.exists(db.DB_PATH):
            try:
                os.remove(db.DB_PATH)
                print("SQLite database file deleted.")
            except Exception as e:
                print(f"Warning: Could not remove database file: {e}")
        # Reinitialize
        db.init_db()
        print("SQLite database reinitialized successfully.")

if __name__ == "__main__":
    wipe()
