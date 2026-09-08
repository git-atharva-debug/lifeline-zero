// backend/routes/mapRoutes.js
// Rescue.AI — Building Map Routes

const express = require("express");
const router = express.Router();

const { verifyToken, authorizeRoles } = require("../middleware/auth");
const { upload, handleMulterError } = require("../middleware/upload");
const {
    uploadMap,
    getMapByIncident,
    getMyMaps,
    deleteMap,
} = require("../controllers/mapController");

// ================= USER ROUTES =================

// POST /api/maps/upload/:incidentId — Upload floorplan + 3D data for an incident
// Access: "user" role only (must own the incident)
router.post(
    "/upload/:incidentId",
    verifyToken,
    authorizeRoles("user"),
    upload.single("floorplan"),
    handleMulterError,
    uploadMap
);

// GET /api/maps/my — Get all maps uploaded by the logged-in user
// Access: "user" role only
router.get(
    "/my",
    verifyToken,
    authorizeRoles("user"),
    getMyMaps
);

// DELETE /api/maps/:mapId — Delete a map (and its Cloudinary image)
// Access: "user" role only (must own the map)
router.delete(
    "/:mapId",
    verifyToken,
    authorizeRoles("user"),
    deleteMap
);

// ================= SHARED ROUTES =================

// GET /api/maps/incident/:incidentId — Get the map for a specific incident
// Access: "user" (own only) or "command" (any)
router.get(
    "/incident/:incidentId",
    verifyToken,
    authorizeRoles("user", "command"),
    getMapByIncident
);

module.exports = router;
