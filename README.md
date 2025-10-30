# 🎙️ VOICE_TRANSCRIPT

Automatic voice memo transcription service with speaker diarization, modern web interface, and structured export.

Powered by AssemblyAI's transcription API with FastAPI backend and React frontend.

---

## 🚀 Features

### Backend
- 🔄 Converts `.m4a` audio files to `.mp3` mono 16 kHz with adjustable compression
- ☁️ Uploads audio to AssemblyAI and transcribes in French with speaker labeling
- 📝 Exports results as JSON (structured) and TXT (readable)
- 🔐 JWT-based authentication with refresh tokens
- 🌐 RESTful API with CORS support

### Frontend
- 📤 Drag & drop file upload interface
- 🎚️ Quality selector (low/medium/high)
- 📊 Real-time upload progress
- 📝 Transcript viewer with download options
- 🎨 Modern, responsive UI with TailwindCSS
- 🔒 Secure authentication flow

---

## 🧰 Requirements

- Python ≥ 3.9
- An [AssemblyAI account](https://www.assemblyai.com/) with an API key
- `ffmpeg` installed (`brew install ffmpeg` on macOS, `apt install ffmpeg` on Linux)

---

## 📦 Installation

### Quick Start with Docker (Recommended)

1. Clone and configure:
```bash
git clone <your-repo>
cd voice_transcript
cp .env.example .env
# Edit .env and add your AssemblyAI API key
```

2. Run with Docker Compose:
```bash
docker-compose up
```

Access the app at `http://localhost:3000`

### Manual Installation

#### Backend Setup

1. Install Python dependencies:
```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

2. Install ffmpeg:
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env and add your credentials
```

4. Start the API server:
```bash
uvicorn api.app:app --reload
```

API will be available at `http://localhost:8000`

#### Frontend Setup

1. Install Node.js dependencies:
```bash
cd frontend
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Set VITE_API_URL=http://localhost:8000
```

3. Start development server:
```bash
npm run dev
```

Frontend will be available at `http://localhost:3000`

---

## ▶️ Usage

### Web Interface

1. Open `http://localhost:3000` in your browser
2. Login with default credentials (admin/secret)
3. Drag and drop an audio file or click to browse
4. Select quality and click "Start Transcription"
5. View and download results

### Command Line (Legacy)

Drop a voice memo in `inputs/` and run:

```bash
python scripts/main.py my_memo.m4a [quality]
```

Quality options: `high` (128k), `medium` (96k), `low` (64k)

---

## 📂 Project Structure

```
voice_transcript/
├── api/                   # FastAPI backend
│   └── app.py            # API endpoints and auth
├── frontend/             # React web interface
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── services/     # API client
│   │   └── utils/        # Auth helpers
│   └── package.json
├── scripts/              # Core transcription logic
│   ├── main.py          # CLI entry point
│   ├── transcribe.py    # AssemblyAI integration
│   └── export.py        # Output formatting
├── utils/               # Audio conversion utilities
├── inputs/              # Upload directory
├── outputs/             # Generated transcripts
├── .env                 # Environment config
├── requirements.txt     # Python dependencies
├── Dockerfile           # Backend container
├── docker-compose.yml   # Full stack orchestration
└── DEPLOYMENT.md        # Deployment guide
```

---

## 🧪 Sample `.txt` Output

```
Speaker A ▶ Hello, I’m calling about the maintenance contract.
Speaker B ▶ Sure, could you give me your case number?
```

---

## 🚀 Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions including:
- Docker deployment
- VPS/Cloud hosting (AWS, GCP, Azure)
- Platform services (Netlify, Vercel, Railway, Render)
- Production configuration
- Security best practices

## 📱 Mobile App (Coming Soon)

- [ ] iOS native app with Swift/SwiftUI
- [ ] In-app audio recording
- [ ] Offline mode support
- [ ] Push notifications

## 🔒 User Registration

The app now supports **user registration**! When you first access the login page:

1. Click "Don't have an account? Create one"
2. Enter a username and password (email is optional)
3. Click "Create Account"
4. Log in with your new credentials

All passwords are securely hashed with bcrypt, and user data is stored in a local SQLite database.

---

## 🙌 Credits

This project uses:
- [`assemblyai`](https://pypi.org/project/assemblyai/)
- [`tqdm`](https://github.com/tqdm/tqdm)
- `ffmpeg` for audio processing
