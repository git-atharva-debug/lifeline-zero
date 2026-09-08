// backend/models/BuildingMap.js
// Rescue.AI — 3D Building Map Schema

const mongoose = require("mongoose");

const buildingMapSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "User reference is required"],
            index: true,
        },

        incident: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "EmergencyIncident",
            required: [true, "Incident reference is required"],
            index: true,
        },

        floorplanImage: {
            url: {
                type: String,
                required: [true, "Floorplan image URL is required"],
            },
            publicId: {
                type: String,
                required: [true, "Cloudinary public ID is required"],
            },
            originalName: {
                type: String,
                default: "",
            },
            size: {
                type: Number,
                default: 0,
            },
        },

        walls: {
            type: [mongoose.Schema.Types.Mixed],
            default: [],
            validate: {
                validator: function (v) {
                    return Array.isArray(v);
                },
                message: "Walls must be an array",
            },
        },

        markers: {
            type: [mongoose.Schema.Types.Mixed],
            default: [],
            validate: {
                validator: function (v) {
                    return Array.isArray(v);
                },
                message: "Markers must be an array",
            },
        },

        doors: {
            type: [mongoose.Schema.Types.Mixed],
            default: [],
        },

        windows: {
            type: [mongoose.Schema.Types.Mixed],
            default: [],
        },

        metadata: {
            wallCount: { type: Number, default: 0 },
            markerCount: { type: Number, default: 0 },
            doorCount: { type: Number, default: 0 },
            windowCount: { type: Number, default: 0 },
        },
    },
    {
        timestamps: true,
    }
);

// Compound index: one map per incident (prevent duplicates)
buildingMapSchema.index({ incident: 1 }, { unique: true });

// Index for user lookups
buildingMapSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("BuildingMap", buildingMapSchema);
