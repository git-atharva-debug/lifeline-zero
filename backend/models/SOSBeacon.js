// backend/models/SOSBeacon.js
// Rescue.AI — SOS Beacon Model

const mongoose = require("mongoose");

const sosBeaconSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        userName: { type: String, default: "Unknown" },

        // Location
        lat: { type: Number, default: null },
        lon: { type: Number, default: null },
        accuracy: { type: Number, default: null },

        // Device
        battery: { type: Number, default: null },
        signal: { type: Number, default: 4 },

        // Medical profile snapshot (copied at SOS time)
        bloodGroup: { type: String, default: "Unknown" },
        medicalConditions: { type: String, default: "None" },
        medications: { type: String, default: "None" },
        allergies: { type: String, default: "None" },
        emergencyContact: { type: String, default: "Not set" },
        emergencyPhone: { type: String, default: "Not set" },
        address: { type: String, default: "Not set" },
        notes: { type: String, default: "" },

        // Beacon state
        pingCount: { type: Number, default: 0 },
        status: {
            type: String,
            enum: ["SOS_ACTIVE", "SOS_RESOLVED"],
            default: "SOS_ACTIVE",
        },
        rescueStatus: {
            type: String,
            enum: ["pending", "dispatched", "resolved"],
            default: "pending",
        },
        resolvedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

// One active beacon per user at a time (unique index on userId + status)
sosBeaconSchema.index({ userId: 1, status: 1 });
sosBeaconSchema.index({ status: 1, rescueStatus: 1 });

module.exports = mongoose.model("SOSBeacon", sosBeaconSchema);
