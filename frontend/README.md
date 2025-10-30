# Voice Transcript Frontend

Modern React web interface for the Voice Transcript audio transcription service.

## Features

- 🔐 Secure authentication with JWT tokens
- 📤 Drag & drop file upload interface
- 🎚️ Adjustable transcription quality (low/medium/high)
- 📊 Real-time upload progress tracking
- 📝 Transcript viewer with download options
- 📱 Responsive design with TailwindCSS
- 🎨 Modern UI with Lucide icons

## Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **TailwindCSS** - Styling
- **React Router** - Navigation
- **Axios** - HTTP client
- **Lucide React** - Icons

## Prerequisites

- Node.js >= 18
- npm or yarn
- Backend API running on port 8000

## Installation

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Update `.env` with your API URL:
```
VITE_API_URL=http://localhost:8000
```

## Development

Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Build for Production

Build the app:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

## Project Structure

```
frontend/
├── src/
│   ├── components/       # React components
│   │   ├── Login.jsx     # Authentication page
│   │   ├── Dashboard.jsx # Main dashboard
│   │   ├── Upload.jsx    # File upload interface
│   │   └── TranscriptViewer.jsx # Transcript display
│   ├── services/
│   │   └── api.js        # API client with interceptors
│   ├── utils/
│   │   └── auth.js       # Token management
│   ├── App.jsx           # Main app component
│   ├── main.jsx          # Entry point
│   └── index.css         # Global styles
├── public/               # Static assets
└── package.json          # Dependencies
```

## Default Credentials

- Username: `admin`
- Password: `secret`

(These can be changed in the backend `.env` file)

## API Endpoints Used

- `POST /token` - Authentication
- `POST /refresh` - Token refresh
- `POST /transcribe` - Upload and transcribe audio
- `GET /transcripts/{id}` - Retrieve transcript
- `GET /health` - Health check

## Deployment

The frontend can be deployed to:
- Netlify
- Vercel
- AWS S3 + CloudFront
- Any static hosting service

Make sure to update the `VITE_API_URL` environment variable to point to your production API.
