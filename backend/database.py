import sqlite3
import os
import hashlib
import secrets
import re
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "secure_social.db")

# Setup PostgreSQL pool if DATABASE_URL is present and configured
DATABASE_URL = os.environ.get("DATABASE_URL", "")
IS_POSTGRES = False
pg_pool = None

if DATABASE_URL and "[YOUR-PASSWORD]" not in DATABASE_URL and "your_postgresql_connection_string_here" not in DATABASE_URL:
    try:
        import psycopg2
        from psycopg2 import pool
        from psycopg2.extras import RealDictCursor
        
        # Test connection
        test_conn = psycopg2.connect(DATABASE_URL)
        test_conn.close()
        
        # Use ThreadedConnectionPool for FastAPI concurrency
        pg_pool = pool.ThreadedConnectionPool(1, 20, DATABASE_URL)
        IS_POSTGRES = True
        print("Connected to PostgreSQL database via Supabase pool.")
    except Exception as e:
        print(f"Warning: Failed to connect to PostgreSQL ({e}). Falling back to SQLite.")
        IS_POSTGRES = False
else:
    print("Using SQLite database.")

class SafeCursor:
    def __init__(self, cursor, is_postgres):
        self.cursor = cursor
        self.is_postgres = is_postgres
        self._lastrowid = None

    def execute(self, query, params=None):
        if self.is_postgres:
            trimmed = query.strip().upper()
            if trimmed.startswith("PRAGMA"):
                return
            
            # Translate CREATE TABLE syntax
            if "CREATE TABLE" in trimmed:
                query = query.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
                
            # Replace SQLite ? with PostgreSQL %s
            query = query.replace("?", "%s")
            
            # Auto-append RETURNING id to INSERT statements to populate lastrowid
            if trimmed.startswith("INSERT ") and "RETURNING" not in trimmed:
                query_clean = query.rstrip().rstrip(";")
                query = query_clean + " RETURNING id;"
                
                if params is None:
                    self.cursor.execute(query)
                else:
                    self.cursor.execute(query, params)
                    
                row = self.cursor.fetchone()
                if row:
                    if isinstance(row, dict):
                        self._lastrowid = row.get("id")
                    else:
                        self._lastrowid = row[0]
                return
                
        if params is None:
            self.cursor.execute(query)
        else:
            self.cursor.execute(query, params)

    def fetchone(self):
        row = self.cursor.fetchone()
        if row is None:
            return None
        # Convert RealDictCursor row to standard dict if needed
        if self.is_postgres and not isinstance(row, dict):
            return dict(row)
        return row

    def fetchall(self):
        rows = self.cursor.fetchall()
        if self.is_postgres:
            return [dict(r) if not isinstance(r, dict) else r for r in rows]
        return rows

    def fetchmany(self, size):
        rows = self.cursor.fetchmany(size)
        if self.is_postgres:
            return [dict(r) if not isinstance(r, dict) else r for r in rows]
        return rows

    @property
    def rowcount(self):
        return self.cursor.rowcount

    @property
    def lastrowid(self):
        if self.is_postgres:
            return self._lastrowid
        return self.cursor.lastrowid

class SafeConnection:
    def __init__(self, conn, is_postgres):
        self.conn = conn
        self.is_postgres = is_postgres

    def cursor(self):
        if self.is_postgres:
            from psycopg2.extras import RealDictCursor
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
        else:
            cursor = self.conn.cursor()
        return SafeCursor(cursor, self.is_postgres)

    def commit(self):
        self.conn.commit()

    def rollback(self):
        self.conn.rollback()

    def close(self):
        if self.is_postgres:
            pg_pool.putconn(self.conn)
        else:
            self.conn.close()

def get_db_connection():
    global IS_POSTGRES, pg_pool
    if IS_POSTGRES:
        for attempt in range(3):
            conn = None
            try:
                conn = pg_pool.getconn()
                if conn.closed != 0:
                    pg_pool.putconn(conn, close=True)
                    continue
                # Run a light query to test connection health
                with conn.cursor() as cur:
                    cur.execute("SELECT 1;")
                return SafeConnection(conn, True)
            except Exception as e:
                print(f"Warning: Stale or failed pool connection detected on attempt {attempt+1} ({e}). Healing...")
                if conn:
                    try:
                        pg_pool.putconn(conn, close=True)
                    except Exception:
                        pass
        
        # If connections are stale, attempt to recreate the pool
        try:
            print("Purging stale connection pool and reconnecting to Supabase PostgreSQL...")
            pg_pool = pool.ThreadedConnectionPool(1, 20, DATABASE_URL)
            conn = pg_pool.getconn()
            return SafeConnection(conn, True)
        except Exception as e:
            print(f"Error: Failed to re-establish Supabase database connection pool ({e}). Falling back to SQLite.")
            IS_POSTGRES = False
            
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return SafeConnection(conn, False)

# Helper functions for secure password hashing using hashlib (built-in, zero-dependency)
def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
    return f"{salt}:{key.hex()}"

def verify_password(password: str, hashed_pw: str) -> bool:
    try:
        salt, key_hex = hashed_pw.split(":", 1)
        key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
        return secrets.compare_digest(key.hex(), key_hex)
    except Exception:
        return False

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Enable foreign keys
    cursor.execute("PRAGMA foreign_keys = ON;")
    
    # Create Users table (expanded for Sentio)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        bio TEXT DEFAULT '',
        avatar_url TEXT DEFAULT '',
        cover_url TEXT DEFAULT '',
        location TEXT DEFAULT '',
        website TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    
    # Create Communities table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS communities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        description TEXT DEFAULT '',
        avatar_url TEXT DEFAULT '',
        banner_url TEXT DEFAULT '',
        creator_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (creator_id) REFERENCES users (id) ON DELETE CASCADE
    );
    """)

    # Create Posts table (expanded for Sentio)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        file_path TEXT DEFAULT NULL,
        file_type TEXT DEFAULT NULL,
        community_id INTEGER DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (community_id) REFERENCES communities (id) ON DELETE CASCADE
    );
    """)
    
    # Create Comments table (replies)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    """)
    
    # Create Likes table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        UNIQUE(post_id, user_id),
        FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    """)

    # Create Follows table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS follows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        follower_id INTEGER NOT NULL,
        following_id INTEGER NOT NULL,
        UNIQUE(follower_id, following_id),
        FOREIGN KEY (follower_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (following_id) REFERENCES users (id) ON DELETE CASCADE
    );
    """)

    # Create Community Members table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS community_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        community_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT DEFAULT 'member', -- 'creator', 'admin', 'member'
        UNIQUE(community_id, user_id),
        FOREIGN KEY (community_id) REFERENCES communities (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    """)

    # Create Direct Messages table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL,
        receiver_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        media_path TEXT DEFAULT NULL,
        media_type TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users (id) ON DELETE CASCADE
    );
    """)

    # Create Notifications table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL, -- 'like', 'reply', 'follow', 'mention'
        sender_id INTEGER NOT NULL,
        post_id INTEGER DEFAULT NULL,
        is_read INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE
    );
    """)
    
    # Create Security Logs table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS security_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        action_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        file_attached INTEGER NOT NULL,
        violation_type TEXT NOT NULL,
        reason TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    
    conn.commit()
    conn.close()

# --- Auth Helpers ---
def register_user(username, email, password, display_name):
    conn = get_db_connection()
    cursor = conn.cursor()
    pw_hash = hash_password(password)
    try:
        cursor.execute(
            """
            INSERT INTO users (username, email, password_hash, display_name) 
            VALUES (?, ?, ?, ?);
            """,
            (username.lower(), email.lower(), pw_hash, display_name)
        )
        conn.commit()
        user_id = cursor.lastrowid
        
        # Notify every other user about the new sign-up
        cursor.execute("SELECT id FROM users WHERE id != ?;", (user_id,))
        other_users = [row["id"] for row in cursor.fetchall()]
        for other_id in other_users:
            cursor.execute(
                "INSERT INTO notifications (user_id, type, sender_id) VALUES (?, 'new_user', ?);",
                (other_id, user_id)
            )
        conn.commit()
        conn.close()
        return {"id": user_id, "username": username, "email": email, "display_name": display_name}
    except Exception as e:
        conn.close()
        raise e

def authenticate_user(identifier, password):
    # identifier can be username or email
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM users WHERE username = ? OR email = ?;",
        (identifier.lower(), identifier.lower())
    )
    user_row = cursor.fetchone()
    conn.close()
    
    if user_row and verify_password(password, user_row["password_hash"]):
        return dict(user_row)
    return None

# --- User Helpers ---
def get_user_by_id(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?;", (user_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_user_by_username(username):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?;", (username.lower(),))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def update_user_profile(user_id, display_name, bio, location, website, avatar_url=None, cover_url=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # We update optionally based on parameters
    query = """
        UPDATE users 
        SET display_name = ?, bio = ?, location = ?, website = ?
    """
    params = [display_name, bio, location, website]
    
    if avatar_url:
        query += ", avatar_url = ?"
        params.append(avatar_url)
    if cover_url:
        query += ", cover_url = ?"
        params.append(cover_url)
        
    query += " WHERE id = ?;"
    params.append(user_id)
    
    cursor.execute(query, params)
    conn.commit()
    conn.close()
    return get_user_by_id(user_id)

# --- Follows ---
def toggle_follow(follower_id, following_id):
    if follower_id == following_id:
        return False
        
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM follows WHERE follower_id = ? AND following_id = ?;", (follower_id, following_id))
    follow = cursor.fetchone()
    
    followed = False
    if follow:
        cursor.execute("DELETE FROM follows WHERE follower_id = ? AND following_id = ?;", (follower_id, following_id))
    else:
        cursor.execute("INSERT INTO follows (follower_id, following_id) VALUES (?, ?);", (follower_id, following_id))
        followed = True
        
    conn.commit()
    conn.close()
    
    if followed:
        # Notify
        create_notification(following_id, 'follow', follower_id)
        
    return followed

def is_following(follower_id, following_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM follows WHERE follower_id = ? AND following_id = ?;", (follower_id, following_id))
    res = cursor.fetchone()
    conn.close()
    return res is not None

def get_user_stats(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM follows WHERE following_id = ?;", (user_id,))
    followers = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM follows WHERE follower_id = ?;", (user_id,))
    following = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM posts WHERE user_id = ?;", (user_id,))
    posts = cursor.fetchone()[0]
    conn.close()
    return {
        "followers_count": followers,
        "following_count": following,
        "posts_count": posts
    }

def get_follow_users(user_id, fetch_type="followers"):
    conn = get_db_connection()
    cursor = conn.cursor()
    if fetch_type == "followers":
        query = """
            SELECT u.id, u.username, u.display_name, u.bio, u.avatar_url 
            FROM users u JOIN follows f ON u.id = f.follower_id
            WHERE f.following_id = ?;
        """
    else:
        query = """
            SELECT u.id, u.username, u.display_name, u.bio, u.avatar_url 
            FROM users u JOIN follows f ON u.id = f.following_id
            WHERE f.follower_id = ?;
        """
    cursor.execute(query, (user_id,))
    users = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return users

# --- Posts ---
def create_post(user_id, content, file_path=None, file_type=None, community_id=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO posts (user_id, content, file_path, file_type, community_id) 
        VALUES (?, ?, ?, ?, ?);
        """,
        (user_id, content, file_path, file_type, community_id)
    )
    conn.commit()
    post_id = cursor.lastrowid
    conn.close()
    
    # Check for mentions to send notifications (opens new connections)
    mentions = re.findall(r"@(\w+)", content)
    for username in mentions:
        user = get_user_by_username(username)
        if user and user["id"] != user_id:
            create_notification(user["id"], 'mention', user_id, post_id)
            
    return post_id

import re # needed for mentions regex

def get_posts(current_user_id=None, feed_type="latest", filter_username=None, filter_community_id=None, search_query=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = """
    SELECT p.*, u.username, u.display_name, u.avatar_url,
           (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
           (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
           c.name as community_name, c.slug as community_slug
    """
    
    params = []
    if current_user_id:
        query += ", (SELECT COUNT(*) FROM likes WHERE post_id = p.id AND user_id = ?) as user_liked "
        params.append(current_user_id)
    else:
        query += ", 0 as user_liked "
        
    query += """
        FROM posts p 
        JOIN users u ON p.user_id = u.id
        LEFT JOIN communities c ON p.community_id = c.id
    """
    
    where_clauses = []
    
    # Show all posts from all users on the home feed regardless of follow graphs to ensure feed is fully populated
    # if feed_type == "following" and current_user_id:
    #     where_clauses.append("(p.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?) OR p.user_id = ?)")
    #     params.extend([current_user_id, current_user_id])
        
    if filter_username:
        where_clauses.append("u.username = ?")
        params.append(filter_username.lower())
        
    if filter_community_id:
        where_clauses.append("p.community_id = ?")
        params.append(filter_community_id)
        
    if search_query:
        where_clauses.append("(p.content LIKE ? OR u.username LIKE ? OR u.display_name LIKE ?)")
        search_param = f"%{search_query}%"
        params.extend([search_param, search_param, search_param])
        
    if where_clauses:
        query += " WHERE " + " AND ".join(where_clauses)
        
    if feed_type == "trending":
        # simple trending ordering by likes + comments
        query += " ORDER BY (likes_count * 2 + comments_count) DESC, p.created_at DESC LIMIT 50;"
    else:
        query += " ORDER BY p.created_at DESC;"
        
    cursor.execute(query, params)
    posts = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return posts

def delete_post(post_id, user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM posts WHERE id = ? AND user_id = ?;", (post_id, user_id))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

# --- Comments ---
def create_comment(post_id, user_id, content):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?);",
        (post_id, user_id, content)
    )
    conn.commit()
    comment_id = cursor.lastrowid
    
    # Get post owner
    cursor.execute("SELECT user_id FROM posts WHERE id = ?;", (post_id,))
    post = cursor.fetchone()
    post_owner_id = post["user_id"] if post else None
    
    conn.close()
    
    if post_owner_id and post_owner_id != user_id:
        create_notification(post_owner_id, 'reply', user_id, post_id)
        
    return comment_id

def get_comments(post_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT c.*, u.username, u.display_name, u.avatar_url 
        FROM comments c 
        JOIN users u ON c.user_id = u.id 
        WHERE c.post_id = ? 
        ORDER BY c.created_at ASC;
        """,
        (post_id,)
    )
    comments = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return comments

# --- Likes ---
def toggle_like(post_id, user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM likes WHERE post_id = ? AND user_id = ?;", (post_id, user_id))
    like = cursor.fetchone()
    
    liked = False
    if like:
        cursor.execute("DELETE FROM likes WHERE post_id = ? AND user_id = ?;", (post_id, user_id))
    else:
        cursor.execute("INSERT INTO likes (post_id, user_id) VALUES (?, ?);", (post_id, user_id))
        liked = True
        
    # Get post owner
    cursor.execute("SELECT user_id FROM posts WHERE id = ?;", (post_id,))
    post = cursor.fetchone()
    post_owner_id = post["user_id"] if post else None
    
    conn.commit()
    conn.close()
    
    if liked and post_owner_id and post_owner_id != user_id:
        create_notification(post_owner_id, 'like', user_id, post_id)
            
    return liked

# --- Communities ---
def create_community(name, slug, description, avatar_url, banner_url, creator_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO communities (name, slug, description, avatar_url, banner_url, creator_id)
            VALUES (?, ?, ?, ?, ?, ?);
            """,
            (name, slug.lower(), description, avatar_url, banner_url, creator_id)
        )
        conn.commit()
        community_id = cursor.lastrowid
        
        # Creator joins automatically as creator role
        cursor.execute(
            "INSERT INTO community_members (community_id, user_id, role) VALUES (?, ?, 'creator');",
            (community_id, creator_id)
        )
        conn.commit()
        conn.close()
        return community_id
    except sqlite3.IntegrityError as e:
        conn.close()
        raise e

def join_community(community_id, user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT role FROM community_members WHERE community_id = ? AND user_id = ?;", (community_id, user_id))
    membership = cursor.fetchone()
    
    joined = False
    if membership:
        if membership["role"] != 'creator': # Creator cannot leave
            cursor.execute("DELETE FROM community_members WHERE community_id = ? AND user_id = ?;", (community_id, user_id))
    else:
        cursor.execute("INSERT INTO community_members (community_id, user_id) VALUES (?, ?);", (community_id, user_id))
        joined = True
        
    conn.commit()
    conn.close()
    return joined

def get_communities(current_user_id=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = """
        SELECT c.*, 
               (SELECT COUNT(*) FROM community_members WHERE community_id = c.id) as members_count
    """
    
    params = []
    if current_user_id:
        query += ", (SELECT COUNT(*) FROM community_members WHERE community_id = c.id AND user_id = ?) as user_joined "
        params.append(current_user_id)
    else:
        query += ", 0 as user_joined "
        
    query += " FROM communities c ORDER BY members_count DESC;"
    cursor.execute(query, params)
    communities = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return communities

def get_community_by_slug(slug, current_user_id=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = """
        SELECT c.*, 
               (SELECT COUNT(*) FROM community_members WHERE community_id = c.id) as members_count
    """
    
    params = [slug.lower()]
    if current_user_id:
        query += ", (SELECT COUNT(*) FROM community_members WHERE community_id = c.id AND user_id = ?) as user_joined "
        params.append(current_user_id)
    else:
        query += ", 0 as user_joined "
        
    query += " FROM communities c WHERE c.slug = ?;"
    cursor.execute(query, params)
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

# --- Direct Messages ---
def send_message(sender_id, receiver_id, content, media_path=None, media_type=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO messages (sender_id, receiver_id, content, media_path, media_type) 
        VALUES (?, ?, ?, ?, ?);
        """,
        (sender_id, receiver_id, content, media_path, media_type)
    )
    conn.commit()
    msg_id = cursor.lastrowid
    conn.close()
    return msg_id

def get_messages(user_a, user_b):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT m.*, u_send.username as sender_username, u_recv.username as receiver_username
        FROM messages m
        JOIN users u_send ON m.sender_id = u_send.id
        JOIN users u_recv ON m.receiver_id = u_recv.id
        WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
        ORDER BY m.created_at ASC;
        """,
        (user_a, user_b, user_b, user_a)
    )
    messages = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return messages

def get_conversations(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT DISTINCT u.id, u.username, u.display_name, u.avatar_url,
               (SELECT content FROM messages WHERE (sender_id = u.id AND receiver_id = ?) OR (sender_id = ? AND receiver_id = u.id) ORDER BY created_at DESC LIMIT 1) as last_message,
               (SELECT created_at FROM messages WHERE (sender_id = u.id AND receiver_id = ?) OR (sender_id = ? AND receiver_id = u.id) ORDER BY created_at DESC LIMIT 1) as last_message_time
        FROM users u
        WHERE u.id != ? AND u.id IN (
            SELECT sender_id FROM messages WHERE receiver_id = ?
            UNION
            SELECT receiver_id FROM messages WHERE sender_id = ?
        )
        ORDER BY last_message_time DESC;
        """,
        (user_id, user_id, user_id, user_id, user_id, user_id, user_id)
    )
    conversations = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return conversations

# --- Notifications ---
def create_notification(user_id, type, sender_id, post_id=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO notifications (user_id, type, sender_id, post_id) 
        VALUES (?, ?, ?, ?);
        """,
        (user_id, type, sender_id, post_id)
    )
    conn.commit()
    notif_id = cursor.lastrowid
    conn.close()
    return notif_id

def get_notifications(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT n.*, u.username as sender_username, u.display_name as sender_display_name, u.avatar_url as sender_avatar_url,
               p.content as post_content
        FROM notifications n
        JOIN users u ON n.sender_id = u.id
        LEFT JOIN posts p ON n.post_id = p.id
        WHERE n.user_id = ? 
        ORDER BY n.created_at DESC;
        """,
        (user_id,)
    )
    notifs = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return notifs

def mark_notifications_as_read(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE notifications SET is_read = 1 WHERE user_id = ?;", (user_id,))
    conn.commit()
    conn.close()

# --- Security Logs (Retained) ---
def log_security_violation(username, action_type, payload, file_attached, violation_type, reason):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO security_logs (username, action_type, payload, file_attached, violation_type, reason) 
        VALUES (?, ?, ?, ?, ?, ?);
        """,
        (username, action_type, payload, 1 if file_attached else 0, violation_type, reason)
    )
    conn.commit()
    log_id = cursor.lastrowid
    conn.close()
    return log_id

def get_security_logs():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM security_logs ORDER BY timestamp DESC;")
    logs = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return logs

def get_security_stats():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT violation_type, COUNT(*) as count FROM security_logs GROUP BY violation_type;")
    by_type = {row["violation_type"]: row["count"] for row in cursor.fetchall()}
    
    cursor.execute("SELECT COUNT(*) as count FROM security_logs;")
    total = cursor.fetchone()["count"]
    
    cursor.execute("SELECT action_type, COUNT(*) as count FROM security_logs GROUP BY action_type;")
    by_action = {row["action_type"]: row["count"] for row in cursor.fetchall()}
    
    conn.close()
    return {
        "by_type": by_type,
        "total": total,
        "by_action": by_action
    }

# Migration check: if the database schema is outdated, drop and migrate
def check_and_migrate():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Check if users table has 'email'
        cursor.execute("SELECT email FROM users LIMIT 1;")
        conn.close()
    except Exception:
        # Table doesn't exist or doesn't have 'email', perform migration/recreation!
        print("Migrating database schema to support the complete Sentio architecture...")
        # Clean up database connection
        conn.close()
        
        # Open a new connection and drop all tables
        conn2 = get_db_connection()
        cursor2 = conn2.cursor()
        if not IS_POSTGRES:
            cursor2.execute("PRAGMA foreign_keys = OFF;")
            cursor2.execute("DROP TABLE IF EXISTS likes;")
            cursor2.execute("DROP TABLE IF EXISTS comments;")
            cursor2.execute("DROP TABLE IF EXISTS posts;")
            cursor2.execute("DROP TABLE IF EXISTS users;")
            cursor2.execute("DROP TABLE IF EXISTS security_logs;")
            cursor2.execute("DROP TABLE IF EXISTS follows;")
            cursor2.execute("DROP TABLE IF EXISTS communities;")
            cursor2.execute("DROP TABLE IF EXISTS community_members;")
            cursor2.execute("DROP TABLE IF EXISTS messages;")
            cursor2.execute("DROP TABLE IF EXISTS notifications;")
        else:
            cursor2.execute("DROP TABLE IF EXISTS likes CASCADE;")
            cursor2.execute("DROP TABLE IF EXISTS comments CASCADE;")
            cursor2.execute("DROP TABLE IF EXISTS posts CASCADE;")
            cursor2.execute("DROP TABLE IF EXISTS users CASCADE;")
            cursor2.execute("DROP TABLE IF EXISTS security_logs CASCADE;")
            cursor2.execute("DROP TABLE IF EXISTS follows CASCADE;")
            cursor2.execute("DROP TABLE IF EXISTS communities CASCADE;")
            cursor2.execute("DROP TABLE IF EXISTS community_members CASCADE;")
            cursor2.execute("DROP TABLE IF EXISTS messages CASCADE;")
            cursor2.execute("DROP TABLE IF EXISTS notifications CASCADE;")
        conn2.commit()
        conn2.close()
        
        # Re-initialize the database schema
        init_db()
        print("Sentio database schema initialized successfully.")

# Run migration check when imported
check_and_migrate()
