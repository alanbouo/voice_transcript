# Quick Start Guide

## Prerequisites

Before starting, make sure you have:
- Python 3.9+ installed
- Node.js 18+ installed
- ffmpeg installed (`brew install ffmpeg` on macOS)
- An AssemblyAI API key ([Get one here](https://www.assemblyai.com/))

## Setup (5 minutes)

### 1. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your credentials
# Required: AAI_API_KEY=your_assemblyai_key
# Optional: Change APP_USER and APP_PASS for security
```

### 2. Start Development Servers

#### Option A: Automatic (Recommended)
```bash
./start_dev.sh
```

This script will:
- Create Python virtual environment
- Install all dependencies (backend + frontend)
- Start both servers automatically

#### Option B: Manual

**Terminal 1 - Backend:**
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn api.app:app --reload
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### 3. Access the Application

- **Web App**: http://localhost:3000
- **API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### 4. Create Account & Login

When you first visit the app:
1. Click "Don't have an account? Create one"
2. Enter your desired username and password
3. Click "Create Account"
4. Sign in with your new credentials

## Using the App

1. **Upload Audio**: Drag & drop or browse for an audio file (.m4a, .mp3, .wav)
2. **Select Quality**: Choose low/medium/high compression
3. **Transcribe**: Click "Start Transcription" and wait for processing
4. **View Results**: View transcript in-browser or download as TXT/JSON

## Troubleshooting

### Backend won't start
- Check if port 8000 is available: `lsof -i :8000`
- Verify `.env` file exists and has `AAI_API_KEY`
- Make sure ffmpeg is installed: `ffmpeg -version`

### Frontend won't start
- Check if port 3000 is available: `lsof -i :3000`
- Delete `node_modules` and run `npm install` again
- Check `frontend/.env` has correct `VITE_API_URL`

### Authentication fails
- Check `APP_USER` and `APP_PASS` in `.env`
- Clear browser localStorage and try again
- Check browser console for errors

### Upload fails
- Check file size (max 100MB)
- Verify file format (.m4a, .mp3, .wav)
- Check API logs for errors
- Verify AssemblyAI API key is valid

## Next Steps

### Development
- See `frontend/README.md` for frontend development
- Check `DEPLOYMENT.md` for production deployment
- API documentation at http://localhost:8000/docs

### Production
1. Change default credentials in `.env`
2. Set strong `JWT_SECRET`
3. Configure CORS for your domain
4. Deploy using Docker or cloud platform
5. Set up HTTPS/SSL certificates

### Testing
- Test file upload with various formats
- Test quality settings
- Test authentication flow
- Test on mobile devices

## Common Commands

```bash
# Start development
./start_dev.sh

# Build frontend for production
cd frontend && npm run build

# Run backend only
uvicorn api.app:app --reload

# Run with Docker
docker-compose up

# View API logs
tail -f logs/api.log  # If logging is configured

# Clean build artifacts
cd frontend && rm -rf dist node_modules && npm install
```

## Getting Help

- Check `README.md` for detailed documentation
- See `DEPLOYMENT.md` for deployment guides
- Review `api/app.py` for API endpoints
- Check browser console and terminal logs for errors

## Quick Links

- [AssemblyAI Documentation](https://www.assemblyai.com/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [TailwindCSS Documentation](https://tailwindcss.com/)
