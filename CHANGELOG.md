# Changelog

All notable changes to the Voice Transcript project.

## [2.0.0] - User Registration & Database System

### Added
- **User Registration System**
  - New users can create accounts via the login page
  - Email field (optional) for account recovery
  - Password confirmation validation
  - Secure password hashing with bcrypt
  
- **Database Integration**
  - SQLite database for user management
  - SQLAlchemy ORM for database operations
  - User model with username, email, password, timestamps
  - Automatic database initialization on startup

- **Enhanced Authentication**
  - Database-backed user authentication
  - `/register` endpoint for new user creation
  - `/me` endpoint to get current user info
  - Improved token validation
  - Extended access token lifetime (60 minutes)

- **Frontend Improvements**
  - Toggle between login and registration modes
  - Email input field with validation
  - Password confirmation field
  - Form validation (minimum 6 characters, matching passwords)
  - Success/error message display
  - Improved user experience with clear feedback

### Changed
- Moved from hardcoded credentials to database-backed authentication
- Refactored authentication logic into separate `auth.py` module
- Database models in separate `database.py` module
- Updated API documentation

### Security
- ✅ Passwords are hashed with bcrypt (industry standard)
- ✅ No plain text passwords stored
- ✅ Secure token generation
- ✅ Email validation
- ✅ Username uniqueness enforced

## [1.0.0] - Initial Web App Release

### Added
- React frontend with TailwindCSS
- FastAPI backend with JWT authentication
- Drag & drop file upload
- Real-time transcription progress
- Transcript viewer with download options
- Docker support
- Comprehensive documentation

---

## Migration Guide: v1.x to v2.0

If you're upgrading from v1.x:

1. **Update dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Database will be created automatically** on first run as `voice_transcript.db`

3. **First-time users must register** - no more default credentials

4. **Existing setup:**
   - Old environment variables (`APP_USER`, `APP_PASS`) are no longer used
   - `JWT_SECRET` is still used for token signing

That's it! The app will create the database and you can start registering users.
