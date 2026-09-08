// backend/routes/broadcastRoutes.js
// Rescue.AI — Broadcast Alert Routes

const express = require("express");
const router = express.Router();
const { verifyToken, authorizeRoles } = require("../middleware/auth");
const { createBroadcast, getBroadcasts } = require("../controllers/broadcastController");

// POST /api/broadcasts — Command creates a broadcast alert
router.post("/", verifyToken, authorizeRoles("command"), createBroadcast);

// GET  /api/broadcasts — Any authenticated user fetches broadcast alerts
router.get("/", verifyToken, getBroadcasts);

module.exports = router;
