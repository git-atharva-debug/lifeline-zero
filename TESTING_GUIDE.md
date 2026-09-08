# 🧪 Testing Guide - Verify Everything Works

## Test Checklist

This guide will help you verify that the frontend-backend integration is working correctly.

---

## 📋 Pre-Test Setup

Before testing, ensure:

- [ ] Backend is running on http://localhost:5000
- [ ] Frontend is running on http://localhost:3000  
- [ ] MongoDB is connected
- [ ] Browser console is open (F12)

**Verify Backend is Running:**
```bash
curl http://localhost:5000/health
# Should see: {"status":"Server is running"}
```

---

## ✅ Test 1: User Registration

### Steps

1. Navigate to http://localhost:3000/register
2. Fill in the form:
   - **Name**: Test User
   - **Email**: test@example.com
   - **Password**: password123
   - **Phone**: (leave blank)
   - **Role**: Select "👤 Civilian"
3. Click "Register as Civilian" button
4. Wait for page to load

### Expected Results

- ✅ Redirect to `/user/dashboard`
- ✅ No error messages
- ✅ Can see user data (name, email, role)
- ✅ Page shows "Welcome back" or similar

### Verify in Browser Console

```javascript
// Open DevTools → Console
localStorage.getItem('token')     // Should show JWT token
localStorage.getItem('user')      // Should show user JSON
```

### Verify in MongoDB

```bash
mongosh
use lifeline-zero
db.users.findOne({ email: "test@example.com" })
```

**Should return:**
```json
{
  "_id": ObjectId(...),
  "name": "Test User",
  "email": "test@example.com",
  "password": "$2a$10$...",  // hashed
  "role": "user",
  "phone": "",
  "createdAt": ISODate(...),
  "updatedAt": ISODate(...)
}
```

### Debug if Failed

| Error | Check |
|-------|-------|
| Network error | Backend running on 5000? |
| "User already exists" | Use different email |
| CORS error | .env CORS_ORIGIN correct? |
| Blank error | Check browser console |

---

## ✅ Test 2: Page Refresh Persistence

### Steps

1. After registering (Test 1), you're on dashboard
2. **Refresh the page** (F5)
3. Observe what happens

### Expected Result

- ✅ Still on dashboard (didn't redirect to login)
- ✅ User data still visible
- ✅ No re-login needed

### Why This Works

- JWT token is in localStorage
- Frontend checks token on page load
- ProtectedRoute allows access if token exists

---

## ✅ Test 3: Logout and Login

### Steps

1. Look for logout button (usually in header)
2. Click logout
3. You should be redirected to login page
4. Now login with same credentials:
   - **Email**: test@example.com
   - **Password**: password123
5. Click "Sign In"

### Expected Results

- ✅ Logout clears localStorage
- ✅ Redirected to login page  
- ✅ Login successful with same credentials
- ✅ Back on dashboard

### Verify localStorage Cleared

```javascript
// After logout
localStorage.getItem('token')   // Should be null
localStorage.getItem('user')    // Should be null
```

---

## ✅ Test 4: Invalid Credentials

### Steps

1. Go to http://localhost:3000/login
2. Enter:
   - **Email**: test@example.com
   - **Password**: wrongpassword
3. Click "Sign In"

### Expected Results

- ❌ Error message appears: "Invalid credentials"
- ❌ NOT redirected to dashboard
- ❌ Still on login page
- ❌ No token in localStorage

### Good Signs

- Clear error message shown
- Form values preserved
- Can try again immediately

---

## ✅ Test 5: Non-Existent User Login

### Steps

1. Go to http://localhost:3000/login
2. Enter:
   - **Email**: nonexistent@example.com
   - **Password**: anypassword
3. Click "Sign In"

### Expected Results

- ❌ Error message: "Invalid credentials"
- ❌ NOT allowed access
- ❌ Stays on login page

### Why This Security

- Doesn't tell attacker whether email exists
- Prevents user enumeration
- Makes brute force harder

---

## ✅ Test 6: Command Center Role

### Steps

1. Go to http://localhost:3000/register
2. Fill in:
   - **Name**: Commander Test
   - **Email**: cmd@example.com
   - **Password**: password123
   - **Role**: Select "🎖️ Rescue Command"
3. Click "Register as Command Officer"

### Expected Results

- ✅ Redirected to `/command/dashboard` (not `/user/dashboard`)
- ✅ Command center interface visible
- ✅ Different UI than civilian role

### Verify Role in Database

```bash
db.users.findOne({ email: "cmd@example.com" }).role
# Should show: "command"
```

---

## ✅ Test 7: Protected Route Without Login

### Steps

1. Clear browser data (logout):
   ```javascript
   localStorage.clear()
   // Refresh page
   ```

2. Try to access protected route directly:
   - Go to http://localhost:3000/user/dashboard

### Expected Results

- ❌ Redirected to login page
- ❌ Error message "Please login first"
- ❌ Cannot access dashboard without token

### Why This Works

```javascript
// ProtectedRoute checks:
if (!token || !user) {
  return <Navigate to="/login" />  // Redirects here
}
```

---

## ✅ Test 8: Password Hashing

### Steps

1. Register user (Test 1)
2. View in MongoDB:
   ```bash
   db.users.findOne({ email: "test@example.com" }).password
   ```

### Expected Result

- ✅ Password is 60+ characters starting with `$2a$10$`
- ✅ NOT plain text "password123"
- ✅ Different hash even for same password (next registration)

### Why This Secure

- Original password never stored
- Compared using bcrypt comparison
- Cannot reverse engineer password from hash

---

## ✅ Test 9: API Response Format

### Test Registration API

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "API Test",
    "email": "api@example.com",
    "password": "password123",
    "role": "user"
  }'
```

### Expected Response

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "_id": "67a1b2c3d4e5f6g7h8i9j0k1",
      "name": "API Test",
      "email": "api@example.com",
      "role": "user",
      "phone": ""
    }
  }
}
```

### Test Login API

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "api@example.com",
    "password": "password123"
  }'
```

---

## ✅ Test 10: Token Expiration (Optional)

### How to Test

1. After login, get token from localStorage
2. Wait 7 days (or edit token to be expired)
3. Try to access dashboard
4. Should be redirected to login

**For Quick Test**: Edit `.env` JWT_EXPIRE to shorter time:
```env
JWT_EXPIRE=10s  # Token expires in 10 seconds
```

---

## 🔍 Debugging Tips

### Check Backend Logs

When testing, backend terminal should show:
```
POST /api/auth/register 201
POST /api/auth/login 200
GET /health 200
```

No errors = good sign ✅

### Browser Console Errors

Press F12 → Console tab

**Good signs:**
- No red errors
- May see network requests to /api/auth/*

**Bad signs:**
- "CORS error"
- "Cannot read property X"
- Network failures (ERR_CONNECTION_REFUSED)

### Network Tab

Press F12 → Network tab

1. Try logging in
2. Look for POST request to `/api/auth/login`
3. Click on it
4. Check **Response** tab

Should see:
```json
{
  "success": true,
  "data": { "token": "...", "user": {...} }
}
```

### MongoDB Connection

In backend, you should see during startup:
```
✅ MongoDB Connected
```

If not, check:
- Is MONGO_URI correct in `.env`?
- Internet connection (if using Atlas)?
- Firewall not blocking?

---

## 📊 Test Results Table

| Test | Expected | Result | Status |
|------|----------|--------|--------|
| 1. Registration | User in DB | ✅/❌ | |
| 2. Persistence | Stays logged in | ✅/❌ | |
| 3. Logout/Login | Works both ways | ✅/❌ | |
| 4. Invalid Creds | Error shown | ✅/❌ | |
| 5. No User | Error shown | ✅/❌ | |
| 6. Command Role | Different dashboard | ✅/❌ | |
| 7. No Login Access | Redirects | ✅/❌ | |
| 8. Password Hash | Hashed not plain | ✅/❌ | |
| 9. API Format | Correct structure | ✅/❌ | |
| 10. Token Use | In requests | ✅/❌ | |

---

## 🚨 Common Issues & Solutions

### Issue: "Network Error" on Register

```
Error: Failed to connect to http://localhost:5000/api/auth/register
```

**Solutions:**
1. Is backend running? `npm run dev` in backend folder
2. Is it on port 5000? Check `.env` PORT=5000
3. Is CORS_ORIGIN correct? Check backend `.env` CORS_ORIGIN=http://localhost:3000

### Issue: "User already exists"

```
Error: User already exists
```

**Solutions:**
1. Use different email: `test2@example.com`
2. Or delete from MongoDB: `db.users.deleteOne({ email: "test@example.com" })`

### Issue: Blank Error Message

```
Error: 
(nothing shows us what failed)
```

**Solutions:**
1. Check browser console for details
2. Check backend logs for errors
3. Check Network tab → Response for actual error

### Issue: Token Not Saving

```javascript
localStorage.getItem('token') // returns null
```

**Solutions:**
1. Is login successful? Check for error message
2. Did you register first before login?
3. Clear localStorage and try again: `localStorage.clear()`

### Issue: Always Redirects to Login

Even after login, redirects to login page

**Solutions:**
1. Check token in localStorage
2. Check user in localStorage
3. Try clearing and re-logging in
4. Check ProtectedRoute logic

---

## ✨ Success Indicators

If you can do all of this, everything works! ✅

- [x] Register new user
- [x] See user in MongoDB
- [x] Login with same credentials
- [x] Stay logged in after page refresh
- [x] Logout and re-login
- [x] Get error for invalid credentials
- [x] Access dashboard as different roles
- [x] Cannot access protected routes without token
- [x] API returns proper JSON format
- [x] Password is hashed in database

---

## 📞 Still Having Issues?

1. **Check the docs**:
   - `backend/README.md` - Backend setup
   - `INTEGRATION-GUIDE.md` - Complete guide
   - `FIXES_SUMMARY.md` - What's fixed

2. **Check logs**:
   - Backend terminal
   - Browser console (F12)
   - MongoDB output

3. **Verify setup**:
   - `.env` files configured?
   - Both servers running?
   - MongoDB connected?

4. **Common fixes**:
   - Clear localStorage
   - Restart both servers
   - Check internet connection
   - Look at error messages carefully

---

**Happy Testing!** 🎉

If all tests pass, frontend-backend integration is working perfectly!
