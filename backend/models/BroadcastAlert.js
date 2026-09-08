// backend/models/BroadcastAlert.js
// Rescue.AI — Broadcast Alert Schema

const mongoose = require("mongoose");

const broadcastAlertSchema = new mongoose.Schema(
    {
        alertType: {
            type: String,
            required: [true, "Alert type is required"],
            enum: [
                "flood_warning",
                "evacuation_order",
                "shelter_in_place",
                "all_clear",
                "medical_alert",
                "earthquake_warning",
                "cyclone_warning",
            ],
        },
        zone: {
            type: String,
            required: [true, "Target zone is required"],
            default: "All Zones",
        },
        severity: {
            type: String,
            required: [true, "Severity is required"],
            enum: ["CRITICAL", "HIGH", "MODERATE", "LOW"],
        },
        message: {
            type: String,
            required: [true, "Alert message is required"],
            trim: true,
            maxlength: [1000, "Message cannot exceed 1000 characters"],
        },
        sentBy: {
            type: String,
            default: "Command Center",
            trim: true,
        },
        // Reference to the command user who created this alert
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    },
    {
        timestamps: true, // adds createdAt & updatedAt
    }
);

// Index for efficient querying (newest first)
broadcastAlertSchema.index({ createdAt: -1 });

module.exports = mongoose.model("BroadcastAlert", broadcastAlertSchema);
