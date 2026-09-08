// backend/controllers/resourceController.js
const RescueResource = require("../models/RescueResource");

exports.getAllResources = async (req, res) => {
    try {
        const resources = await RescueResource.find({}).sort({ createdAt: 1 });
        res.json({ success: true, data: resources });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.addResource = async (req, res) => {
    try {
        const { type } = req.body;
        const count = await RescueResource.countDocuments({ type });

        const icons = {
            ambulance: '🚑',
            fire_unit: '🚒',
            helicopter: '🚁',
            rescue_boat: '⛵'
        };

        const prefix = {
            ambulance: 'MED',
            fire_unit: 'FU',
            helicopter: 'AIR',
            rescue_boat: 'RB'
        };

        const resource = await RescueResource.create({
            type,
            name: `${prefix[type]}-${count + 1}`,
            icon: icons[type] || '⚠️'
        });

        res.status(201).json({ success: true, data: resource });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.removeResourceByType = async (req, res) => {
    try {
        const { type } = req.params;
        // Find the latest unit that is available
        const resource = await RescueResource.findOne({ type, status: "Available" }).sort({ createdAt: -1 });

        if (!resource) {
            return res.status(404).json({ success: false, message: "No available units of this type to remove." });
        }

        await RescueResource.findByIdAndDelete(resource._id);
        res.json({ success: true, message: "Resource removed." });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateResource = async (req, res) => {
    try {
        const { id } = req.params;
        const resource = await RescueResource.findByIdAndUpdate(id, req.body, { new: true });
        res.json({ success: true, data: resource });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
