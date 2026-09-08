# 🚀 Quick Start Guide - LifeLineZero

Get the entire application running in minutes!

## 📋 Prerequisites

- Node.js installed
- MongoDB Atlas account (cloud) OR MongoDB installed locally
- Two terminal windows

## ⚡ Start in 5 Minutes

### Terminal 1: Start Backend

```bash
cd backend
npm install
npm run dev
```

Wait for:
```
✓ Server running on http://localhost:5000
✅ MongoDB Connected
```

✅ Backend ready!

### Terminal 2: Start Frontend

```bash
cd emergency-app
npm install
npm start
```

Wait for:
```
Compiled successfully!
Local: http://localhost:3000
```

✅ Frontend ready!

## ✨ Quick Test

### 1. Register New User

1. Open http://localhost:3000 in browser
2. Click "Register"
3. Fill in:
   - Name: `Your Name`
   - Email: `you@example.com`
   - Password: `password123`
   - Role: Choose "Civilian" or "Command Officer"
4. Click "Register"
5. You should reach the dashboard ✅

### 2. Verify Database

Open MongoDB Atlas or local MongoDB:
```bash
mongosh
use lifeline-zero
db.users.find()
```

You should see your registered user! ✅

### 3. Test Login

1. Go back to http://localhost:3000/login
2. Use the same email and password
3. Should login successfully ✅

## ✅ What's Working Now

| Feature | Status |
|---------|--------|
| User Registration | ✅ Saves to DB |
| User Login | ✅ JWT authentication |
| Password Hashing | ✅ Secure with bcrypt |
| Protected Routes | ✅ Token verification |
| Dashboard Access | ✅ After login |
| Error Handling | ✅ User-friendly messages |
| Database Connection | ✅ MongoDB Atlas |

## 🔧 Configuration

### Backend `.env`
```
MONGO_URI=mongodb+srv://...@cluster.mongodb.net/lifeline-zero
JWT_SECRET=supersecretkey123
PORT=5000
CORS_ORIGIN=http://localhost:3000
```

### Frontend `.env`
```
REACT_APP_API_URL=http://localhost:5000/api
```

Both are already configured! ✅

## 🎯 Next Steps

- ✅ Register and login
- ✅ Test multiple users
- 🔄 Create alerts (Command Center role)
- 🔄 View notifications (User role)
- 🔄 Manage resources (Command Center)

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| Can't register | Check backend is running on 5000 |
| Network error | Check CORS_ORIGIN in backend .env |
| User not in DB | Verify MongoDB connection string |
| Invalid credentials on login | Make sure user is registered |
| Token error | Clear localStorage and re-login |

## 📁 Project Structure

```
LifeLineZero/
├── backend/              ← Node.js API
│   ├── app.js           ← Start here
│   ├── .env             ← Config
│   ├── controllers/     ← Auth logic
│   ├── models/          ← Database
│   └── routes/          ← Endpoints
│
└── emergency-app/        ← React Frontend
    ├── public/
    ├── src/
    │   ├── pages/       ← Login/Register
    │   ├── services/    ← API calls
    │   ├── context/     ← Auth state
    │   └── components/
    └── .env             ← Config
```

## 💡 Tips

1. **Keep both servers running** - Terminal 1 (backend) + Terminal 2 (frontend)
2. **Check console** - Browser console shows API errors
3. **Check backend logs** - Shows database and validation errors
4. **Clear localStorage** - If having auth issues: DevTools → Application → Clear

## 🚀 API Endpoints

```bash
# Register
POST http://localhost:5000/api/auth/register

# Login
POST http://localhost:5000/api/auth/login

# Health Check
GET http://localhost:5000/health

# Frontend
http://localhost:3000
```

## 📊 Database

- **Database**: MongoDB Atlas (Cloud)
- **URL**: Already configured in `.env`
- **Collections**: 
  - `users` - Stores registered users
  - (More collections coming soon)

## ✨ Features Implemented

- ✅ User Authentication (Register/Login)
- ✅ Password Hashing (bcryptjs)
- ✅ JWT Tokens (7 days)
- ✅ Protected Routes
- ✅ Database Persistence
- ✅ CORS Setup
- ✅ Error Handling
- ✅ Loading States

## 🎓 Learning

Learn how it works:
1. Read [Backend README](backend/README.md) for API details
2. Read [Integration Guide](INTEGRATION-GUIDE.md) for flow
3. Check [API Docs](backend/API-DOCS.md) for endpoints

## 📞 Support

- Backend issues: Check `backend/README.md`
- Frontend issues: Check `emergency-app/src/`
- Integration issues: Check `INTEGRATION-GUIDE.md`
- Database issues: Check MongoDB connection

---

**Status**: ✅ Ready to use!

Now go to http://localhost:3000 and test it! 🎉
