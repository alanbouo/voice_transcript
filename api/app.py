# api/app.py
from pathlib import Path
import sys
sys.path.append(str(Path(__file__).resolve().parents[1]))

from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional
from sqlalchemy.orm import Session
from pathlib import Path
import shutil, uuid, os
from dotenv import load_dotenv

from utils.convert import convert_to_mp3
from scripts.transcribe import transcribe_audio
from scripts.export import save_transcript_json, save_transcript_txt
from api.database import init_db, get_db, User
from api.auth import (
    verify_password, 
    get_password_hash, 
    create_access_token, 
    create_refresh_token,
    decode_token
)

load_dotenv()

# Initialize database
init_db()

app = FastAPI(title="Voice Transcript API", version="1.0.0")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Directories
INPUT_DIR = Path("inputs")
OUTPUT_DIR = Path("outputs")
INPUT_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/token")

QUALITY_PRESETS = {
    "high": "128k",
    "medium": "96k",
    "low": "64k"
}

# Pydantic models
class UserCreate(BaseModel):
    username: str
    email: Optional[EmailStr] = None
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    username: str
    email: Optional[str]
    created_at: str

# In-memory refresh token store (consider Redis for production)
refresh_tokens_db = {}


def authenticate_token(token: str = Depends(oauth2_scheme)):
    """Validate JWT token and return username"""
    try:
        payload = decode_token(token)
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return username
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_user_by_username(db: Session, username: str):
    """Get user from database by username"""
    return db.query(User).filter(User.username == username).first()

@app.post("/register")
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user"""
    # Check if username already exists
    existing_user = db.query(User).filter(User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Check if email already exists
    if user_data.email:
        existing_email = db.query(User).filter(User.email == user_data.email).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {
        "message": "User created successfully",
        "username": new_user.username
    }


@app.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Login and get access token"""
    # Get user from database
    user = get_user_by_username(db, form_data.username)
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    # Create tokens
    access_token = create_access_token(user.username)
    refresh_token = create_refresh_token(user.username)
    refresh_tokens_db[refresh_token] = user.username
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

@app.post("/refresh")
async def refresh_token_endpoint(refresh_token: str = Form(...)):
    """Refresh access token using refresh token"""
    try:
        payload = decode_token(refresh_token)
        username = payload.get("sub")
        
        if refresh_token not in refresh_tokens_db or refresh_tokens_db[refresh_token] != username:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        
        new_access_token = create_access_token(username)
        return {"access_token": new_access_token, "token_type": "bearer"}
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


@app.get("/me", response_model=UserResponse)
async def get_current_user(
    username: str = Depends(authenticate_token),
    db: Session = Depends(get_db)
):
    """Get current user information"""
    user = get_user_by_username(db, username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        created_at=user.created_at.isoformat()
    )

@app.post("/transcribe")
async def transcribe_endpoint(
    file: UploadFile = File(...),
    quality: str = Form("high"),
    user: str = Depends(authenticate_token)
):
    api_key = os.getenv("AAI_API_KEY")
    if not api_key:
        return JSONResponse(status_code=500, content={"error": "AAI_API_KEY missing in .env"})

    if quality not in QUALITY_PRESETS:
        return JSONResponse(status_code=400, content={"error": "Invalid quality value"})

    uid = uuid.uuid4().hex[:8]
    input_path = INPUT_DIR / f"{uid}_{file.filename}"
    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        base_name = input_path.stem
        mp3_path = OUTPUT_DIR / f"{base_name}.mp3"
        json_path = OUTPUT_DIR / f"{base_name}.json"
        txt_path = OUTPUT_DIR / f"{base_name}.txt"

        convert_to_mp3(input_path, mp3_path, bitrate=QUALITY_PRESETS[quality])
        job = transcribe_audio(str(mp3_path), api_key)
        save_transcript_json(job, json_path)
        save_transcript_txt(job, txt_path)

        return {
            "id": base_name,
            "text_file": f"/transcripts/{base_name}?format=txt",
            "json_file": f"/transcripts/{base_name}?format=json"
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/transcripts/{transcript_id}")
def get_transcript(transcript_id: str, format: str = "txt", user: str = Depends(authenticate_token)):
    ext = ".json" if format == "json" else ".txt"
    file_path = OUTPUT_DIR / f"{transcript_id}{ext}"
    if not file_path.exists():
        return JSONResponse(status_code=404, content={"error": "Transcript not found"})
    return FileResponse(file_path)


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
