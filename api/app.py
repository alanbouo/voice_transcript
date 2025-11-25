# api/app.py
from pathlib import Path
import sys
sys.path.append(str(Path(__file__).resolve().parents[1]))

from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from pathlib import Path
import shutil, uuid, os
from dotenv import load_dotenv

from utils.convert import convert_to_mp3
from scripts.transcribe import transcribe_audio
from scripts.export import save_transcript_json, save_transcript_txt
from api.database import init_db, get_db, User, Transcript, ChatMessage, SpeakerMapping, UserSettings
from api.auth import (
    verify_password, 
    get_password_hash, 
    create_access_token, 
    create_refresh_token,
    decode_token
)
import openai
import json

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
    email: EmailStr | None = None
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: str | None
    created_at: str

    class Config:
        from_attributes = True

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
    user: str = Depends(authenticate_token),
    db: Session = Depends(get_db)
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

        # Extract full text from transcript
        transcript_text = job.text if hasattr(job, 'text') else ""
        if not transcript_text and hasattr(job, 'utterances'):
            # Fallback: combine utterances
            transcript_text = "\n".join([f"{utt.speaker}: {utt.text}" for utt in job.utterances])
        
        # Save transcript to database
        db_user = get_user_by_username(db, user)
        if not db_user:
            raise HTTPException(
                status_code=401, 
                detail="User session expired or invalid. Please log out and log back in."
            )
        
        new_transcript = Transcript(
            transcript_id=base_name,
            user_id=db_user.id,
            filename=file.filename,
            text_content=transcript_text,
            json_content=json.dumps(job.json_response) if hasattr(job, 'json_response') else None
        )
        db.add(new_transcript)
        db.commit()
        db.refresh(new_transcript)

        return {
            "id": base_name,
            "text_file": f"/transcripts/{base_name}?format=txt",
            "json_file": f"/transcripts/{base_name}?format=json",
            "database_id": new_transcript.id
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/transcripts/list")
async def list_transcripts(
    user: str = Depends(authenticate_token),
    db: Session = Depends(get_db)
):
    """List all transcripts for the current user"""
    db_user = get_user_by_username(db, user)
    if not db_user:
        raise HTTPException(
            status_code=401, 
            detail="User session expired or invalid. Please log out and log back in."
        )
    
    transcripts = db.query(Transcript).filter(Transcript.user_id == db_user.id).order_by(Transcript.created_at.desc()).all()
    
    return [
        {
            "id": t.id,
            "transcript_id": t.transcript_id,
            "filename": t.filename,
            "created_at": t.created_at.isoformat(),
            "preview": t.text_content[:200] + "..." if len(t.text_content) > 200 else t.text_content
        }
        for t in transcripts
    ]


@app.get("/transcripts/{transcript_id}")
def get_transcript(transcript_id: str, format: str = "txt", user: str = Depends(authenticate_token)):
    ext = ".json" if format == "json" else ".txt"
    file_path = OUTPUT_DIR / f"{transcript_id}{ext}"
    if not file_path.exists():
        return JSONResponse(status_code=404, content={"error": "Transcript not found"})
    return FileResponse(file_path)


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    content: str
    role: str
    created_at: str


class SpeakerUpdate(BaseModel):
    original_label: str
    display_name: str


class SettingsUpdate(BaseModel):
    system_prompt_template: str | None = None


@app.get("/settings")
async def get_settings(
    user: str = Depends(authenticate_token),
    db: Session = Depends(get_db)
):
    """Get user settings"""
    db_user = get_user_by_username(db, user)
    if not db_user.settings:
        # Return defaults if no settings exist
        return {"system_prompt_template": None}
    
    return {
        "system_prompt_template": db_user.settings.system_prompt_template
    }


@app.put("/settings")
async def update_settings(
    settings: SettingsUpdate,
    user: str = Depends(authenticate_token),
    db: Session = Depends(get_db)
):
    """Update user settings"""
    db_user = get_user_by_username(db, user)
    
    if not db_user.settings:
        user_settings = UserSettings(user_id=db_user.id)
        db.add(user_settings)
        db_user.settings = user_settings
    
    db_user.settings.system_prompt_template = settings.system_prompt_template
    db.commit()
    
    return {"status": "success", "settings": settings}


@app.get("/transcripts/{transcript_id}/utterances")
async def get_transcript_utterances(
    transcript_id: int,
    user: str = Depends(authenticate_token),
    db: Session = Depends(get_db)
):
    """Get utterances and speaker mappings for a transcript"""
    # Verify transcript belongs to user
    db_user = get_user_by_username(db, user)
    transcript = db.query(Transcript).filter(
        Transcript.id == transcript_id,
        Transcript.user_id == db_user.id
    ).first()
    
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")
    
    # Get speaker mappings
    mappings = {m.original_label: m.display_name for m in transcript.speaker_mappings}
    
    # Parse JSON content
    utterances = []
    if transcript.json_content:
        try:
            data = json.loads(transcript.json_content)
            if 'utterances' in data and data['utterances']:
                utterances = data['utterances']
        except json.JSONDecodeError:
            pass
            
    return {
        "utterances": utterances,
        "speakers": mappings
    }


@app.put("/transcripts/{transcript_id}/speakers")
async def update_speaker_mapping(
    transcript_id: int,
    speaker_update: SpeakerUpdate,
    user: str = Depends(authenticate_token),
    db: Session = Depends(get_db)
):
    """Update speaker name mapping"""
    # Verify transcript belongs to user
    db_user = get_user_by_username(db, user)
    transcript = db.query(Transcript).filter(
        Transcript.id == transcript_id,
        Transcript.user_id == db_user.id
    ).first()
    
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")
    
    # Check if mapping exists
    mapping = db.query(SpeakerMapping).filter(
        SpeakerMapping.transcript_id == transcript_id,
        SpeakerMapping.original_label == speaker_update.original_label
    ).first()
    
    if mapping:
        mapping.display_name = speaker_update.display_name
    else:
        mapping = SpeakerMapping(
            transcript_id=transcript_id,
            original_label=speaker_update.original_label,
            display_name=speaker_update.display_name
        )
        db.add(mapping)
        
    db.commit()
    
    return {"status": "success", "display_name": speaker_update.display_name}


@app.post("/chat/{transcript_id}", response_model=ChatResponse)
async def chat_with_transcript(
    transcript_id: int,
    chat_request: ChatRequest,
    user: str = Depends(authenticate_token),
    db: Session = Depends(get_db)
):
    """Send a chat message and get AI response about the transcript"""
    # Get OpenAI API key
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        raise HTTPException(
            status_code=500,
            detail="OPENAI_API_KEY not configured. Please add it to your environment variables."
        )
    
    # Verify transcript belongs to user
    db_user = get_user_by_username(db, user)
    transcript = db.query(Transcript).filter(
        Transcript.id == transcript_id,
        Transcript.user_id == db_user.id
    ).first()
    
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")
    
    # Save user message
    user_message = ChatMessage(
        transcript_id=transcript_id,
        role="user",
        content=chat_request.message
    )
    db.add(user_message)
    db.commit()
    
    # Get chat history
    chat_history = db.query(ChatMessage).filter(
        ChatMessage.transcript_id == transcript_id
    ).order_by(ChatMessage.created_at).limit(20).all()
    
    # Get user settings for custom prompt
    system_prompt = f"You are a helpful assistant analyzing an audio transcript. Here is the full transcript:\n\n{transcript.text_content}\n\nAnswer questions about this transcript accurately and concisely."
    
    if db_user.settings and db_user.settings.system_prompt_template:
        # Inject transcript into template
        template = db_user.settings.system_prompt_template
        # Replace {transcript} placeholder, or append if not present
        if "{transcript}" in template:
            system_prompt = template.replace("{transcript}", transcript.text_content)
        else:
            system_prompt = f"{template}\n\n[TRANSCRIPT]:\n{transcript.text_content}"

    # Build messages for OpenAI
    messages = [
        {
            "role": "system",
            "content": system_prompt
        }
    ]
    
    # Add chat history (excluding the current message since it's already in the prompt)
    for msg in chat_history[:-1]:  # Exclude last message (the one we just added)
        messages.append({
            "role": msg.role,
            "content": msg.content
        })
    
    # Add current user message
    messages.append({
        "role": "user",
        "content": chat_request.message
    })
    
    try:
        # Call OpenAI API
        client = openai.OpenAI(api_key=openai_api_key)
        print(f"🤖 Calling OpenAI with {len(messages)} messages...")
        response = client.chat.completions.create(
            model="gpt-4o-mini",  # Use gpt-4o-mini for cost-effectiveness, or "gpt-4" for better quality
            messages=messages,
            max_tokens=1000,
            temperature=0.7
        )
        
        ai_response = response.choices[0].message.content
        print(f"✅ OpenAI response: {ai_response[:100]}...")
        
        # Save assistant message
        assistant_message = ChatMessage(
            transcript_id=transcript_id,
            role="assistant",
            content=ai_response or ""  # Ensure we don't save None
        )
        db.add(assistant_message)
        db.commit()
        db.refresh(assistant_message)
        
        return ChatResponse(
            content=ai_response or "",
            role="assistant",
            created_at=assistant_message.created_at.isoformat()
        )
        
    except Exception as e:
        print(f"❌ OpenAI API error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"OpenAI API error: {str(e)}")


@app.get("/chat/{transcript_id}/history")
async def get_chat_history(
    transcript_id: int,
    user: str = Depends(authenticate_token),
    db: Session = Depends(get_db)
):
    """Get chat history for a transcript"""
    # Verify transcript belongs to user
    db_user = get_user_by_username(db, user)
    transcript = db.query(Transcript).filter(
        Transcript.id == transcript_id,
        Transcript.user_id == db_user.id
    ).first()
    
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")
    
    messages = db.query(ChatMessage).filter(
        ChatMessage.transcript_id == transcript_id
    ).order_by(ChatMessage.created_at).all()
    
    return [
        {
            "id": msg.id,
            "role": msg.role,
            "content": msg.content,
            "created_at": msg.created_at.isoformat()
        }
        for msg in messages
    ]


@app.delete("/chat/{transcript_id}/history")
async def clear_chat_history(
    transcript_id: int,
    user: str = Depends(authenticate_token),
    db: Session = Depends(get_db)
):
    """Clear chat history for a transcript"""
    # Verify transcript belongs to user
    db_user = get_user_by_username(db, user)
    transcript = db.query(Transcript).filter(
        Transcript.id == transcript_id,
        Transcript.user_id == db_user.id
    ).first()
    
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")
    
    # Delete all chat messages
    db.query(ChatMessage).filter(ChatMessage.transcript_id == transcript_id).delete()
    db.commit()
    
    return {"message": "Chat history cleared"}


@app.get("/health")
def health():
    return {"status": "ok"}
