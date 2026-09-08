// backend/models/EmergencyIncident.js
// Rescue.AI — Emergency Incident Schema

const mongoose = require("mongoose");

const emergencyIncidentSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "User reference is required"],
            index: true
        },

        incidentType: {
            type: String,
            enum: {
                values: ["fire", "flood", "earthquake", "medical", "collapse", "other"],
                message: "{VALUE} is not a valid incident type"
            },
            required: [true, "Incident type is required"]
        },

        description: {
            type: String,
            maxlength: [1000, "Description cannot exceed 1000 characters"],
            default: ""
        },

        location: {
            lat: {
                type: Number,
                required: [true, "Latitude is required"],
                min: [-90, "Latitude must be >= -90"],
                max: [90, "Latitude must be <= 90"]
            },
            lng: {
                type: Number,
                required: [true, "Longitude is required"],
                min: [-180, "Longitude must be >= -180"],
                max: [180, "Longitude must be <= 180"]
            }
        },

        status: {
            type: String,
            enum: {
                values: ["active", "responding", "resolved", "cancelled"],
                message: "{VALUE} is not a valid status"
            },
            default: "active",
            index: true
        },

        priority: {
            type: String,
            enum: {
                values: ["low", "medium", "high", "critical"],
                message: "{VALUE} is not a valid priority"
            },
            default: "medium"
        },

        phantomMap: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "PhantomMap",
            default: null,
        },
        estimatedPeople: {
            type: Number,
            default: 1,
            min: [1, "Estimated people must be at least 1"]
        }
    },
    {
        timestamps: true
    }
);

// ================= INDEXES =================
// Compound index for fetching active incidents sorted by priority
emergencyIncidentSchema.index({ status: 1, priority: 1, createdAt: -1 });

// Index for fetching user's own incidents
emergencyIncidentSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("EmergencyIncident", emergencyIncidentSchema);
