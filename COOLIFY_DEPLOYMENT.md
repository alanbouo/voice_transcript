# Coolify Deployment Guide

Complete guide to deploy Voice Transcript app on Coolify with PostgreSQL database.

## 📋 Prerequisites

- Coolify instance running
- GitHub/GitLab repository for your code
- Domain name (optional but recommended)

## 🗄️ Step 1: Create PostgreSQL Database

### In Coolify Dashboard:

1. Go to **Databases** section
2. Click **+ Add Database**
3. Select **PostgreSQL**
4. Configure:
   - **Name**: `voice-transcript-db`
   - **Version**: PostgreSQL 15 or 16
   - **Database Name**: `voicetranscript`
   - **Username**: `voiceuser` (or auto-generated)
   - **Password**: (auto-generated - save this!)

5. Click **Create**
6. Wait for database to be provisioned (1-2 minutes)

### Get Database Connection String:

Once created, Coolify will provide a connection URL like:
```
postgresql://voiceuser:password@postgres-xyz.coolify:5432/voicetranscript
```

**Save this URL** - you'll need it for the app configuration.

## 🚀 Step 2: Deploy the Application

### Option A: Deploy from Git Repository (Recommended)

1. **Push your code to GitHub/GitLab**
   ```bash
   git add .
   git commit -m "Add Coolify deployment config"
   git push origin main
   ```

2. **In Coolify Dashboard:**
   - Go to **Applications**
   - Click **+ Add Application**
   - Select **Public Repository** or **Private Repository**
   - Enter your repository URL

3. **Configure Build Settings:**
   - **Build Pack**: Dockerfile
   - **Dockerfile Location**: `./Dockerfile`
   - **Port**: `8000`
   - **Health Check Path**: `/health`

### Option B: Deploy via Docker Image

If you prefer to build locally:

```bash
# Build and push to registry
docker build -t your-registry/voice-transcript:latest .
docker push your-registry/voice-transcript:latest
```

Then in Coolify, use the **Docker Image** deployment option.

## ⚙️ Step 3: Configure Environment Variables

In Coolify, go to your application → **Environment Variables** and add:

### Required Variables:

```bash
# AssemblyAI API Key
AAI_API_KEY=your_assemblyai_api_key_here

# Database Connection (from Step 1)
DATABASE_URL=postgresql://voiceuser:password@postgres-xyz.coolify:5432/voicetranscript

# JWT Secret (generate a strong random string)
JWT_SECRET=your_super_secure_random_secret_key_here

# CORS Origins (your frontend domains)
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Optional: Authentication (not needed anymore with user registration)
# APP_USER=admin
# APP_PASS=secret
```

### Generate Strong JWT Secret:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

## 🌐 Step 4: Deploy Frontend

### Option 1: Deploy on Coolify

1. **Create new Application** for frontend
2. **Build Settings:**
   - **Build Pack**: Static
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Publish Directory**: `frontend/dist`
   - **Port**: `80`

3. **Environment Variables:**
   ```bash
   VITE_API_URL=https://api.yourdomain.com
   ```

### Option 2: Deploy on Netlify/Vercel (Easier for frontend)

If you prefer, deploy frontend separately:

**Netlify:**
```bash
cd frontend
npm run build
netlify deploy --prod --dir=dist
```

**Vercel:**
```bash
cd frontend
vercel --prod
```

## 🔗 Step 5: Configure Domains

### For Backend API:

1. In Coolify → Your App → **Domains**
2. Add domain: `api.yourdomain.com`
3. Enable **Generate Let's Encrypt Certificate**
4. Wait for SSL certificate (2-3 minutes)

### For Frontend:

1. Add domain: `app.yourdomain.com` or `yourdomain.com`
2. Enable SSL certificate

### Update CORS:

Update your backend environment variable:
```bash
CORS_ORIGINS=https://app.yourdomain.com,https://yourdomain.com
```

## 📦 Step 6: Configure Persistent Storage

For file uploads (inputs/outputs directories):

1. In Coolify → Your App → **Persistent Storage**
2. Add volume:
   - **Source**: `voice-transcript-inputs`
   - **Destination**: `/app/inputs`
3. Add another volume:
   - **Source**: `voice-transcript-outputs`
   - **Destination**: `/app/outputs`

## 🔍 Step 7: Verify Deployment

1. **Check API Health:**
   ```bash
   curl https://api.yourdomain.com/health
   ```
   Should return: `{"status":"ok"}`

2. **Check Database Connection:**
   - Visit `https://api.yourdomain.com/docs`
   - Try to register a new user
   - Check logs in Coolify for any errors

3. **Test Frontend:**
   - Visit `https://app.yourdomain.com`
   - Register a new account
   - Try uploading and transcribing a file

## 🔒 Security Checklist

- [ ] Changed `JWT_SECRET` to a strong random value
- [ ] SSL/HTTPS enabled for both frontend and backend
- [ ] CORS configured for your specific domains only
- [ ] Database password is strong and secure
- [ ] AssemblyAI API key is kept secret
- [ ] Regular database backups enabled in Coolify

## 📊 Monitoring & Logs

### View Application Logs:

In Coolify → Your App → **Logs**

### Database Logs:

In Coolify → Your Database → **Logs**

### Common Issues:

**Database connection fails:**
```bash
# Check if DATABASE_URL is correct
# Ensure database is running
# Check firewall/network settings in Coolify
```

**CORS errors:**
```bash
# Add your frontend domain to CORS_ORIGINS
# Restart the application
```

**502 Bad Gateway:**
```bash
# Check if app is listening on port 8000
# Check health endpoint
# Review application logs
```

## 🔄 Updates & Deployments

Coolify can auto-deploy on git push:

1. Go to **Settings** → **Deployment**
2. Enable **Auto Deploy**
3. Select branch (e.g., `main`)
4. Every push will trigger automatic deployment

## 💾 Database Backups

### Enable Automatic Backups:

1. Coolify → Your Database → **Backups**
2. Enable automatic backups
3. Set schedule (e.g., daily at 2 AM)
4. Configure retention (e.g., keep 7 days)

### Manual Backup:

```bash
# SSH into Coolify server or use database tools
pg_dump -U voiceuser -h localhost voicetranscript > backup.sql
```

### Restore from Backup:

```bash
psql -U voiceuser -h localhost voicetranscript < backup.sql
```

## 🎯 Production Optimization

### 1. Add Redis for Session Management

In production, replace in-memory refresh tokens with Redis:

```bash
# In Coolify, add Redis database
# Update code to use Redis instead of refresh_tokens_db dict
```

### 2. Enable Rate Limiting

Use nginx or add rate limiting middleware:

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.post("/register")
@limiter.limit("5/hour")  # Max 5 registrations per hour per IP
async def register(...):
    ...
```

### 3. Use Object Storage for Files

Instead of local volumes, use S3-compatible storage:

```python
import boto3

s3 = boto3.client('s3',
    endpoint_url=os.getenv('S3_ENDPOINT'),
    aws_access_key_id=os.getenv('S3_ACCESS_KEY'),
    aws_secret_access_key=os.getenv('S3_SECRET_KEY')
)
```

### 4. Add Monitoring

- **Sentry** for error tracking
- **Prometheus** for metrics
- **Grafana** for dashboards

## 📝 Environment Variables Summary

```bash
# Required
AAI_API_KEY=sk_xxxxxxxxxxxxx
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx

# Recommended
CORS_ORIGINS=https://yourdomain.com
PORT=8000

# Optional Production
SENTRY_DSN=https://xxx@sentry.io/xxx
REDIS_URL=redis://redis:6379/0
S3_ENDPOINT=https://s3.amazonaws.com
S3_ACCESS_KEY=xxx
S3_SECRET_KEY=xxx
S3_BUCKET=voice-transcripts
```

## 🆘 Troubleshooting

### Database Migration Issues

If you're migrating from SQLite to PostgreSQL:

```bash
# Export SQLite data
sqlite3 voice_transcript.db .dump > sqlite_dump.sql

# Clean up for PostgreSQL
sed 's/INTEGER PRIMARY KEY AUTOINCREMENT/SERIAL PRIMARY KEY/' sqlite_dump.sql > pg_dump.sql

# Import to PostgreSQL
psql -U voiceuser -h localhost voicetranscript < pg_dump.sql
```

### Connection Pooling

For high traffic, add connection pooling:

```python
from sqlalchemy.pool import QueuePool

engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=10,
    max_overflow=20
)
```

## 📚 Additional Resources

- [Coolify Documentation](https://coolify.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)
- [SQLAlchemy Best Practices](https://docs.sqlalchemy.org/en/20/core/pooling.html)

## 🎉 You're Done!

Your Voice Transcript app is now running in production with:
- ✅ PostgreSQL database
- ✅ SSL/HTTPS encryption
- ✅ User registration and authentication
- ✅ Automatic deployments
- ✅ Database backups
- ✅ Persistent file storage

Need help? Check the logs in Coolify or review the troubleshooting section above.
