// backend/controllers/incidentController.js
// Rescue.AI — Emergency Incident Controllers

const EmergencyIncident = require("../models/EmergencyIncident");
const PhantomMap = require("../models/PhantomMap");

// Priority weight for sorting (higher = more urgent)
const PRIORITY_WEIGHT = { critical: 4, high: 3, medium: 2, low: 1 };

// ================= CREATE INCIDENT =================
// POST /api/incidents/create
// Role: "user" only
exports.createIncident = async (req, res) => {
    try {
        const { incidentType, description, location, priority, estimatedPeople } = req.body;

        // Auto-attach user's active house layout
        let phantomMapId = null;
        try {
            const activeMap = await PhantomMap.findOne({
                user: req.user.id,
                isActive: true,
            }).select("_id").lean();
            if (activeMap) {
                phantomMapId = activeMap._id;
            }
        } catch (mapErr) {
            console.warn("Could not fetch active phantom map:", mapErr.message);
        }

        const incident = await EmergencyIncident.create({
            user: req.user.id,
            incidentType,
            description: description || "",
            location: {
                lat: location.lat,
                lng: location.lng
            },
            priority: priority || "medium",
            status: "active",
            phantomMap: phantomMapId,
            estimatedPeople: estimatedPeople || 1
        });

        // Populate user and phantomMap info on the response
        const populated = await EmergencyIncident.findById(incident._id)
            .populate("user", "name email phone")
            .populate("phantomMap", "floorplanImage.url walls markers metadata isActive")
            .lean();

        res.status(201).json({
            success: true,
            message: "Emergency incident created successfully.",
            data: populated
        });
    } catch (err) {
        console.error("Create incident error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to create incident.",
            error: err.message
        });
    }
};

// ================= GET MY INCIDENTS =================
// GET /api/incidents/my
// Role: "user" (returns only the logged-in user's incidents)
exports.getMyIncidents = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;

        const filter = { user: req.user.id };
        if (status) {
            filter.status = status;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [incidents, total] = await Promise.all([
            EmergencyIncident.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            EmergencyIncident.countDocuments(filter)
        ]);

        res.json({
            success: true,
            data: incidents,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (err) {
        console.error("Get my incidents error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch your incidents.",
            error: err.message
        });
    }
};

// ================= GET ALL ACTIVE INCIDENTS =================
// GET /api/incidents/active
// Role: "command" only
exports.getActiveIncidents = async (req, res) => {
    try {
        const { incidentType, priority, page = 1, limit = 50 } = req.query;

        const filter = {
            status: { $in: ["active", "responding"] }
        };

        if (incidentType) {
            filter.incidentType = incidentType;
        }
        if (priority) {
            filter.priority = priority;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [incidents, total] = await Promise.all([
            EmergencyIncident.find(filter)
                .populate("user", "name email phone")
                .populate("phantomMap")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            EmergencyIncident.countDocuments(filter)
        ]);

        // Sort by priority weight (critical first), then by creation time (newest first)
        incidents.sort((a, b) => {
            const weightA = PRIORITY_WEIGHT[a.priority] || 0;
            const weightB = PRIORITY_WEIGHT[b.priority] || 0;
            if (weightB !== weightA) return weightB - weightA;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        res.json({
            success: true,
            data: incidents,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (err) {
        console.error("Get active incidents error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch active incidents.",
            error: err.message
        });
    }
};

// ================= UPDATE INCIDENT STATUS =================
// PUT /api/incidents/:id/status
// Role: "command" only
exports.updateIncidentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Find the incident
        const incident = await EmergencyIncident.findById(id);

        if (!incident) {
            return res.status(404).json({
                success: false,
                message: "Incident not found."
            });
        }

        // Validate status transition
        const transitions = req.validStatusTransitions;
        if (transitions) {
            const allowedNext = transitions[incident.status];
            if (!allowedNext || !allowedNext.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot change status from "${incident.status}" to "${status}". Allowed transitions: ${(allowedNext || []).join(", ") || "none (terminal state)"}`
                });
            }
        }

        // Update
        incident.status = status;
        await incident.save();

        const populated = await EmergencyIncident.findById(incident._id)
            .populate("user", "name email phone")
            .lean();

        res.json({
            success: true,
            message: `Incident status updated to "${status}".`,
            data: populated
        });
    } catch (err) {
        // Handle invalid ObjectId
        if (err.name === "CastError" && err.kind === "ObjectId") {
            return res.status(400).json({
                success: false,
                message: "Invalid incident ID format."
            });
        }
        console.error("Update incident status error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to update incident status.",
            error: err.message
        });
    }
};

// ================= GET SINGLE INCIDENT =================
// GET /api/incidents/:id
// Role: "user" (own only) or "command" (any)
exports.getIncidentById = async (req, res) => {
    try {
        const { id } = req.params;

        const incident = await EmergencyIncident.findById(id)
            .populate("user", "name email phone")
            .populate("phantomMap")
            .lean();

        if (!incident) {
            return res.status(404).json({
                success: false,
                message: "Incident not found."
            });
        }

        // If "user" role, can only see own incidents
        if (req.user.role === "user" && incident.user._id.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "Access denied. You can only view your own incidents."
            });
        }

        res.json({
            success: true,
            data: incident
        });
    } catch (err) {
        if (err.name === "CastError" && err.kind === "ObjectId") {
            return res.status(400).json({
                success: false,
                message: "Invalid incident ID format."
            });
        }
        console.error("Get incident by ID error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch incident.",
            error: err.message
        });
    }
};
