// backend/controllers/mapController.js
// Rescue.AI — Building Map Controllers

const { Readable } = require("stream");
const { cloudinary } = require("../config/cloudinary");
const BuildingMap = require("../models/BuildingMap");
const EmergencyIncident = require("../models/EmergencyIncident");

// ================= HELPER: Upload buffer to Cloudinary =================
function uploadToCloudinary(buffer, options = {}) {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: "rescue-ai/floorplans",
                resource_type: "image",
                allowed_formats: ["png", "jpg", "jpeg", "webp"],
                transformation: [{ quality: "auto", fetch_format: "auto" }],
                ...options,
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );
        const readable = Readable.from(buffer);
        readable.pipe(uploadStream);
    });
}

// ================= UPLOAD MAP =================
// POST /api/maps/upload/:incidentId
// Role: "user" only
exports.uploadMap = async (req, res) => {
    try {
        const { incidentId } = req.params;
        const userId = req.user.id;

        // ---- 1. Validate incident exists ----
        const incident = await EmergencyIncident.findById(incidentId);
        if (!incident) {
            return res.status(404).json({
                success: false,
                message: "Incident not found.",
            });
        }

        // ---- 2. Validate ownership ----
        if (incident.user.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: "Access denied. You can only upload maps to your own incidents.",
            });
        }

        // ---- 3. Check for existing map (one per incident) ----
        const existingMap = await BuildingMap.findOne({ incident: incidentId });
        if (existingMap) {
            return res.status(409).json({
                success: false,
                message: "A map already exists for this incident. Delete it first to upload a new one.",
                data: existingMap,
            });
        }

        // ---- 4. Validate file ----
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Floorplan image is required. Upload a PNG/JPG/JPEG/WEBP file.",
            });
        }

        // ---- 5. Parse walls JSON ----
        let walls = [];
        if (req.body.walls) {
            try {
                walls = JSON.parse(req.body.walls);
                if (!Array.isArray(walls)) {
                    return res.status(400).json({
                        success: false,
                        message: "walls must be a JSON array.",
                    });
                }
            } catch (parseErr) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid walls JSON. Must be a valid JSON array string.",
                    error: parseErr.message,
                });
            }
        }

        // ---- 6. Parse markers JSON ----
        let markers = [];
        if (req.body.markers) {
            try {
                markers = JSON.parse(req.body.markers);
                if (!Array.isArray(markers)) {
                    return res.status(400).json({
                        success: false,
                        message: "markers must be a JSON array.",
                    });
                }
            } catch (parseErr) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid markers JSON. Must be a valid JSON array string.",
                    error: parseErr.message,
                });
            }
        }

        // ---- 7. Parse doors JSON (optional) ----
        let doors = [];
        if (req.body.doors) {
            try {
                doors = JSON.parse(req.body.doors);
                if (!Array.isArray(doors)) doors = [];
            } catch {
                doors = [];
            }
        }

        // ---- 8. Parse windows JSON (optional) ----
        let windows = [];
        if (req.body.windows) {
            try {
                windows = JSON.parse(req.body.windows);
                if (!Array.isArray(windows)) windows = [];
            } catch {
                windows = [];
            }
        }

        // ---- 9. Upload to Cloudinary ----
        let cloudResult;
        try {
            cloudResult = await uploadToCloudinary(req.file.buffer, {
                public_id: `incident_${incidentId}_${Date.now()}`,
            });
        } catch (cloudErr) {
            console.error("Cloudinary upload error:", cloudErr);
            return res.status(502).json({
                success: false,
                message: "Failed to upload image to cloud storage.",
                error: cloudErr.message,
            });
        }

        // ---- 10. Save to DB ----
        const buildingMap = await BuildingMap.create({
            user: userId,
            incident: incidentId,
            floorplanImage: {
                url: cloudResult.secure_url,
                publicId: cloudResult.public_id,
                originalName: req.file.originalname,
                size: req.file.size,
            },
            walls,
            markers,
            doors,
            windows,
            metadata: {
                wallCount: walls.length,
                markerCount: markers.length,
                doorCount: doors.length,
                windowCount: windows.length,
            },
        });

        // Populate for response
        const populated = await BuildingMap.findById(buildingMap._id)
            .populate("user", "name email")
            .populate("incident", "incidentType status priority location")
            .lean();

        res.status(201).json({
            success: true,
            message: "Building map uploaded and saved successfully.",
            data: populated,
        });
    } catch (err) {
        if (err.name === "CastError" && err.kind === "ObjectId") {
            return res.status(400).json({
                success: false,
                message: "Invalid incident ID format.",
            });
        }
        console.error("Upload map error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to upload building map.",
            error: err.message,
        });
    }
};

// ================= GET MAP BY INCIDENT =================
// GET /api/maps/incident/:incidentId
// Role: "user" (own) or "command" (any)
exports.getMapByIncident = async (req, res) => {
    try {
        const { incidentId } = req.params;

        const map = await BuildingMap.findOne({ incident: incidentId })
            .populate("user", "name email")
            .populate("incident", "incidentType status priority location")
            .lean();

        if (!map) {
            return res.status(404).json({
                success: false,
                message: "No map found for this incident.",
            });
        }

        // Ownership check for "user" role
        if (req.user.role === "user" && map.user._id.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "Access denied. You can only view maps for your own incidents.",
            });
        }

        res.json({
            success: true,
            data: map,
        });
    } catch (err) {
        if (err.name === "CastError" && err.kind === "ObjectId") {
            return res.status(400).json({
                success: false,
                message: "Invalid incident ID format.",
            });
        }
        console.error("Get map error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch building map.",
            error: err.message,
        });
    }
};

// ================= GET MY MAPS =================
// GET /api/maps/my
// Role: "user" only
exports.getMyMaps = async (req, res) => {
    try {
        const maps = await BuildingMap.find({ user: req.user.id })
            .populate("incident", "incidentType status priority location")
            .sort({ createdAt: -1 })
            .lean();

        res.json({
            success: true,
            data: maps,
            total: maps.length,
        });
    } catch (err) {
        console.error("Get my maps error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch your maps.",
            error: err.message,
        });
    }
};

// ================= DELETE MAP =================
// DELETE /api/maps/:mapId
// Role: "user" (own only)
exports.deleteMap = async (req, res) => {
    try {
        const { mapId } = req.params;

        const map = await BuildingMap.findById(mapId);
        if (!map) {
            return res.status(404).json({
                success: false,
                message: "Map not found.",
            });
        }

        // Ownership check
        if (map.user.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "Access denied. You can only delete your own maps.",
            });
        }

        // Delete from Cloudinary
        if (map.floorplanImage?.publicId) {
            try {
                await cloudinary.uploader.destroy(map.floorplanImage.publicId);
            } catch (cloudErr) {
                console.warn("Cloudinary delete warning:", cloudErr.message);
                // Continue with DB delete even if cloud delete fails
            }
        }

        await BuildingMap.findByIdAndDelete(mapId);

        res.json({
            success: true,
            message: "Building map deleted successfully.",
        });
    } catch (err) {
        if (err.name === "CastError" && err.kind === "ObjectId") {
            return res.status(400).json({
                success: false,
                message: "Invalid map ID format.",
            });
        }
        console.error("Delete map error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to delete building map.",
            error: err.message,
        });
    }
};
