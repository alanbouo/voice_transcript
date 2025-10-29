# api/app.py
from pathlib import Path
import sys
sys.path.append(str(Path(__file__).resolve().parents[1]))
# api/app.py
from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pathlib import Path
import shutil, uuid, os, jwt, datetime
from dotenv import load_dotenv
from scripts.convert import convert_to_mp3
from scripts.transcribe import transcribe_audio
from scripts.export import save_transcript_json, save_transcript_txt
import secrets

load_dotenv()

app = FastAPI()
INPUT_DIR = Path("inputs")
OUTPUT_DIR = Path("outputs")
INPUT_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

SECRET_KEY = os.getenv("JWT_SECRET", "supersecret")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 10
REFRESH_TOKEN_EXPIRE_DAYS = 7

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/token")

QUALITY_PRESETS = {
    "high": "128k",
    "medium": "96k",
    "low": "64k"
}

refresh_tokens_db = {}

def create_token(data: dict, expires_delta: datetime.timedelta):
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def authenticate_token(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

@app.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    correct_username = os.getenv("APP_USER", "admin")
    correct_password = os.getenv("APP_PASS", "secret")
    if form_data.username != correct_username or form_data.password != correct_password:
        raise HTTPException(status_code=400, detail="Incorrect username or password")

    access_token_expires = datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    refresh_token_expires = datetime.timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    access_token = create_token({"sub": form_data.username}, access_token_expires)
    refresh_token = create_token({"sub": form_data.username}, refresh_token_expires)
    refresh_tokens_db[refresh_token] = form_data.username

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

@app.post("/refresh")
async def refresh_token_endpoint(refresh_token: str = Form(...)):
    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if refresh_token not in refresh_tokens_db or refresh_tokens_db[refresh_token] != username:
            raise HTTPException(status_code=401, detail="Invalid refresh token")

        new_access_token = create_token({"sub": username}, datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
        return {"access_token": new_access_token, "token_type": "bearer"}
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

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
