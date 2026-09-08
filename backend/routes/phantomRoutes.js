// backend/routes/phantomRoutes.js
// Rescue.AI — Phantom Map Routes (Permanent House Layout)

const express = require("express");
const router = express.Router();

const { verifyToken, authorizeRoles } = require("../middleware/auth");
const { upload, handleMulterError } = require("../middleware/upload");
const {
    uploadPhantomMap,
    getMyMaps,
    getActiveMap,
    deletePhantomMap,
    setActiveMap,
} = require("../controllers/phantomController");

// POST /api/phantom/upload — Upload floorplan + save as active house layout
router.post(
    "/upload",
    verifyToken,
    authorizeRoles("user"),
    upload.single("floorplan"),
    handleMulterError,
    uploadPhantomMap
);

// GET /api/phantom/my — Get all saved maps for logged-in user
router.get(
    "/my",
    verifyToken,
    authorizeRoles("user"),
    getMyMaps
);

// GET /api/phantom/active — Get user's current active map
router.get(
    "/active",
    verifyToken,
    authorizeRoles("user"),
    getActiveMap
);

// PUT /api/phantom/:mapId/activate — Set a map as active
router.put(
    "/:mapId/activate",
    verifyToken,
    authorizeRoles("user"),
    setActiveMap
);

// DELETE /api/phantom/:mapId — Delete a map
router.delete(
    "/:mapId",
    verifyToken,
    authorizeRoles("user"),
    deletePhantomMap
);

module.exports = router;
