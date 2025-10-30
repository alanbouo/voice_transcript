#!/bin/bash

# Development startup script for Voice Transcript

# Add common paths for ffmpeg
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

echo "🎙️ Starting Voice Transcript Development Environment"
echo "=================================================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from example..."
    cp .env.example .env
    echo "✅ Created .env file. Please edit it with your API keys."
    exit 1
fi

# Check if Python venv exists
if [ ! -d .venv ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv .venv
fi

# Activate venv and install dependencies
echo "📦 Installing Python dependencies..."
source .venv/bin/activate
pip install -q -r requirements.txt

# Check if frontend node_modules exists
if [ ! -d frontend/node_modules ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

# Check if frontend .env exists
if [ ! -f frontend/.env ]; then
    echo "📝 Creating frontend .env..."
    cp frontend/.env.example frontend/.env
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Starting services..."
echo "- Backend API: http://localhost:8000"
echo "- Frontend: http://localhost:3000"
echo "- API Docs: http://localhost:8000/docs"
echo ""

# Start backend in background
echo "🚀 Starting backend API..."
uvicorn api.app:app --reload --port 8000 &
BACKEND_PID=$!

# Wait a bit for backend to start
sleep 2

# Start frontend
echo "🚀 Starting frontend..."
cd frontend && npm run dev &
FRONTEND_PID=$!

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup INT TERM

echo ""
echo "✅ Services running! Press Ctrl+C to stop."
echo ""

# Wait for processes
wait
