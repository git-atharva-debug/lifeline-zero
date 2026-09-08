// backend/middleware/validate.js
// Rescue.AI — Request Validation Middleware for Incidents

// ================= VALID ENUMS =================
const VALID_INCIDENT_TYPES = ["fire", "flood", "earthquake", "medical", "collapse", "other"];
const VALID_STATUSES = ["active", "responding", "resolved", "cancelled"];
const VALID_PRIORITIES = ["low", "medium", "high", "critical"];

// Valid status transitions: what a "command" user can change status TO, from each status
const VALID_STATUS_TRANSITIONS = {
    active: ["responding", "cancelled"],
    responding: ["resolved", "cancelled"],
    resolved: [],       // terminal state
    cancelled: []       // terminal state
};

// ================= VALIDATE CREATE INCIDENT =================
const validateCreateIncident = (req, res, next) => {
    const { incidentType, location, priority, description } = req.body;
    const errors = [];

    // --- incidentType ---
    if (!incidentType) {
        errors.push("incidentType is required.");
    } else if (!VALID_INCIDENT_TYPES.includes(incidentType)) {
        errors.push(`Invalid incidentType. Must be one of: ${VALID_INCIDENT_TYPES.join(", ")}`);
    }

    // --- location ---
    if (!location) {
        errors.push("location is required.");
    } else {
        if (location.lat === undefined || location.lat === null) {
            errors.push("location.lat is required.");
        } else if (typeof location.lat !== "number" || location.lat < -90 || location.lat > 90) {
            errors.push("location.lat must be a number between -90 and 90.");
        }

        if (location.lng === undefined || location.lng === null) {
            errors.push("location.lng is required.");
        } else if (typeof location.lng !== "number" || location.lng < -180 || location.lng > 180) {
            errors.push("location.lng must be a number between -180 and 180.");
        }
    }

    // --- priority (optional on create, defaults to "medium") ---
    if (priority && !VALID_PRIORITIES.includes(priority)) {
        errors.push(`Invalid priority. Must be one of: ${VALID_PRIORITIES.join(", ")}`);
    }

    // --- description length check ---
    if (description && typeof description === "string" && description.length > 1000) {
        errors.push("Description must be under 1000 characters.");
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: "Validation failed.",
            errors
        });
    }

    next();
};

// ================= VALIDATE STATUS UPDATE =================
const validateStatusUpdate = (req, res, next) => {
    const { status } = req.body;
    const errors = [];

    if (!status) {
        errors.push("status is required.");
    } else if (!VALID_STATUSES.includes(status)) {
        errors.push(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`);
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: "Validation failed.",
            errors
        });
    }

    // Attach valid transitions map for the controller to use
    req.validStatusTransitions = VALID_STATUS_TRANSITIONS;
    next();
};

module.exports = {
    validateCreateIncident,
    validateStatusUpdate,
    VALID_INCIDENT_TYPES,
    VALID_STATUSES,
    VALID_PRIORITIES,
    VALID_STATUS_TRANSITIONS
};
