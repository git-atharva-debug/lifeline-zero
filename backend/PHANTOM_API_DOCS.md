# 🗺️ Phantom Map API — House Layout Storage

> **Base URL:** `http://localhost:5000/api/phantom`

All endpoints require JWT: `Authorization: Bearer <token>`

---

## 1. Upload House Layout

**POST** `/api/phantom/upload`
**Role:** `user`
**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `floorplan` | File | ✅ | PNG/JPG/JPEG/WEBP (max 10MB) |
| `walls` | String | ❌ | JSON array of wall segments |
| `markers` | String | ❌ | JSON array of markers |
| `doors` | String | ❌ | JSON array of doors |
| `windows` | String | ❌ | JSON array of windows |

**Behavior:**
- Uploads image to Cloudinary (`rescue-ai/phantom-maps/`)
- Sets all previous maps to `isActive: false`
- Saves new map as `isActive: true`

### cURL Example
```bash
curl -X POST http://localhost:5000/api/phantom/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "floorplan=@./floorplan.png" \
  -F 'walls=[{"x1":-25,"z1":-20,"x2":25,"z2":-20}]' \
  -F 'markers=[{"position":[-20,0,18],"type":"exit"}]'
```

### Response (201)
```json
{
  "success": true,
  "message": "House layout saved as your active map.",
  "data": {
    "_id": "...",
    "user": "...",
    "floorplanImage": { "url": "https://res.cloudinary.com/...", "publicId": "...", "originalName": "plan.png", "size": 245760 },
    "walls": [...],
    "markers": [...],
    "isActive": true,
    "metadata": { "wallCount": 14, "markerCount": 5 },
    "createdAt": "..."
  }
}
```

---

## 2. Get My Maps

**GET** `/api/phantom/my`
**Role:** `user`

Returns all maps (active + inactive) for the logged-in user.

---

## 3. Get Active Map

**GET** `/api/phantom/active`
**Role:** `user`

Returns the user's current active house layout.

---

## 4. Set Active Map

**PUT** `/api/phantom/:mapId/activate`
**Role:** `user` (own maps only)

Sets the specified map as active, deactivating all others.

---

## 5. Delete Map

**DELETE** `/api/phantom/:mapId`
**Role:** `user` (own maps only)

Deletes the map and its Cloudinary image. If the deleted map was active, the most recent remaining map becomes active.

---

## Incident Auto-Attach

When a user creates an incident via `POST /api/incidents/create`, the system automatically:
1. Looks up the user's active PhantomMap
2. Attaches `phantomMap: <mapId>` to the incident document
3. Command center can populate this field to view the building layout

**No manual linking required.** Upload once → all incidents carry the map.
