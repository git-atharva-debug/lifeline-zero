# Frontend-Backend Integration Setup Guide

## Fixed Issues

✅ **Frontend Authenticatication**: Login and Register now call the backend API instead of using mock login
✅ **Backend Connection**: Frontend properly sends credentials to backend for validation
✅ **Database Storage**: User information is now saved to MongoDB
✅ **Token Management**: JWT tokens are properly stored and managed
✅ **Protected Routes**: Routes now check for valid JWT tokens
✅ **Error Handling**: Proper error messages displayed to users
✅ **Loading States**: UI shows loading feedback during API calls

## Running the Complete Application

### Step 1: Start MongoDB

**Option A: Local MongoDB**
```bash
# Windows - Open PowerShell as Admin
mongod

# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongod
```

**Option B: MongoDB Atlas (Cloud)**
- Create account at https://www.mongodb.com/cloud/atlas
- Create a free cluster
- Get connection string
- Update `backend/.env` with `MONGODB_URI`

### Step 2: Start Backend Server

```bash
cd backend
npm install
cp .env.example .env

# Edit .env with your settings:
# - MONGODB_URI (local or cloud)
# - JWT_SECRET (any random string)
# - PORT=5000
# - CORS_ORIGIN=http://localhost:3000

npm run dev
```

**Expected Output:**
```
✓ MongoDB connected: localhost
✓ Server running on http://localhost:5000
```

Test backend health:
```bash
curl http://localhost:5000/health
```

### Step 3: Start Frontend Application

```bash
cd emergency-app
npm install

# .env is already configured with REACT_APP_API_URL=http://localhost:5000/api

npm start
```

**Expected Output:**
```
Compiled successfully!
Local: http://localhost:3000
```

## Authentication Flow

### Registration Flow
1. User visits http://localhost:3000/register
2. Fills form with name, email, password
3. Chooses role (Civilian or Command Officer)
4. Clicks "Register as..."
5. **Frontend sends POST to**: `http://localhost:5000/api/auth/register`
6. **Backend**: Validates input, hashes password, saves to MongoDB
7. **Backend returns**: User data + JWT token
8. **Frontend**: Stores token + user in localStorage
9. **User redirected**: To dashboard (`/user/dashboard` or `/command/dashboard`)
10. **Database**: User saved in `lifeline-zero.users` collection

### Login Flow
1. User visits http://localhost:3000/login
2. Enters email and password
3. Clicks "Sign In"
4. **Frontend sends POST to**: `http://localhost:5000/api/auth/login`
5. **Backend**: Finds user by email, verifies password with bcrypt
6. **Backend returns**: User data + JWT token
7. **Frontend**: Stores token + user in localStorage
8. **User redirected**: To dashboard
9. **Token added**: Automatically to all future API requests

### Protected Route Access
1. User tries to access `/user/dashboard`
2. **ProtectedRoute checks**: `token` && `user` exist?
3. ✅ Valid: Component renders normally
4. ❌ Invalid: User redirected to `/login`

## API Endpoints

### Authentication
```bash
# Register
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "Password123",
  "phone": "1234567890",
  "role": "user"
}

# Login
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "Password123"
}

# Get Current User (protected)
GET http://localhost:5000/api/auth/me
Authorization: Bearer <TOKEN>
```

## Testing Authentication

### Using Postman
1. **Register endpoint**:
   - URL: `http://localhost:5000/api/auth/register`
   - Method: POST
   - Body (JSON):
     ```json
     {
       "name": "Test User",
       "email": "test@example.com",
       "password": "password123",
       "role": "user"
     }
     ```
   - Click Send
   - Copy the `token` from response

2. **Verify registration**: Check MongoDB
   ```bash
   mongosh
   use lifeline-zero
   db.users.find()
   ```

3. **Login endpoint**:
   - URL: `http://localhost:5000/api/auth/login`
   - Method: POST
   - Body (JSON):
     ```json
     {
       "email": "test@example.com",
       "password": "password123"
     }
     ```

4. **Protected endpoint** (Get Current User):
   - URL: `http://localhost:5000/api/auth/me`
   - Method: GET
   - Headers: `Authorization: Bearer <TOKEN>`

### Using curl
```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "role": "user"
  }'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'

# Get Current User
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Frontend Files Modified

### New Files Created
- `src/services/api.js` - API service with all endpoints
- `emergency-app/.env` - Frontend environment configuration

### Files Updated
- `src/context/AuthContext.jsx` - Now stores tokens and handles proper auth states
- `src/pages/Login.jsx` - Calls backend API for authentication
- `src/pages/Register.jsx` - Calls backend API for registration
- `src/components/ProtectedRoute.jsx` - Checks for valid tokens

## Troubleshooting

### "Network Error" on Register/Login
- ✅ Check backend is running: `http://localhost:5000/health`
- ✅ Check CORS_ORIGIN in backend `.env` is `http://localhost:3000`
- ✅ Check `REACT_APP_API_URL` in frontend `.env`

### "Invalid Credentials"
- ✅ Make sure you registered the user first
- ✅ Check email and password are correct
- ✅ Password is case-sensitive

### Database Connection Error
- ✅ Check MongoDB is running
- ✅ Verify `MONGODB_URI` in backend `.env`
- ✅ For local: `mongodb://localhost:27017/lifeline-zero`

### User Not Saving to Database
- ✅ Check MongoDB is running
- ✅ Check backend logs for errors
- ✅ Use `mongosh` to verify: `db.users.find()`

### Can't Access Dashboard After Login
- ✅ Check browser console for errors
- ✅ Verify token is saved in localStorage
- ✅ Check role is correctly set (user/command_center)

## Database Verification

### Check Users Collection
```bash
mongosh
use lifeline-zero
db.users.find().pretty()

# Sample output:
{
  "_id": ObjectId(...),
  "name": "John Doe",
  "email": "john@example.com",
  "password": "$2a$10$...", // hashed
  "role": "user",
  "phone": "1234567890",
  "isActive": true,
  "createdAt": ISODate(...),
  "updatedAt": ISODate(...)
}
```

### Check Alerts Collection
```bash
db.alerts.find().pretty()
```

### Check Notifications Collection
```bash
db.notifications.find().pretty()
```

## Next Steps

1. ✅ **Register a new user** via the UI
2. ✅ **Login** with those credentials
3. ✅ **Verify** user appears in MongoDB
4. ✅ **Access protected routes** (should work now!)
5. 🔄 **Create alerts** (command center only)
6. 🔄 **View notifications** (user dashboard)

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Login/Register button doesn't work | Check backend runs, CORS_ORIGIN correct |
| Network timeout | Ensure MongoDB is running |
| "User already exists" | Register with different email |
| Token expires | Re-login (set JWT_EXPIRE in backend .env) |
| CORS error | Update CORS_ORIGIN in backend .env |
| Database empty | Check MongoDB connection string in .env |

## Performance Tips

- Backend caches nothing by default (can add Redis later)
- Frontend stores token in localStorage (could use httpOnly cookies)
- Database has indexes on frequently queried fields
- Notifications auto-delete after 30 days (configurable)

## Security Checklist

- [x] Passwords hashed with bcrypt (10 rounds)
- [x] JWT tokens for stateless auth
- [x] CORS enabled for specific origin
- [x] Protected routes check tokens
- [x] Role-based access control
- [x] Input validation on backend
- [x] Error messages don't leak sensitive info
- [ ] HTTPS in production (use environment variables)
- [ ] Rate limiting (not yet implemented)
- [ ] API key security (not yet implemented)

## Production Deployment

Before deploying to production:
1. Set strong `JWT_SECRET`
2. Use MongoDB Atlas or similar
3. Update `CORS_ORIGIN` to production URL
4. Set `NODE_ENV=production`
5. Use HTTPS (SSL certificate)
6. Add rate limiting middleware
7. Setup logging/monitoring
8. Configure backup strategy
9. Use environment variables for all secrets

## Support

For questions about:
- **Backend**: See `backend/README.md`, `backend/API-DOCS.md`
- **Frontend**: Check components and context
- **Database**: See `backend/FRONTEND-ANALYSIS.md`

