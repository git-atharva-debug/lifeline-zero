// backend/routes/incidentRoutes.js
// Rescue.AI — Emergency Incident Routes

const express = require("express");
const router = express.Router();

const { verifyToken, authorizeRoles } = require("../middleware/auth");
const { validateCreateIncident, validateStatusUpdate } = require("../middleware/validate");
const {
    createIncident,
    getMyIncidents,
    getActiveIncidents,
    updateIncidentStatus,
    getIncidentById
} = require("../controllers/incidentController");

// ================= USER ROUTES =================

// POST /api/incidents/create — Create a new emergency incident
// Access: "user" role only
router.post(
    "/create",
    verifyToken,
    authorizeRoles("user"),
    validateCreateIncident,
    createIncident
);

// GET /api/incidents/my — Get logged-in user's incidents
// Access: "user" role only
router.get(
    "/my",
    verifyToken,
    authorizeRoles("user"),
    getMyIncidents
);

// ================= COMMAND CENTER ROUTES =================

// GET /api/incidents/active — Get all active/responding incidents
// Access: "command" role only
router.get(
    "/active",
    verifyToken,
    authorizeRoles("command"),
    getActiveIncidents
);

// PUT /api/incidents/:id/status — Update incident status
// Access: "command" role only
router.put(
    "/:id/status",
    verifyToken,
    authorizeRoles("command"),
    validateStatusUpdate,
    updateIncidentStatus
);

// ================= SHARED ROUTES =================

// GET /api/incidents/:id — Get single incident by ID
// Access: "user" (own only) or "command" (any)
router.get(
    "/:id",
    verifyToken,
    authorizeRoles("user", "command"),
    getIncidentById
);

module.exports = router;
