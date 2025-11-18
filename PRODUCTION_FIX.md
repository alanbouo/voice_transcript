# Production Deployment Fix

## Problem
Account creation was failing in production because the frontend couldn't communicate with the backend API. The error occurred because:

1. **Build-time vs Runtime Configuration**: Vite requires the `VITE_API_URL` environment variable at **build time**, not runtime
2. **Missing Build Arguments**: The frontend Dockerfile wasn't accepting the API URL as a build argument
3. **Default API Path**: Without proper configuration, the frontend defaulted to `/api` which doesn't exist in production

## Solution Applied

### 1. Updated Frontend Dockerfile
Added build argument support for `VITE_API_URL`:

```dockerfile
# Accept build argument for API URL
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
```

### 2. Updated docker-compose.yml
Changed from runtime environment variable to build argument:

```yaml
frontend:
  build:
    context: ./frontend
    args:
      VITE_API_URL: http://localhost:8000
```

### 3. Added Runtime Configuration Fallback
Created `/public/config.js` for post-build configuration changes without rebuilding.

### 4. Fixed Missing vite.svg
Added microphone icon SVG to `/public/vite.svg`.

## Deployment Instructions

### For Coolify Deployment

#### Backend (API)
1. Create application from Git repository
2. Set build pack to **Dockerfile**
3. Set port to **8000**
4. Add environment variables:
   ```bash
   AAI_API_KEY=your_assemblyai_key
   DATABASE_URL=postgresql://user:pass@host:5432/db
   JWT_SECRET=your_secret_key
   CORS_ORIGINS=https://voice.alanbouo.com
   ```
5. Set domain: `api.voice.alanbouo.com` (or your backend domain)

#### Frontend
1. Create separate application from Git repository
2. Set build pack to **Dockerfile**
3. Set Dockerfile location: `./frontend/Dockerfile`
4. Set port to **80**
5. **IMPORTANT**: Add build argument in Coolify:
   - Go to Build Settings
   - Add Build Argument: `VITE_API_URL=https://api.voice.alanbouo.com`
6. Set domain: `voice.alanbouo.com`

### For Docker Compose (Local/Development)

```bash
# Rebuild with the new configuration
docker-compose down
docker-compose build --no-cache frontend
docker-compose up -d
```

### For Manual Docker Build

```bash
# Build frontend with API URL
cd frontend
docker build \
  --build-arg VITE_API_URL=https://api.yourdomain.com \
  -t voice-transcript-frontend:latest .

# Run
docker run -p 80:80 voice-transcript-frontend:latest
```

## Testing

After deployment, test the registration:

1. Open browser console (F12)
2. Go to Network tab
3. Try to create an account
4. Check that the request goes to your backend domain (e.g., `https://api.voice.alanbouo.com/register`)
5. Verify the response is successful (status 200)

## Troubleshooting

### Issue: Still getting "Registration failed"
**Solution**: Check browser console for the actual API URL being called. If it's still `/api`, the build argument wasn't passed correctly.

### Issue: CORS errors
**Solution**: Make sure `CORS_ORIGINS` in backend includes your frontend domain:
```bash
CORS_ORIGINS=https://voice.alanbouo.com,https://www.voice.alanbouo.com
```

### Issue: 404 on /register endpoint
**Solution**: Verify backend is running and accessible at the configured API URL.

## Post-Build Configuration (Advanced)

If you need to change the API URL after building without rebuilding:

1. Access the container or nginx files
2. Edit `/usr/share/nginx/html/config.js`
3. Change:
   ```javascript
   window.APP_CONFIG = {
     API_URL: 'https://your-new-api-url.com'
   }
   ```
4. Reload the page (no rebuild needed)

## Verification Checklist

- [ ] Backend is accessible at configured domain
- [ ] Frontend is accessible at configured domain
- [ ] CORS is configured with frontend domain
- [ ] Frontend build includes correct VITE_API_URL
- [ ] Registration creates account successfully
- [ ] Login works after registration
- [ ] JWT tokens are stored correctly
- [ ] Protected routes require authentication
