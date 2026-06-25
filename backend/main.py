import os
import shutil
import uuid
import re
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
from typing import Optional

# Load environment variables from .env if present
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
if os.path.exists(env_path):
    with open(env_path, "r") as f:
        for line in f:
            if line.strip() and not line.startswith("#"):
                parts = line.strip().split("=", 1)
                if len(parts) == 2:
                    os.environ[parts[0].strip()] = parts[1].strip()

from backend import database as db
from backend import extractor
from backend import moderator

# Setup Supabase Client
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
USE_SUPABASE_STORAGE = False
supabase_client = None

if SUPABASE_URL and SUPABASE_KEY and "your_supabase_project_url_here" not in SUPABASE_URL and "your_supabase_service_role_key_here" not in SUPABASE_KEY:
    try:
        from supabase import create_client
        supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        USE_SUPABASE_STORAGE = True
        print("Connected to Supabase Storage.")
    except Exception as e:
        print(f"Warning: Failed to initialize Supabase Storage client ({e}). Falling back to local storage.")

# Setup Cloudflare R2 Client
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID", "")
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY", "")
R2_BUCKET_NAME = os.environ.get("R2_BUCKET_NAME", "")
R2_ENDPOINT_URL = os.environ.get("R2_ENDPOINT_URL", "")
R2_PUBLIC_URL_PREFIX = os.environ.get("R2_PUBLIC_URL_PREFIX", "")
USE_R2 = False
r2_client = None

if R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY and R2_BUCKET_NAME and R2_ENDPOINT_URL:
    try:
        import boto3
        from botocore.config import Config
        r2_client = boto3.client(
            's3',
            endpoint_url=R2_ENDPOINT_URL,
            aws_access_key_id=R2_ACCESS_KEY_ID,
            aws_secret_access_key=R2_SECRET_ACCESS_KEY,
            config=Config(signature_version='s3v4')
        )
        USE_R2 = True
        print("Connected to Cloudflare R2 Storage.")
    except Exception as e:
        print(f"Warning: Failed to initialize Cloudflare R2 client ({e}).")

def upload_to_r2(file_bytes: bytes, unique_name: str, content_type: str) -> str:
    global r2_client, R2_BUCKET_NAME, R2_PUBLIC_URL_PREFIX
    r2_client.put_object(
        Bucket=R2_BUCKET_NAME,
        Key=unique_name,
        Body=file_bytes,
        ContentType=content_type
    )
    prefix = R2_PUBLIC_URL_PREFIX.rstrip("/")
    return f"{prefix}/{unique_name}"

app = FastAPI(title="Sentio Social Platform API", version="2.0.0")

# Setup CORS
allowed_origins = ["*"]
env_origins = os.environ.get("ALLOWED_ORIGINS")
if env_origins:
    allowed_origins = [o.strip() for o in env_origins.split(",") if o.strip()]
elif os.environ.get("FRONTEND_URL"):
    allowed_origins = [os.environ.get("FRONTEND_URL").strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Upload directory setup
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Mount uploads static folder
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# --- Pydantic Schemas ---
class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str
    display_name: str

class LoginRequest(BaseModel):
    identifier: str # Username or Email
    password: str

class CommentRequest(BaseModel):
    user_id: int
    content: str

class ProfileUpdateRequest(BaseModel):
    user_id: int
    display_name: str
    bio: str
    location: str
    website: str
    avatar_url: Optional[str] = None
    cover_url: Optional[str] = None

class DMRequest(BaseModel):
    sender_id: int
    receiver_id: int
    content: str

class CommunityCreateRequest(BaseModel):
    name: str
    slug: str
    description: str
    creator_id: int

# --- Auth Routes ---
@app.post("/api/auth/register")
def register(req: RegisterRequest):
    username = req.username.strip()
    email = req.email.strip()
    password = req.password
    display_name = req.display_name.strip()
    
    if not username or not email or not password or not display_name:
        raise HTTPException(status_code=400, detail="All fields are required.")
        
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")
        
    # Check if username or email is blocked by injection check (pre-filter)
    check_res = moderator.check_local_heuristics(username + " " + display_name)
    if check_res:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Security Blocked",
                "violation_type": check_res.violation_type,
                "reason": f"Username or Display Name violation: {check_res.reason}"
            }
        )
        
    try:
        user = db.register_user(username, email, password, display_name)
        return user
    except Exception:
        raise HTTPException(status_code=400, detail="Username or Email already exists.")

@app.post("/api/auth/login")
def login(req: LoginRequest):
    user = db.authenticate_user(req.identifier, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username/email or password.")
    # Strip password hash for security
    user.pop("password_hash", None)
    return user

# --- User Routes ---
@app.get("/api/users/{username}")
def get_user_profile(username: str, current_user_id: Optional[int] = None):
    user = db.get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
        
    user.pop("password_hash", None)
    stats = db.get_user_stats(user["id"])
    
    is_following_user = False
    if current_user_id:
        is_following_user = db.is_following(current_user_id, user["id"])
        
    return {
        "user": user,
        "stats": stats,
        "is_following": is_following_user
    }

@app.post("/api/users/{user_id}/follow")
def follow_user(user_id: int, follower_id: int):
    # follower_id toggles follow on user_id
    followed = db.toggle_follow(follower_id, user_id)
    return {"status": "success", "followed": followed}

@app.post("/api/users/profile/upload")
async def upload_profile_image(
    user_id: int = Form(...),
    username: str = Form(...),
    image_type: str = Form(...), # "avatar" or "cover"
    file: UploadFile = File(...),
    x_gemini_key: Optional[str] = Header(None)
):
    file_bytes = await file.read()
    file_name = file.filename
    
    # Moderate the image file
    moderation_res = moderator.moderate_content(
        text_content=f"Profile {image_type} image upload by @{username}",
        file_bytes=file_bytes,
        file_name=file_name,
        api_key_override=x_gemini_key
    )
    
    if not moderation_res.is_safe:
        db.log_security_violation(
            username=username,
            action_type=f"profile_{image_type}",
            payload=f"Image upload: {file_name}",
            file_attached=True,
            violation_type=moderation_res.violation_type or "illegal",
            reason=moderation_res.reason
        )
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Security Blocked",
                "violation_type": moderation_res.violation_type,
                "reason": moderation_res.reason
            }
        )
        
    ext = os.path.splitext(file_name)[1]
    unique_name = f"profile_{user_id}_{image_type}_{uuid.uuid4().hex}{ext}"
    
    uploaded = False
    public_url = None

    if USE_R2:
        try:
            public_url = upload_to_r2(file_bytes, unique_name, file.content_type)
            uploaded = True
        except Exception as e:
            print(f"Warning: Cloudflare R2 upload failed ({e}). Trying Supabase if configured.")

    if not uploaded and USE_SUPABASE_STORAGE:
        try:
            res = supabase_client.storage.from_("sentio-media").upload(
                path=unique_name,
                file=file_bytes,
                file_options={"content-type": file.content_type}
            )
            public_url = supabase_client.storage.from_("sentio-media").get_public_url(unique_name)
            uploaded = True
        except Exception as e:
            print(f"Warning: Supabase upload failed ({e}). Falling back to local storage.")

    if not uploaded:
        saved_file_path = os.path.join(UPLOAD_DIR, unique_name)
        with open(saved_file_path, "wb") as buffer:
            buffer.write(file_bytes)
        public_url = f"/uploads/{unique_name}"
        
    return {"status": "success", "url": public_url}

@app.put("/api/users/profile")
def update_profile(req: ProfileUpdateRequest):
    try:
        user = db.update_user_profile(
            user_id=req.user_id,
            display_name=req.display_name,
            bio=req.bio,
            location=req.location,
            website=req.website,
            avatar_url=req.avatar_url,
            cover_url=req.cover_url
        )
        if user:
            user.pop("password_hash", None)
            return user
        raise HTTPException(status_code=404, detail="User not found.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/users/{user_id}/followers")
def get_followers(user_id: int):
    return db.get_follow_users(user_id, "followers")

@app.get("/api/users/{user_id}/following")
def get_following(user_id: int):
    return db.get_follow_users(user_id, "following")

# --- Posts & Feed ---
@app.post("/api/posts")
async def create_post(
    user_id: int = Form(...),
    username: str = Form(...),
    content: str = Form(""),
    file: Optional[UploadFile] = File(None),
    community_id: Optional[int] = Form(None),
    x_gemini_key: Optional[str] = Header(None)
):
    content = content.strip()
    
    file_bytes = None
    file_name = None
    extracted_text = None
    
    if file:
        file_name = file.filename
        file_bytes = await file.read()
        extracted_text = extractor.extract_text_from_file(file_bytes, file_name)
    
    # Content Moderation check
    moderation_res = moderator.moderate_content(
        text_content=content,
        file_bytes=file_bytes,
        file_name=file_name,
        extracted_text=extracted_text,
        api_key_override=x_gemini_key
    )
    
    if not moderation_res.is_safe:
        # Log intrusion
        db.log_security_violation(
            username=username,
            action_type="post",
            payload=f"Text: '{content}' | File: '{file_name or 'None'}'" + (f" | Extracted Doc Text: '{extracted_text}'" if extracted_text else ""),
            file_attached=bool(file),
            violation_type=moderation_res.violation_type or "illegal",
            reason=moderation_res.reason
        )
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Security Blocked",
                "violation_type": moderation_res.violation_type,
                "reason": moderation_res.reason
            }
        )
        
    saved_file_path = None
    file_type = None
    
    if file and file_bytes:
        ext = os.path.splitext(file_name)[1]
        unique_name = f"{uuid.uuid4()}{ext}"
        
        ext_lower = ext.lower()
        if ext_lower in (".png", ".jpg", ".jpeg", ".webp"):
            file_type = "image"
        elif ext_lower in (".pdf", ".docx", ".doc", ".txt"):
            file_type = "document"
        else:
            file_type = "other"
            
        uploaded = False
        saved_file_path = None

        if USE_R2:
            try:
                saved_file_path = upload_to_r2(file_bytes, unique_name, file.content_type)
                uploaded = True
            except Exception as e:
                print(f"Warning: Cloudflare R2 upload failed ({e}). Trying Supabase if configured.")

        if not uploaded and USE_SUPABASE_STORAGE:
            try:
                res = supabase_client.storage.from_("sentio-media").upload(
                    path=unique_name,
                    file=file_bytes,
                    file_options={"content-type": file.content_type}
                )
                saved_file_path = supabase_client.storage.from_("sentio-media").get_public_url(unique_name)
                uploaded = True
            except Exception as e:
                print(f"Warning: Supabase upload failed ({e}). Falling back to local storage.")

        if not uploaded:
            local_path = os.path.join(UPLOAD_DIR, unique_name)
            with open(local_path, "wb") as buffer:
                buffer.write(file_bytes)
            saved_file_path = f"/uploads/{unique_name}"

    post_id = db.create_post(
        user_id=user_id,
        content=content,
        file_path=saved_file_path,
        file_type=file_type,
        community_id=community_id
    )
    
    return {"status": "success", "post_id": post_id, "moderation": dict(moderation_res)}

@app.get("/api/posts")
def get_posts(
    current_user_id: Optional[int] = None,
    feed_type: str = "latest",
    filter_username: Optional[str] = None,
    filter_community_id: Optional[int] = None,
    search_query: Optional[str] = None
):
    return db.get_posts(
        current_user_id=current_user_id,
        feed_type=feed_type,
        filter_username=filter_username,
        filter_community_id=filter_community_id,
        search_query=search_query
    )

@app.delete("/api/posts/{post_id}")
def delete_post(post_id: int, user_id: int):
    deleted = db.delete_post(post_id, user_id)
    if not deleted:
        raise HTTPException(status_code=400, detail="Failed to delete post. Verify owner privileges.")
    return {"status": "success"}

# --- Comments ---
@app.post("/api/posts/{post_id}/comments")
def create_comment(
    post_id: int, 
    req: CommentRequest, 
    x_gemini_key: Optional[str] = Header(None)
):
    content = req.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Comment content cannot be empty.")
        
    user = db.get_user_by_id(req.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
        
    # Moderation Check
    moderation_res = moderator.moderate_content(
        text_content=content,
        api_key_override=x_gemini_key
    )
    
    if not moderation_res.is_safe:
        db.log_security_violation(
            username=user["username"],
            action_type="comment",
            payload=content,
            file_attached=False,
            violation_type=moderation_res.violation_type or "illegal",
            reason=moderation_res.reason
        )
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Security Blocked",
                "violation_type": moderation_res.violation_type,
                "reason": moderation_res.reason
            }
        )
        
    comment_id = db.create_comment(post_id, req.user_id, content)
    return {"status": "success", "comment_id": comment_id, "moderation": dict(moderation_res)}

@app.get("/api/posts/{post_id}/comments")
def get_comments(post_id: int):
    return db.get_comments(post_id)

# --- Likes ---
@app.post("/api/posts/{post_id}/like")
def like_post(post_id: int, user_id: int):
    liked = db.toggle_like(post_id, user_id)
    return {"status": "success", "liked": liked}

# --- Explore & Trends ---
@app.get("/api/explore/trending")
def get_trending_topics():
    # Return static premium mock trending lists matching Lovable screenshots exactly
    return [
        {"id": 1, "category": "DESIGN", "tag": "#slow-tech", "posts_count": "12.4k posts"},
        {"id": 2, "category": "WRITING", "tag": "#morning-pages", "posts_count": "8.2k posts"},
        {"id": 3, "category": "PHOTOGRAPHY", "tag": "#film-only", "posts_count": "5.9k posts"},
        {"id": 4, "category": "BOOKS", "tag": "#currently-reading", "posts_count": "3.1k posts"},
        {"id": 5, "category": "MUSIC", "tag": "#ambient", "posts_count": "2.4k posts"},
    ]

# --- Direct Messages ---
@app.get("/api/messages/conversations")
def get_conversations(user_id: int):
    return db.get_conversations(user_id)

@app.get("/api/messages/{other_user_id}")
def get_chat_history(other_user_id: int, current_user_id: int):
    return db.get_messages(current_user_id, other_user_id)

@app.post("/api/messages")
def send_dm(req: DMRequest):
    content = req.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    
    # Heuristic injection check on DMs
    check_res = moderator.check_local_heuristics(content)
    if check_res:
        user = db.get_user_by_id(req.sender_id)
        db.log_security_violation(
            username=user["username"] if user else "unknown",
            action_type="message",
            payload=content,
            file_attached=False,
            violation_type=check_res.violation_type,
            reason=f"Blocked DM: {check_res.reason}"
        )
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Security Blocked",
                "violation_type": check_res.violation_type,
                "reason": check_res.reason
            }
        )
        
    msg_id = db.send_message(req.sender_id, req.receiver_id, content)
    return {"status": "success", "message_id": msg_id}

# --- Communities ---
@app.post("/api/communities")
def create_community(req: CommunityCreateRequest):
    name = req.name.strip()
    slug = req.slug.strip().lower()
    
    if not name or not slug:
        raise HTTPException(status_code=400, detail="Name and slug are required.")
        
    # Check for formatting or injection attacks
    check_res = moderator.check_local_heuristics(name + " " + slug)
    if check_res:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Security Blocked",
                "violation_type": check_res.violation_type,
                "reason": f"Community naming violation: {check_res.reason}"
            }
        )
        
    try:
        comm_id = db.create_community(
            name=name,
            slug=slug,
            description=req.description,
            avatar_url="",
            banner_url="",
            creator_id=req.creator_id
        )
        return {"status": "success", "community_id": comm_id}
    except Exception:
        raise HTTPException(status_code=400, detail="Community name or slug already exists.")

@app.get("/api/communities")
def get_communities(current_user_id: Optional[int] = None):
    return db.get_communities(current_user_id)

@app.get("/api/communities/{slug}")
def get_community_details(slug: str, current_user_id: Optional[int] = None):
    comm = db.get_community_by_slug(slug, current_user_id)
    if not comm:
        raise HTTPException(status_code=404, detail="Community not found.")
    return comm

@app.post("/api/communities/{community_id}/join")
def join_community(community_id: int, user_id: int):
    joined = db.join_community(community_id, user_id)
    return {"status": "success", "joined": joined}

# --- Notifications ---
@app.get("/api/notifications")
def get_notifications(user_id: int):
    return db.get_notifications(user_id)

@app.post("/api/notifications/read")
def read_notifications(user_id: int):
    db.mark_notifications_as_read(user_id)
    return {"status": "success"}

# --- Security Logging (Dashboard) ---
@app.get("/api/security/logs")
def get_security_logs():
    return db.get_security_logs()

@app.get("/api/security/stats")
def get_security_stats():
    return db.get_security_stats()
