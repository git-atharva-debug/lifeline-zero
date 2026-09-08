// backend/routes/userRoutes.js
// Rescue.AI — User Profile Routes

const express = require("express");
const {
    updateEmergencyProfile,
    getEmergencyProfile
} = require("../controllers/userController");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// Emergency Profile routes (JWT-protected)
router.get("/profile/emergency", verifyToken, getEmergencyProfile);
router.put("/profile/emergency", verifyToken, updateEmergencyProfile);

module.exports = router;
