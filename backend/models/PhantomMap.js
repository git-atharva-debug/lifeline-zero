// backend/models/PhantomMap.js
// Rescue.AI — Permanent House Layout Schema

const mongoose = require("mongoose");

const phantomMapSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "User reference is required"],
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
            originalName: { type: String, default: "" },
            size: { type: Number, default: 0 },
        },

        walls: {
            type: [mongoose.Schema.Types.Mixed],
            default: [],
        },

        markers: {
            type: [mongoose.Schema.Types.Mixed],
            default: [],
        },

        doors: {
            type: [mongoose.Schema.Types.Mixed],
            default: [],
        },

        windows: {
            type: [mongoose.Schema.Types.Mixed],
            default: [],
        },

        isActive: {
            type: Boolean,
            default: true,
            index: true,
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

// Only one active map per user
phantomMapSchema.index({ user: 1, isActive: 1 });
// User's maps sorted by time
phantomMapSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("PhantomMap", phantomMapSchema);
