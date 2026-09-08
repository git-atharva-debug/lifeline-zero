// backend/models/RescueResource.js
const mongoose = require("mongoose");

const rescueResourceSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true
        },
        type: {
            type: String,
            enum: ["ambulance", "fire_unit", "helicopter", "rescue_boat"],
            required: true
        },
        icon: String,
        status: {
            type: String,
            enum: ["Available", "Deployed", "En Route", "Returning"],
            default: "Available"
        },
        zone: {
            type: String,
            default: "Base"
        },
        lat: {
            type: Number,
            default: 18.5204
        },
        lon: {
            type: Number,
            default: 73.8567
        },
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "EmergencyIncident",
            default: null
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("RescueResource", rescueResourceSchema);
