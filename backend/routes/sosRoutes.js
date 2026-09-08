// backend/routes/sosRoutes.js
// Rescue.AI — SOS Beacon Routes

const express = require("express");
const router = express.Router();
const { verifyToken, authorizeRoles } = require("../middleware/auth");
const {
    activateSOS,
    deactivateSOS,
    getActiveBeacons,
    updateBeaconStatus,
    clearResolved,
} = require("../controllers/sosController");

// ─── User endpoints ──────────────────────────────────────────────
// Activate / ping SOS (user sends their beacon data)
router.post("/activate", verifyToken, activateSOS);

// Deactivate SOS (user resolves their own beacon)
router.put("/deactivate", verifyToken, deactivateSOS);

// ─── Command endpoints ──────────────────────────────────────────
// Get all active beacons (command polls this)
router.get("/active", verifyToken, getActiveBeacons);

// Update beacon rescue status (dispatch / resolve)
router.put("/:id/status", verifyToken, authorizeRoles("command"), updateBeaconStatus);

// Clear resolved beacons
router.delete("/resolved", verifyToken, authorizeRoles("command"), clearResolved);

module.exports = router;
