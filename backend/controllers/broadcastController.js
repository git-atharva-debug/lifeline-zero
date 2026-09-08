// backend/controllers/broadcastController.js
// Rescue.AI — Broadcast Alert Controller

const BroadcastAlert = require("../models/BroadcastAlert");

// ================= CREATE BROADCAST (POST) =================
// POST /api/broadcasts
// Access: Command role only
const createBroadcast = async (req, res) => {
    try {
        const { alertType, zone, severity, message, sentBy } = req.body;

        if (!alertType || !message) {
            return res.status(400).json({
                success: false,
                message: "alertType and message are required.",
            });
        }

        const broadcast = await BroadcastAlert.create({
            alertType,
            zone: zone || "All Zones",
            severity: severity || "HIGH",
            message: message.trim(),
            sentBy: sentBy || "Command Center",
            createdBy: req.user.id,
        });

        return res.status(201).json({
            success: true,
            message: "Broadcast alert sent successfully.",
            data: broadcast,
        });
    } catch (err) {
        console.error("createBroadcast error:", err);

        // Mongoose validation error
        if (err.name === "ValidationError") {
            const messages = Object.values(err.errors).map((e) => e.message);
            return res.status(400).json({
                success: false,
                message: messages.join(", "),
            });
        }

        return res.status(500).json({
            success: false,
            message: "Server error while creating broadcast.",
            error: err.message,
        });
    }
};

// ================= GET ALL BROADCASTS (GET) =================
// GET /api/broadcasts?limit=50
// Access: Any authenticated user
const getBroadcasts = async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);

        const broadcasts = await BroadcastAlert.find()
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        return res.status(200).json({
            success: true,
            count: broadcasts.length,
            data: broadcasts,
        });
    } catch (err) {
        console.error("getBroadcasts error:", err);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching broadcasts.",
            error: err.message,
        });
    }
};

module.exports = { createBroadcast, getBroadcasts };
