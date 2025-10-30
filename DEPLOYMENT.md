# Deployment Guide

This guide covers deploying both the backend API and frontend web application.

## Backend Deployment

### Option 1: Docker (Recommended)

1. Create a `Dockerfile`:
```dockerfile
FROM python:3.11-slim

# Install ffmpeg
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "api.app:app", "--host", "0.0.0.0", "--port", "8000"]
```

2. Build and run:
```bash
docker build -t voice-transcript-api .
docker run -p 8000:8000 --env-file .env voice-transcript-api
```

### Option 2: Traditional Hosting (VPS/EC2)

1. Install dependencies:
```bash
sudo apt update
sudo apt install python3-pip ffmpeg nginx
```

2. Clone and setup:
```bash
git clone <your-repo>
cd voice_transcript
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

3. Create systemd service (`/etc/systemd/system/voice-transcript.service`):
```ini
[Unit]
Description=Voice Transcript API
After=network.target

[Service]
User=www-data
WorkingDirectory=/path/to/voice_transcript
Environment="PATH=/path/to/voice_transcript/.venv/bin"
ExecStart=/path/to/voice_transcript/.venv/bin/uvicorn api.app:app --host 0.0.0.0 --port 8000

[Install]
WantedBy=multi-user.target
```

4. Start service:
```bash
sudo systemctl enable voice-transcript
sudo systemctl start voice-transcript
```

5. Configure Nginx as reverse proxy:
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Option 3: Platform as a Service

#### Railway
1. Connect your GitHub repository
2. Add environment variables
3. Deploy automatically

#### Render
1. Create new Web Service
2. Connect repository
3. Set build command: `pip install -r requirements.txt`
4. Set start command: `uvicorn api.app:app --host 0.0.0.0 --port $PORT`
5. Add environment variables

#### Fly.io
```bash
fly launch
fly secrets set AAI_API_KEY=your_key
fly deploy
```

## Frontend Deployment

### Option 1: Netlify (Recommended for Web Apps)

1. Build the frontend:
```bash
cd frontend
npm run build
```

2. Deploy via Netlify CLI:
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

Or connect your GitHub repo in Netlify dashboard with these settings:
- Build command: `cd frontend && npm install && npm run build`
- Publish directory: `frontend/dist`
- Environment variable: `VITE_API_URL=https://your-api-domain.com`

### Option 2: Vercel

```bash
cd frontend
npm install -g vercel
vercel --prod
```

Environment variables in Vercel dashboard:
- `VITE_API_URL`: Your API URL

### Option 3: AWS S3 + CloudFront

1. Build:
```bash
cd frontend
npm run build
```

2. Upload to S3:
```bash
aws s3 sync dist/ s3://your-bucket-name/ --delete
```

3. Configure CloudFront distribution pointing to S3 bucket

### Option 4: Docker + Nginx

Create `frontend/Dockerfile`:
```dockerfile
FROM node:18 as build

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## Environment Variables

### Backend (.env)
```bash
AAI_API_KEY=your_assemblyai_api_key
JWT_SECRET=random_secure_string_here
APP_USER=admin
APP_PASS=your_secure_password
CORS_ORIGINS=https://yourdomain.com
```

### Frontend (.env)
```bash
VITE_API_URL=https://api.yourdomain.com
```

## Post-Deployment Checklist

- [ ] Update CORS_ORIGINS in backend .env
- [ ] Set strong JWT_SECRET
- [ ] Change default APP_USER and APP_PASS
- [ ] Configure HTTPS/SSL certificates
- [ ] Set up monitoring (health endpoint)
- [ ] Configure backup for outputs directory
- [ ] Set up log rotation
- [ ] Test authentication flow
- [ ] Test file upload and transcription
- [ ] Monitor API rate limits (AssemblyAI)

## Security Recommendations

1. **Always use HTTPS in production**
2. **Use strong passwords and JWT secrets**
3. **Implement rate limiting** (consider nginx limit_req)
4. **Set up firewall rules**
5. **Regular security updates**
6. **Monitor logs for suspicious activity**
7. **Consider adding CAPTCHA for login**
8. **Implement file size and type validation**

## Scaling Considerations

- Use cloud storage (S3, GCS) instead of local filesystem
- Implement job queue (Celery, RQ) for transcriptions
- Add Redis for session management
- Use managed database for user data
- Consider CDN for frontend assets
- Add load balancer for multiple API instances
