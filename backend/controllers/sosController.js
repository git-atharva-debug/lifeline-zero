// backend/controllers/sosController.js
// Rescue.AI — SOS Beacon Controller

const SOSBeacon = require("../models/SOSBeacon");
const User = require("../models/User");

// ================= ACTIVATE / PING SOS =================
// POST /api/sos/activate
// Called when user first activates SOS AND on every 10s ping
exports.activateSOS = async (req, res) => {
    try {
        const {
            lat, lon, accuracy,
            battery, signal,
            bloodGroup, medicalConditions, medications, allergies,
            emergencyContact, emergencyPhone,
            address, notes, pingCount,
        } = req.body;

        // 1. Check if there's an existing beacon for this user
        // We look for the MOST RECENT one
        let beacon = await SOSBeacon.findOne({ userId: req.user.id }).sort({ updatedAt: -1 });

        // 2. If it exists and is MARKED AS RESOLVED, do not re-activate it
        // BUT: If pingCount is 1, it means the user is manually starting a NEW SOS session,
        // so we should ignore the old resolved state and create a new beacon.
        if (pingCount !== 1 && beacon && beacon.status === "SOS_RESOLVED") {
            return res.status(200).json({
                success: true,
                message: "User is already marked as rescued.",
                data: beacon,
            });
        }

        // 3. Otherwise, fetch user name and Upsert (Update or Create)
        const user = await User.findById(req.user.id).select("name");
        const userName = user?.name || "Unknown";

        beacon = await SOSBeacon.findOneAndUpdate(
            { userId: req.user.id, status: "SOS_ACTIVE" },
            {
                $set: {
                    userName,
                    lat: lat ?? null,
                    lon: lon ?? null,
                    accuracy: accuracy ?? null,
                    battery: battery ?? null,
                    signal: signal ?? 4,
                    bloodGroup: bloodGroup || "Unknown",
                    medicalConditions: medicalConditions || "None",
                    medications: medications || "None",
                    allergies: allergies || "None",
                    emergencyContact: emergencyContact || "Not set",
                    emergencyPhone: emergencyPhone || "Not set",
                    address: address || "Not set",
                    notes: notes || "",
                    pingCount: pingCount || 1,
                    status: "SOS_ACTIVE",
                },
                $setOnInsert: {
                    rescueStatus: "pending",
                },
            },
            { new: true, upsert: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: "SOS beacon updated.",
            data: beacon,
        });
    } catch (err) {
        console.error("Activate SOS error:", err);
        res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: err.message,
        });
    }
};

// ================= DEACTIVATE SOS =================
// PUT /api/sos/deactivate
// Called when user deactivates their own SOS
exports.deactivateSOS = async (req, res) => {
    try {
        const beacon = await SOSBeacon.findOneAndUpdate(
            { userId: req.user.id, status: "SOS_ACTIVE" },
            {
                $set: {
                    status: "SOS_RESOLVED",
                    rescueStatus: "resolved",
                    resolvedAt: new Date(),
                },
            },
            { new: true }
        );

        if (!beacon) {
            return res.status(404).json({
                success: false,
                message: "No active SOS beacon found.",
            });
        }

        res.status(200).json({
            success: true,
            message: "SOS beacon deactivated.",
            data: beacon,
        });
    } catch (err) {
        console.error("Deactivate SOS error:", err);
        res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: err.message,
        });
    }
};

// ================= GET ALL ACTIVE SOS BEACONS =================
// GET /api/sos/active
// Called by command dashboard to poll active beacons
exports.getActiveBeacons = async (req, res) => {
    try {
        // Return all beacons that are not fully resolved, or resolved < 1 hour ago
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        const beacons = await SOSBeacon.find({
            $or: [
                { status: "SOS_ACTIVE" },
                { status: "SOS_RESOLVED", resolvedAt: { $gte: oneHourAgo } },
            ],
        }).sort({ updatedAt: -1 });

        // Convert to the format the frontend expects (keyed by a string ID)
        const result = {};
        beacons.forEach((b) => {
            const key = b._id.toString();
            result[key] = {
                id: b._id.toString(),
                odId: b._id.toString(),
                userId: b._id.toString(),
                name: b.userName,
                lat: b.lat,
                lon: b.lon,
                accuracy: b.accuracy,
                battery: b.battery,
                signal: b.signal,
                bloodGroup: b.bloodGroup,
                medicalConditions: b.medicalConditions,
                medications: b.medications,
                allergies: b.allergies,
                emergencyContact: b.emergencyContact,
                emergencyPhone: b.emergencyPhone,
                address: b.address,
                notes: b.notes,
                pingCount: b.pingCount,
                timestamp: b.updatedAt,
                status: b.status,
                rescueStatus: b.rescueStatus,
                resolvedAt: b.resolvedAt,
            };
        });

        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (err) {
        console.error("Get active beacons error:", err);
        res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: err.message,
        });
    }
};

// ================= UPDATE BEACON STATUS (by Command) =================
// PUT /api/sos/:id/status
// Called by command to dispatch or resolve a beacon
exports.updateBeaconStatus = async (req, res) => {
    try {
        const { rescueStatus } = req.body;
        if (!["pending", "dispatched", "resolved"].includes(rescueStatus)) {
            return res.status(400).json({
                success: false,
                message: "Invalid rescue status. Must be pending, dispatched, or resolved.",
            });
        }

        const update = { rescueStatus };
        if (rescueStatus === "resolved") {
            update.status = "SOS_RESOLVED";
            update.resolvedAt = new Date();
        }

        const beacon = await SOSBeacon.findByIdAndUpdate(
            req.params.id,
            { $set: update },
            { new: true }
        );

        if (!beacon) {
            return res.status(404).json({
                success: false,
                message: "Beacon not found.",
            });
        }

        res.status(200).json({
            success: true,
            message: `Beacon status updated to ${rescueStatus}.`,
            data: beacon,
        });
    } catch (err) {
        console.error("Update beacon status error:", err);
        res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: err.message,
        });
    }
};

// ================= CLEAR RESOLVED BEACONS =================
// DELETE /api/sos/resolved
// Called by command to clear old resolved beacons
exports.clearResolved = async (req, res) => {
    try {
        const result = await SOSBeacon.deleteMany({ rescueStatus: "resolved" });

        res.status(200).json({
            success: true,
            message: `Cleared ${result.deletedCount} resolved beacons.`,
        });
    } catch (err) {
        console.error("Clear resolved error:", err);
        res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: err.message,
        });
    }
};
