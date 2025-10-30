# Authentication System

## Overview

Voice Transcript uses JWT (JSON Web Tokens) for authentication with a database-backed user management system.

## User Registration Flow

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       │ 1. Fill registration form
       │    (username, email, password)
       ▼
┌─────────────────────┐
│  Frontend (React)   │
└──────┬──────────────┘
       │
       │ 2. POST /register
       │    {username, email, password}
       ▼
┌─────────────────────┐
│  Backend (FastAPI)  │
│                     │
│  ┌───────────────┐  │
│  │ Validate data │  │
│  └───────┬───────┘  │
│          │          │
│          ▼          │
│  ┌───────────────┐  │
│  │ Hash password │  │
│  │  (bcrypt)     │  │
│  └───────┬───────┘  │
│          │          │
│          ▼          │
│  ┌───────────────┐  │
│  │ Save to DB    │  │
│  │ (SQLite)      │  │
│  └───────────────┘  │
└──────┬──────────────┘
       │
       │ 3. Return success
       ▼
┌─────────────────────┐
│  Show success msg   │
│  Switch to login    │
└─────────────────────┘
```

## Login Flow

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       │ 1. Submit credentials
       ▼
┌─────────────────────┐
│  Frontend (React)   │
└──────┬──────────────┘
       │
       │ 2. POST /token
       │    FormData(username, password)
       ▼
┌─────────────────────────────────┐
│       Backend (FastAPI)         │
│                                 │
│  ┌───────────────────────────┐  │
│  │ Query user from database  │  │
│  └───────────┬───────────────┘  │
│              │                  │
│              ▼                  │
│  ┌───────────────────────────┐  │
│  │ Verify password hash      │  │
│  │ (bcrypt.verify)           │  │
│  └───────────┬───────────────┘  │
│              │                  │
│              ▼                  │
│  ┌───────────────────────────┐  │
│  │ Generate JWT tokens:      │  │
│  │ - Access token (60 min)   │  │
│  │ - Refresh token (7 days)  │  │
│  └───────────┬───────────────┘  │
└──────────────┼──────────────────┘
               │
               │ 3. Return tokens
               ▼
┌──────────────────────────────────┐
│  Store tokens in localStorage    │
│  Redirect to dashboard           │
└──────────────────────────────────┘
```

## Authenticated Requests

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       │ 1. Make API request
       │    + Authorization: Bearer <token>
       ▼
┌─────────────────────┐
│    API Client       │
│  (axios interceptor)│
└──────┬──────────────┘
       │
       │ 2. Add token to headers
       ▼
┌─────────────────────────────┐
│    Backend (FastAPI)        │
│                             │
│  ┌───────────────────────┐  │
│  │ Verify JWT signature  │  │
│  └───────────┬───────────┘  │
│              │              │
│              ▼              │
│  ┌───────────────────────┐  │
│  │ Check expiration      │  │
│  └───────────┬───────────┘  │
│              │              │
│              ▼              │
│  ┌───────────────────────┐  │
│  │ Extract username      │  │
│  └───────────┬───────────┘  │
│              │              │
│              ▼              │
│  ┌───────────────────────┐  │
│  │ Process request       │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

## Token Refresh Flow

When access token expires (after 60 minutes):

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       │ 1. API request fails (401)
       ▼
┌─────────────────────┐
│  Axios Interceptor  │
│                     │
│  ┌───────────────┐  │
│  │ Catch 401     │  │
│  └───────┬───────┘  │
│          │          │
│          ▼          │
│  ┌───────────────┐  │
│  │ POST /refresh │  │
│  │ (refresh tok) │  │
│  └───────┬───────┘  │
└──────────┼──────────┘
           │
           ▼
┌──────────────────────┐
│  Backend validates   │
│  refresh token       │
│  Returns new access  │
└──────────┬───────────┘
           │
           │ 2. New access token
           ▼
┌──────────────────────┐
│  Update localStorage │
│  Retry original req  │
└──────────────────────┘
```

## Security Features

### Password Security
- ✅ **Bcrypt hashing** with automatic salt generation
- ✅ **Minimum 6 characters** enforced
- ✅ **Password confirmation** during registration
- ✅ **No plain text storage** - only hashes stored

### Token Security
- ✅ **JWT signing** with secret key
- ✅ **Expiration times** (60 min access, 7 days refresh)
- ✅ **Refresh token rotation** on refresh
- ✅ **Automatic token refresh** via axios interceptor

### Database Security
- ✅ **Unique constraints** on username and email
- ✅ **SQLite with proper ORM** (SQLAlchemy)
- ✅ **No SQL injection** via parameterized queries

### Transport Security
- ⚠️ **Use HTTPS in production** (not configured by default)
- ✅ **CORS configured** for allowed origins

## API Endpoints

### Public Endpoints (No Auth Required)

#### POST `/register`
Register a new user.

**Request Body:**
```json
{
  "username": "john_doe",
  "email": "john@example.com",  // optional
  "password": "secure_password"
}
```

**Response:**
```json
{
  "message": "User created successfully",
  "username": "john_doe"
}
```

#### POST `/token`
Login and get access tokens.

**Request:** Form data
- `username`: string
- `password`: string

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer"
}
```

#### POST `/refresh`
Refresh access token.

**Request:** Form data
- `refresh_token`: string

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer"
}
```

### Protected Endpoints (Auth Required)

#### GET `/me`
Get current user information.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "id": 1,
  "username": "john_doe",
  "email": "john@example.com",
  "created_at": "2025-10-29T17:00:00.000000"
}
```

#### POST `/transcribe`
Upload and transcribe audio file.

#### GET `/transcripts/{id}`
Retrieve a transcript.

## Database Schema

### Users Table

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY, AUTO INCREMENT |
| username | VARCHAR | UNIQUE, NOT NULL, INDEXED |
| email | VARCHAR | UNIQUE, INDEXED |
| hashed_password | VARCHAR | NOT NULL |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| is_active | INTEGER | DEFAULT 1 |

## Configuration

### Environment Variables

```bash
# JWT Secret (change this in production!)
JWT_SECRET=your_super_secret_random_string_here

# CORS Origins
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Optional: Old variables (no longer used in v2.0)
# APP_USER=admin
# APP_PASS=secret
```

## Production Recommendations

1. **Use strong JWT_SECRET**
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```

2. **Enable HTTPS** - Use nginx or cloud provider SSL

3. **Rate limiting** - Implement rate limiting on auth endpoints

4. **Consider Redis** for refresh token storage instead of in-memory dict

5. **Database backups** - Regular backups of `voice_transcript.db`

6. **Monitor failed logins** - Track and alert on suspicious activity

7. **Password policies** - Consider adding:
   - Uppercase/lowercase requirements
   - Special character requirements
   - Maximum failed login attempts

8. **Email verification** - Add email confirmation flow for new users
