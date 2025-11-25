# Troubleshooting: Bad Gateway Error

## Current Issue
Frontend shows "Bad Gateway" when trying to reach `https://voice-be.alanbouo.com`

## Diagnosis Steps

### 1. Check Backend Service Status

In Coolify, verify your backend application:

- [ ] Is the backend application **running**? (Check status in Coolify dashboard)
- [ ] Are there any **error logs** in the backend container?
- [ ] Is the health check passing? (Try accessing `https://voice-be.alanbouo.com/health`)

### 2. Test Backend Directly

Open a new browser tab and try:

```
https://voice-be.alanbouo.com/health
```

**Expected response:**
```json
{"status": "ok"}
```

**If you get:**
- **Bad Gateway (502)**: Backend container is not running or crashed
- **Connection refused**: Backend is not accessible
- **404**: Backend is running but routing is wrong
- **200 OK**: Backend is working! The issue is elsewhere

### 3. Check Backend Logs

In Coolify:
1. Go to your backend application
2. Click on **Logs**
3. Look for:
   - Startup errors
   - Database connection errors
   - Port binding issues
   - Python/FastAPI errors

Common errors:
```
# Database connection failed
sqlalchemy.exc.OperationalError: could not connect to server

# Port already in use
OSError: [Errno 98] Address already in use

# Missing environment variable
KeyError: 'DATABASE_URL'
```

### 4. Verify Environment Variables

Backend needs these variables:

```bash
# Required
AAI_API_KEY=your_assemblyai_key
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=your_secret_key

# Important for CORS
CORS_ORIGINS=https://voice.alanbouo.com
```

### 5. Check Port Configuration

In Coolify backend settings:
- **Port**: Should be `8000`
- **Health Check Path**: `/health`
- **Health Check Method**: GET

### 6. Verify Domain/SSL

- [ ] Is SSL certificate valid for `voice-be.alanbouo.com`?
- [ ] Is the domain pointing to the correct server?
- [ ] Is Coolify's reverse proxy configured correctly?

## Quick Fixes

### Fix 1: Restart Backend
In Coolify:
1. Go to backend application
2. Click **Restart**
3. Wait for it to start
4. Check logs for errors

### Fix 2: Check Database Connection
If using PostgreSQL, verify:
```bash
# In backend environment variables
DATABASE_URL=postgresql://username:password@postgres-host:5432/database_name
```

The database host should be the internal Coolify network name (e.g., `postgres-xyz.coolify`)

### Fix 3: Rebuild Backend
If environment variables changed:
1. Update environment variables in Coolify
2. Click **Redeploy**
3. Monitor logs during startup

### Fix 4: Check Dockerfile
Verify the backend Dockerfile has:
```dockerfile
EXPOSE 8000
CMD ["uvicorn", "api.app:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Testing Checklist

Once backend is running:

1. **Test health endpoint:**
   ```bash
   curl https://voice-be.alanbouo.com/health
   ```
   Should return: `{"status":"ok"}`

2. **Test registration endpoint:**
   ```bash
   curl -X POST https://voice-be.alanbouo.com/register \
     -H "Content-Type: application/json" \
     -d '{"username":"testuser","password":"testpass123"}'
   ```
   Should return: `{"message":"User created successfully","username":"testuser"}`

3. **Check CORS:**
   ```bash
   curl -X OPTIONS https://voice-be.alanbouo.com/register \
     -H "Origin: https://voice.alanbouo.com" \
     -H "Access-Control-Request-Method: POST" \
     -v
   ```
   Should include: `Access-Control-Allow-Origin: https://voice.alanbouo.com`

## Common Solutions

### Backend Won't Start

**Symptom**: Container keeps restarting
**Solution**: Check logs for the specific error

**Common causes:**
1. Database not accessible
2. Missing required environment variables
3. Python dependencies not installed
4. Port 8000 already in use

### Database Connection Error

**Symptom**: `OperationalError: could not connect to server`
**Solution**: 
1. Verify DATABASE_URL format
2. Check database is running in Coolify
3. Use internal Coolify network name for database host

### CORS Error (After Backend is Running)

**Symptom**: Browser shows CORS error
**Solution**: Update backend CORS_ORIGINS:
```bash
CORS_ORIGINS=https://voice.alanbouo.com,https://www.voice.alanbouo.com
```

## Next Steps

1. **First**: Get backend health endpoint working
2. **Second**: Test registration with curl
3. **Third**: Rebuild frontend with correct VITE_API_URL
4. **Finally**: Test registration from browser

## Need More Help?

Share these from Coolify:
1. Backend application logs (last 50 lines)
2. Backend environment variables (hide sensitive values)
3. Backend build logs
4. Database connection status
