# Coolify Quick Setup - TL;DR

## 🎯 Recommended: PostgreSQL Database

Your app now supports **both SQLite (dev) and PostgreSQL (production)** automatically!

## ⚡ Quick Setup Steps

### 1. Create Database in Coolify (2 minutes)

```
Databases → + Add Database → PostgreSQL

Settings:
  Name: voice-transcript-db
  Database: voicetranscript
  Version: 15 or 16
  
→ Copy the connection URL provided
```

Example URL you'll get:
```
postgresql://voiceuser:xyz123@postgres-abc.coolify:5432/voicetranscript
```

### 2. Deploy Application (5 minutes)

```
Applications → + Add Application → From Git

Repository: your-github-repo-url
Build: Dockerfile
Port: 8000
Health Check: /health
```

### 3. Set Environment Variables

In Coolify → Your App → Environment:

```bash
AAI_API_KEY=your_assemblyai_key
DATABASE_URL=postgresql://voiceuser:xyz@postgres-abc.coolify:5432/voicetranscript
JWT_SECRET=<run command below to generate>
CORS_ORIGINS=https://yourdomain.com
```

**Generate JWT Secret:**
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 4. Add Persistent Storage (Optional)

```
Storage:
  - /app/inputs  → voice-transcript-inputs
  - /app/outputs → voice-transcript-outputs
```

### 5. Deploy & Test

```bash
# Check health
curl https://api.yourdomain.com/health

# Visit API docs
https://api.yourdomain.com/docs

# Test registration
Visit frontend → Create account
```

## 🔄 If Migrating from Local SQLite

If you already have users in local SQLite database:

```bash
# Install PostgreSQL driver first
pip install psycopg2-binary

# Run migration script
python migrate_to_postgres.py postgresql://user:pass@host:5432/db
```

## ✅ What Changed in Your Code

- ✅ `api/database.py` - Now auto-detects PostgreSQL via `DATABASE_URL`
- ✅ `requirements.txt` - Added `psycopg2-binary` for PostgreSQL
- ✅ `.env.example` - Added `DATABASE_URL` configuration
- ✅ Migration script included for easy data transfer

## 🎁 Benefits of PostgreSQL on Coolify

- **Auto-backups** - Coolify handles daily backups
- **Better performance** - Handles concurrent users better
- **Scalability** - Can grow with your app
- **Separation** - Database separate from app container
- **Easy management** - Web UI to view/manage database

## 🚀 Your App Automatically Detects Database

**Development (local):**
- No `DATABASE_URL` set → Uses SQLite (`voice_transcript.db`)

**Production (Coolify):**
- `DATABASE_URL` set → Uses PostgreSQL automatically

No code changes needed! 🎉

## 📝 Environment Variables Cheat Sheet

| Variable | Required | Example |
|----------|----------|---------|
| `AAI_API_KEY` | ✅ Yes | `sk_xxx...` |
| `DATABASE_URL` | Production | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | ✅ Yes | Use `secrets.token_urlsafe(32)` |
| `CORS_ORIGINS` | Production | `https://app.mydomain.com` |

## 🆘 Quick Troubleshooting

**Database connection fails:**
```bash
# Make sure DATABASE_URL is exactly as provided by Coolify
# Check database is running in Coolify dashboard
```

**App won't start:**
```bash
# Check logs in Coolify → Your App → Logs
# Verify all environment variables are set
# Ensure port 8000 is configured
```

**Can't register users:**
```bash
# Check database logs in Coolify
# Verify DATABASE_URL is correct
# Tables should be created automatically on first run
```

## 📚 Full Documentation

- Complete guide: `COOLIFY_DEPLOYMENT.md`
- Migration details: `migrate_to_postgres.py`
- General deployment: `DEPLOYMENT.md`

---

**Need help?** Check the full `COOLIFY_DEPLOYMENT.md` guide for detailed steps!
