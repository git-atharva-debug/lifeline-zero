# 🗺️ Building Map API Documentation

> **Base URL:** `http://localhost:5000/api/maps`

---

## Authentication

All endpoints require a valid JWT token in the `Authorization` header:

```
Authorization: Bearer <your_jwt_token>
```

---

## 1. Upload Building Map

Upload a floorplan image + 3D structural data to link to an incident.

**Endpoint:** `POST /api/maps/upload/:incidentId`  
**Access:** `user` role only (must own the incident)  
**Content-Type:** `multipart/form-data`

### Request

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `floorplan` | File | ✅ | PNG/JPG/JPEG/WEBP image (max 10MB) |
| `walls` | String (JSON) | ❌ | JSON array of wall segment objects |
| `markers` | String (JSON) | ❌ | JSON array of marker objects |
| `doors` | String (JSON) | ❌ | JSON array of door objects |
| `windows` | String (JSON) | ❌ | JSON array of window objects |

### Example (Postman)

```
POST http://localhost:5000/api/maps/upload/665abc123def456789012345
Content-Type: multipart/form-data
Authorization: Bearer eyJhbGciOi...

Body (form-data):
  floorplan: [Select File: floorplan.png]
  walls: [{"x1":-25,"z1":-20,"x2":25,"z2":-20,"dir":"h","thickness":0.7}]
  markers: [{"position":[-20,0,18],"type":"exit"},{"position":[0,0,0],"type":"medical"}]
  doors: [{"x":-12,"z":0,"width":2.5,"angle":1.5707}]
  windows: [{"x":-19,"z":-20,"width":4,"angle":0}]
```

### Example (cURL)

```bash
curl -X POST http://localhost:5000/api/maps/upload/665abc123def456789012345 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "floorplan=@./floorplan.png" \
  -F 'walls=[{"x1":-25,"z1":-20,"x2":25,"z2":-20,"dir":"h","thickness":0.7}]' \
  -F 'markers=[{"position":[-20,0,18],"type":"exit"}]' \
  -F 'doors=[{"x":-12,"z":0,"width":2.5,"angle":1.57}]' \
  -F 'windows=[{"x":-19,"z":-20,"width":4,"angle":0}]'
```

### Example (JavaScript/Fetch)

```javascript
const formData = new FormData();
formData.append('floorplan', fileInput.files[0]);
formData.append('walls', JSON.stringify(wallsArray));
formData.append('markers', JSON.stringify(markersArray));
formData.append('doors', JSON.stringify(doorsArray));
formData.append('windows', JSON.stringify(windowsArray));

const response = await fetch(`/api/maps/upload/${incidentId}`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData,
});
const data = await response.json();
```

### Success Response (201)

```json
{
  "success": true,
  "message": "Building map uploaded and saved successfully.",
  "data": {
    "_id": "665def789abc012345678901",
    "user": { "_id": "665...", "name": "John Doe", "email": "john@example.com" },
    "incident": {
      "_id": "665abc123def456789012345",
      "incidentType": "fire",
      "status": "active",
      "priority": "high",
      "location": { "lat": 18.5204, "lng": 73.8567 }
    },
    "floorplanImage": {
      "url": "https://res.cloudinary.com/.../rescue-ai/floorplans/incident_665abc_1708300000.jpg",
      "publicId": "rescue-ai/floorplans/incident_665abc_1708300000",
      "originalName": "building-floor1.png",
      "size": 245760
    },
    "walls": [...],
    "markers": [...],
    "doors": [...],
    "windows": [...],
    "metadata": {
      "wallCount": 14,
      "markerCount": 5,
      "doorCount": 5,
      "windowCount": 6
    },
    "createdAt": "2025-02-19T13:00:00.000Z",
    "updatedAt": "2025-02-19T13:00:00.000Z"
  }
}
```

### Error Responses

| Code | Message |
|------|---------|
| 400 | Missing file / Invalid JSON / Invalid incident ID |
| 403 | Not the owner of this incident |
| 404 | Incident not found |
| 409 | Map already exists for this incident |
| 502 | Cloudinary upload failure |

---

## 2. Get Map by Incident

Retrieve the building map linked to a specific incident.

**Endpoint:** `GET /api/maps/incident/:incidentId`  
**Access:** `user` (own incidents only) or `command` (any)

### Example

```
GET http://localhost:5000/api/maps/incident/665abc123def456789012345
Authorization: Bearer eyJhbGciOi...
```

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "_id": "665def789abc012345678901",
    "user": { "_id": "665...", "name": "John Doe", "email": "john@example.com" },
    "incident": { ... },
    "floorplanImage": { ... },
    "walls": [...],
    "markers": [...],
    "metadata": { "wallCount": 14, "markerCount": 5 },
    "createdAt": "2025-02-19T13:00:00.000Z"
  }
}
```

---

## 3. Get My Maps

Retrieve all maps uploaded by the logged-in user.

**Endpoint:** `GET /api/maps/my`  
**Access:** `user` role only

### Example

```
GET http://localhost:5000/api/maps/my
Authorization: Bearer eyJhbGciOi...
```

### Success Response (200)

```json
{
  "success": true,
  "data": [ ... ],
  "total": 3
}
```

---

## 4. Delete Map

Delete a building map and its Cloudinary image.

**Endpoint:** `DELETE /api/maps/:mapId`  
**Access:** `user` role only (must own the map)

### Example

```
DELETE http://localhost:5000/api/maps/665def789abc012345678901
Authorization: Bearer eyJhbGciOi...
```

### Success Response (200)

```json
{
  "success": true,
  "message": "Building map deleted successfully."
}
```

---

## Data Structures

### Wall Segment

```json
{
  "x1": -25,
  "z1": -20,
  "x2": 25,
  "z2": -20,
  "dir": "h",
  "thickness": 0.7
}
```

### Marker

```json
{
  "position": [-20, 0, 18],
  "type": "exit"
}
```
Types: `sos`, `exit`, `medical`, `hazard`

### Door

```json
{
  "x": -12,
  "z": 0,
  "width": 2.5,
  "angle": 1.5707,
  "hasArc": true
}
```

### Window

```json
{
  "x": -19,
  "z": -20,
  "width": 4,
  "angle": 0
}
```

---

## Environment Variables Required

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```
