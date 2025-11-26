# api/app.py
from pathlib import Path
import sys
sys.path.append(str(Path(__file__).resolve().parents[1]))

from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, PlainTextResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional
from sqlalchemy.orm import Session
from pathlib import Path
import shutil, uuid, os, re
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

        # Extract full text from transcript with speaker labels
        # Always use utterances format for consistency with speaker mappings
        if hasattr(job, 'utterances') and job.utterances:
            transcript_text = "\n".join([f"{utt.speaker}: {utt.text}" for utt in job.utterances])
            # Debug: print first speaker label format
            if job.utterances:
                print(f"🔍 First speaker label format: '{job.utterances[0].speaker}'")
        else:
            # Fallback to plain text if no utterances
            transcript_text = job.text if hasattr(job, 'text') else ""
        
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


class TranscriptUpdate(BaseModel):
    filename: str


@app.patch("/transcripts/{transcript_id}")
async def rename_transcript(
    transcript_id: int,
    update: TranscriptUpdate,
    user: str = Depends(authenticate_token),
    db: Session = Depends(get_db)
):
    """Rename a transcript"""
    db_user = get_user_by_username(db, user)
    transcript = db.query(Transcript).filter(
        Transcript.id == transcript_id,
        Transcript.user_id == db_user.id
    ).first()
    
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")
    
    transcript.filename = update.filename
    db.commit()
    
    return {"status": "success", "filename": update.filename}


@app.delete("/transcripts/{transcript_id}")
async def delete_transcript(
    transcript_id: int,
    user: str = Depends(authenticate_token),
    db: Session = Depends(get_db)
):
    """Delete a transcript and all associated data"""
    db_user = get_user_by_username(db, user)
    transcript = db.query(Transcript).filter(
        Transcript.id == transcript_id,
        Transcript.user_id == db_user.id
    ).first()
    
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")
    
    # Delete associated chat messages
    db.query(ChatMessage).filter(ChatMessage.transcript_id == transcript_id).delete()
    
    # Delete speaker mappings
    db.query(SpeakerMapping).filter(SpeakerMapping.transcript_id == transcript_id).delete()
    
    # Delete the transcript
    db.delete(transcript)
    db.commit()
    
    return {"status": "success", "message": "Transcript deleted"}


@app.get("/transcripts/{transcript_id}")
def get_transcript(
    transcript_id: str, 
    format: str = "txt", 
    user: str = Depends(authenticate_token),
    db: Session = Depends(get_db)
):
    """Download transcript with speaker names applied"""
    # Try to parse as database ID first
    db_user = get_user_by_username(db, user)
    transcript = None
    
    # Check if it's a numeric ID (database_id)
    if transcript_id.isdigit():
        transcript = db.query(Transcript).filter(
            Transcript.id == int(transcript_id),
            Transcript.user_id == db_user.id
        ).first()
    
    # If not found, try as transcript_id (filename-based)
    if not transcript:
        transcript = db.query(Transcript).filter(
            Transcript.transcript_id == transcript_id,
            Transcript.user_id == db_user.id
        ).first()
    
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")
    
    # Get speaker mappings
    speaker_mappings = db.query(SpeakerMapping).filter(
        SpeakerMapping.transcript_id == transcript.id
    ).all()
    
    if format == "json":
        # For JSON, parse and replace speaker names in utterances
        if not transcript.json_content:
            raise HTTPException(status_code=404, detail="JSON content not found")
        
        json_data = json.loads(transcript.json_content)
        
        # Apply mappings to utterances if they exist
        if 'utterances' in json_data:
            for utt in json_data['utterances']:
                for mapping in speaker_mappings:
                    if utt.get('speaker') == mapping.original_label:
                        utt['speaker'] = mapping.display_name
        
        return JSONResponse(content=json_data)
    else:
        # For TXT, apply mappings to text content
        transcript_text = transcript.text_content
        
        for mapping in speaker_mappings:
            # Replace speaker labels at start of lines
            pattern = re.compile(r'^' + re.escape(mapping.original_label) + r':', flags=re.MULTILINE)
            transcript_text = pattern.sub(mapping.display_name + ':', transcript_text)
        
        # Return as plain text
        return PlainTextResponse(content=transcript_text)


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
    system_prompt_template: Optional[str] = None
    default_user_prompt: Optional[str] = None


@app.get("/settings")
async def get_settings(
    user: str = Depends(authenticate_token),
    db: Session = Depends(get_db)
):
    """Get user settings"""
    db_user = get_user_by_username(db, user)
    if not db_user.settings:
        # Return defaults if no settings exist
        return {"system_prompt_template": None, "default_user_prompt": None}
    
    return {
        "system_prompt_template": db_user.settings.system_prompt_template,
        "default_user_prompt": db_user.settings.default_user_prompt
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
    db_user.settings.default_user_prompt = settings.default_user_prompt
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
    
    # Apply speaker mappings to transcript
    transcript_text = transcript.text_content
    speaker_mappings = db.query(SpeakerMapping).filter(
        SpeakerMapping.transcript_id == transcript_id
    ).all()
    
    print(f"🔍 Found {len(speaker_mappings)} speaker mappings")
    for mapping in speaker_mappings:
        print(f"🔍 Mapping: '{mapping.original_label}' → '{mapping.display_name}'")
        # Replace original speaker labels with custom names (only at start of lines with colon)
        # This ensures we don't replace speaker labels that appear in the text itself
        pattern = re.compile(r'^' + re.escape(mapping.original_label) + r':', flags=re.MULTILINE)
        before_count = len(transcript_text)
        transcript_text = pattern.sub(mapping.display_name + ':', transcript_text)
        after_count = len(transcript_text)
        if before_count != after_count:
            print(f"✅ Replaced '{mapping.original_label}' with '{mapping.display_name}'")
        else:
            print(f"⚠️  No matches found for pattern '^{mapping.original_label}:'")
            # Show first 200 chars of transcript for debugging
            print(f"   First 200 chars: {transcript_text[:200]}")
    
    # Get user settings for custom prompt
    system_prompt = f"You are a helpful assistant analyzing an audio transcript. Here is the full transcript:\n\n{transcript_text}\n\nAnswer questions about this transcript accurately and concisely."
    
    if db_user.settings and db_user.settings.system_prompt_template:
        # Inject transcript into template
        template = db_user.settings.system_prompt_template
        # Replace {transcript} placeholder, or append if not present
        if "{transcript}" in template:
            system_prompt = template.replace("{transcript}", transcript_text)
        else:
            system_prompt = f"{template}\n\n[TRANSCRIPT]:\n{transcript_text}"

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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
