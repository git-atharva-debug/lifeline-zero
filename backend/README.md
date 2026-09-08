# LifeLineZero Backend - Setup & Integration Guide

## Overview

This is the backend API for the LifeLineZero Emergency Response System. It handles user authentication, registration, and stores user data in MongoDB.

## Current Implementation

✅ **Authentication System**
- User registration with email validation
- User login with password verification
- JWT token generation (7 days expiration)
- Password hashing with bcryptjs
- Error handling and validation

✅ **Database**
- MongoDB integration with Mongoose
- User model with email uniqueness
- Automatic timestamps

✅ **API Endpoints**
- `POST /api/auth/register` - Register new users
- `POST /api/auth/login` - Login users
- `GET /health` - Server health check

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

The `.env` file is already set up. Check these values:

```env
MONGO_URI=mongodb+srv://milindborse54:milindborse54@cluster0.oxjqrmy.mongodb.net/lifeline-zero
JWT_SECRET=supersecretkey123
PORT=5000
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
```

**For development with local MongoDB**:
```env
MONGO_URI=mongodb://localhost:27017/lifeline-zero
```

### 3. Start Server

```bash
# Development (with auto-reload)
npm run dev

# Production
node app.js
```

Expected output:
```
✓ Server running on http://localhost:5000
✅ MongoDB Connected
```

## API Documentation

### Register User

**Endpoint:** `POST /api/auth/register`

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "phone": "1234567890",
  "role": "user"
}
```

**Response (Success - 201):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "_id": "67a1b2c3d4e5f6g7h8i9j0k1",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "phone": "1234567890"
    }
  }
}
```

**Response (Error - 400/409):**
```json
{
  "success": false,
  "message": "User already exists"
}
```

### Login User

**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "_id": "67a1b2c3d4e5f6g7h8i9j0k1",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "phone": "1234567890"
    }
  }
}
```

**Response (Error - 401):**
```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

### Health Check

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "Server is running"
}
```

## Testing Authentication

### Using cURL

```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123",
    "role": "user"
  }'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'

# Health Check
curl http://localhost:5000/health
```

### Using Postman

1. **Register Endpoint**
   - Method: POST
   - URL: `http://localhost:5000/api/auth/register`
   - Body (raw JSON):
     ```json
     {
       "name": "John Doe",
       "email": "john@example.com",
       "password": "password123",
       "role": "user"
     }
     ```
   - Click Send

2. **Login Endpoint**
   - Method: POST
   - URL: `http://localhost:5000/api/auth/login`
   - Body (raw JSON):
     ```json
     {
       "email": "john@example.com",
       "password": "password123"
     }
     ```
   - Click Send

## Frontend Integration

The frontend React application is configured to communicate with this backend at `http://localhost:5000/api`.

### Frontend Setup

1. Navigate to frontend directory:
   ```bash
   cd ../emergency-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. The `.env` file is already configured:
   ```env
   REACT_APP_API_URL=http://localhost:5000/api
   ```

4. Start frontend:
   ```bash
   npm start
   ```

### Expected Frontend Behavior

✅ **Registration**
- User fills registration form
- Clicks "Register" button
- Frontend sends POST to `/api/auth/register`
- Backend validates and saves to MongoDB
- User redirected to dashboard
- User data saved in browser localStorage

✅ **Login**
- User enters credentials
- Clicks "Sign In" button
- Frontend sends POST to `/api/auth/login`
- Backend validates credentials
- JWT token returned and stored
- User redirected to dashboard

✅ **Protected Routes**
- Post-login pages check for valid token
- Without token: redirected to login
- With token: access granted

## Database Schema

### User Model

```javascript
{
  _id: ObjectId,           // MongoDB ID
  name: String,            // Required: Full name
  email: String,           // Required: Unique email
  password: String,        // Required: Hashed password
  phone: String,           // Optional: Phone number
  role: String,            // user | command
  createdAt: Date,         // Automatic
  updatedAt: Date          // Automatic
}
```

## Verify User Registration

### Check MongoDB

```bash
# Connect to MongoDB
mongosh

# Switch to database
use lifeline-zero

# Find all users
db.users.find()

# Find specific user
db.users.findOne({ email: "john@example.com" })

# Pretty print
db.users.find().pretty()
```

## Project Structure

```
backend/
├── app.js                 # Main Express server
├── package.json          # Dependencies
├── .env                  # Environment variables
├── .env.example          # Environment template
├── config/
│   └── db.js            # MongoDB connection
├── models/
│   └── User.js          # User schema
├── routes/
│   └── authRoutes.js    # Auth endpoints
└── controllers/
    └── authController.js # Auth logic
```

## Troubleshooting

### MongoDB Connection Error
```
❌ DB Error: connect ECONNREFUSED
```

**Solutions:**
- Check MongoDB Atlas connection string in `.env`
- Verify network access in MongoDB Atlas settings
- Check MongoDB credentials
- For local: ensure `mongod` is running

### Register Error: "User already exists"
- Clear browser localStorage
- Try with different email
- Check MongoDB if user already exists

### Invalid Credentials Error
- Verify email is correct
- Check caps lock on password
- Ensure user is registered before login

### CORS Error
- Verify `CORS_ORIGIN=http://localhost:3000` in `.env`
- Check frontend is running on port 3000
- Restart backend after changing `.env`

## Directory Overview

| File/Folder | Purpose |
|------------|---------|
| app.js | Express server setup, middleware, routes |
| config/db.js | MongoDB connection |
| models/User.js | User database schema |
| routes/authRoutes.js | Auth endpoint definitions |
| controllers/authController.js | Register/Login logic |
| package.json | Project dependencies |
| .env | Environment configuration |

## Next Steps

1. ✅ Backend running on port 5000
2. ✅ Frontend running on port 3000
3. ✅ MongoDB connected
4. 🔄 Test registration via UI
5. 🔄 Test login via UI
6. 🔄 Verify data in MongoDB
7. 🔄 Access dashboard after login

## Common Commands

```bash
# Start backend
npm run dev

# Check backend health
curl http://localhost:5000/health

# Check if MongoDB is connected
# (Check logs when starting app)

# View package.json
cat package.json

# View environment variables
cat .env

# Restart backend
# Stop and run: npm run dev
```

## Production Deployment

Before deploying:

1. Change `JWT_SECRET` to a secure random string
2. Update `CORS_ORIGIN` to production frontend URL
3. Set `NODE_ENV=production`
4. Use MongoDB Atlas or secure database
5. Add rate limiting middleware
6. Setup proper logging
7. Configure HTTPS

## Support

- **Frontend Issues**: See `emergency-app/` directory
- **Integration Guide**: See `INTEGRATION-GUIDE.md` in project root
- **Database Issues**: Check MongoDB connection string
- **API Issues**: Check response format and status codes

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB + Mongoose
- **Authentication**: JWT + bcryptjs
- **Middleware**: CORS, body-parser
- **Development**: nodemon

---

**Last Updated**: February 19, 2026
**Current DB**: MongoDB Atlas
**Status**: ✅ Working
