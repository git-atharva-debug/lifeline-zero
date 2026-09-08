# Rescue.AI — Emergency Incident API Reference

## Base URL
```
http://localhost:5000/api/incidents
```

## Authentication
All routes require a valid JWT token in the `Authorization` header:
```
Authorization: Bearer <your_jwt_token>
```

---

## 1. Create Emergency Incident

**`POST /api/incidents/create`**

| Field | Required | Notes |
|---|---|---|
| Role | `user` only | Command center users cannot create incidents |

### Request Body
```json
{
  "incidentType": "fire",
  "description": "Building on fire, 3rd floor, people trapped",
  "location": {
    "lat": 18.5204,
    "lng": 73.8567
  },
  "priority": "critical"
}
```

### Valid `incidentType` values
`fire` | `flood` | `earthquake` | `medical` | `collapse` | `other`

### Valid `priority` values
`low` | `medium` (default) | `high` | `critical`

### Postman Setup
```
Method: POST
URL:    http://localhost:5000/api/incidents/create
Headers:
  Content-Type: application/json
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6...

Body (raw JSON):
{
  "incidentType": "earthquake",
  "description": "Major earthquake felt, building damage in sector 5",
  "location": {
    "lat": 18.5204,
    "lng": 73.8567
  },
  "priority": "high"
}
```

### Success Response (201)
```json
{
  "success": true,
  "message": "Emergency incident created successfully.",
  "data": {
    "_id": "65a1b2c3d4e5f6a7b8c9d0e1",
    "user": {
      "_id": "65a0b1c2d3e4f5a6b7c8d9e0",
      "name": "Rahul Singh",
      "email": "rahul@example.com",
      "phone": "9876543210"
    },
    "incidentType": "earthquake",
    "description": "Major earthquake felt, building damage in sector 5",
    "location": { "lat": 18.5204, "lng": 73.8567 },
    "status": "active",
    "priority": "high",
    "createdAt": "2026-02-19T12:30:00.000Z",
    "updatedAt": "2026-02-19T12:30:00.000Z"
  }
}
```

### Error Responses
- `400` — Validation failed (missing fields, invalid coordinates, etc.)
- `401` — No token / expired token
- `403` — Not a "user" role

---

## 2. Get My Incidents

**`GET /api/incidents/my`**

| Field | Required | Notes |
|---|---|---|
| Role | `user` only | Returns only the logged-in user's incidents |

### Query Parameters (optional)
| Param | Type | Description |
|---|---|---|
| `status` | string | Filter by status: `active`, `responding`, `resolved`, `cancelled` |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20) |

### Postman Setup
```
Method: GET
URL:    http://localhost:5000/api/incidents/my?status=active&page=1&limit=10
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

### Success Response (200)
```json
{
  "success": true,
  "data": [
    {
      "_id": "65a1b2c3d4e5f6a7b8c9d0e1",
      "incidentType": "fire",
      "description": "Building on fire",
      "location": { "lat": 18.5204, "lng": 73.8567 },
      "status": "active",
      "priority": "critical",
      "createdAt": "2026-02-19T12:30:00.000Z",
      "updatedAt": "2026-02-19T12:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 5,
    "page": 1,
    "limit": 10,
    "pages": 1
  }
}
```

---

## 3. Get Active Incidents (Command Center)

**`GET /api/incidents/active`**

| Field | Required | Notes |
|---|---|---|
| Role | `command` only | Returns all active + responding incidents |

### Query Parameters (optional)
| Param | Type | Description |
|---|---|---|
| `incidentType` | string | Filter by type |
| `priority` | string | Filter by priority |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 50) |

### Postman Setup
```
Method: GET
URL:    http://localhost:5000/api/incidents/active?priority=critical&page=1
Headers:
  Authorization: Bearer <command_user_token>
```

### Success Response (200)
```json
{
  "success": true,
  "data": [
    {
      "_id": "65a1b2c3d4e5f6a7b8c9d0e1",
      "user": {
        "_id": "65a0b1c2d3e4f5a6b7c8d9e0",
        "name": "Rahul Singh",
        "email": "rahul@example.com",
        "phone": "9876543210"
      },
      "incidentType": "fire",
      "description": "Building on fire, 3rd floor",
      "location": { "lat": 18.5204, "lng": 73.8567 },
      "status": "active",
      "priority": "critical",
      "createdAt": "2026-02-19T12:30:00.000Z"
    }
  ],
  "pagination": { "total": 12, "page": 1, "limit": 50, "pages": 1 }
}
```

Results are sorted by **priority** (critical → high → medium → low), then by **newest first**.

---

## 4. Update Incident Status

**`PUT /api/incidents/:id/status`**

| Field | Required | Notes |
|---|---|---|
| Role | `command` only | Status transition rules enforced |

### Status Transition Rules
| Current Status | Allowed Next Status |
|---|---|
| `active` | `responding`, `cancelled` |
| `responding` | `resolved`, `cancelled` |
| `resolved` | _(terminal — cannot change)_ |
| `cancelled` | _(terminal — cannot change)_ |

### Request Body
```json
{
  "status": "responding"
}
```

### Postman Setup
```
Method: PUT
URL:    http://localhost:5000/api/incidents/65a1b2c3d4e5f6a7b8c9d0e1/status
Headers:
  Content-Type: application/json
  Authorization: Bearer <command_user_token>

Body (raw JSON):
{
  "status": "responding"
}
```

### Success Response (200)
```json
{
  "success": true,
  "message": "Incident status updated to \"responding\".",
  "data": {
    "_id": "65a1b2c3d4e5f6a7b8c9d0e1",
    "user": { "_id": "...", "name": "Rahul Singh", "email": "rahul@example.com", "phone": "9876543210" },
    "incidentType": "fire",
    "status": "responding",
    "priority": "critical",
    "updatedAt": "2026-02-19T12:45:00.000Z"
  }
}
```

### Error Responses
- `400` — Invalid status or invalid transition (e.g., resolved → active)
- `404` — Incident not found

---

## 5. Get Single Incident

**`GET /api/incidents/:id`**

| Field | Required | Notes |
|---|---|---|
| Role | `user` (own only) or `command` (any) | Cross-checked ownership for users |

### Postman Setup
```
Method: GET
URL:    http://localhost:5000/api/incidents/65a1b2c3d4e5f6a7b8c9d0e1
Headers:
  Authorization: Bearer <token>
```

### Success Response (200)
```json
{
  "success": true,
  "data": {
    "_id": "65a1b2c3d4e5f6a7b8c9d0e1",
    "user": { "_id": "...", "name": "Rahul Singh", "email": "rahul@example.com" },
    "incidentType": "fire",
    "description": "Building on fire, 3rd floor",
    "location": { "lat": 18.5204, "lng": 73.8567 },
    "status": "responding",
    "priority": "critical",
    "createdAt": "2026-02-19T12:30:00.000Z",
    "updatedAt": "2026-02-19T12:45:00.000Z"
  }
}
```

---

## Error Response Format (all endpoints)
```json
{
  "success": false,
  "message": "Descriptive error message",
  "errors": ["field-level error 1", "field-level error 2"]
}
```

## Common HTTP Status Codes
| Code | Meaning |
|---|---|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request / Validation Error |
| 401 | Unauthorized (no/invalid/expired token) |
| 403 | Forbidden (wrong role) |
| 404 | Not Found |
| 500 | Server Error |
