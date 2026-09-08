// backend/controllers/phantomController.js
// Rescue.AI — Phantom Map Controllers (Permanent House Layout)

const { Readable } = require("stream");
const { cloudinary } = require("../config/cloudinary");
const PhantomMap = require("../models/PhantomMap");

// ── Helper: Upload buffer to Cloudinary ──
function uploadToCloudinary(buffer, options = {}) {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: "rescue-ai/phantom-maps",
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
        Readable.from(buffer).pipe(uploadStream);
    });
}

// ── Helper: Safe JSON parse ──
function safeParseArray(str) {
    if (!str) return [];
    try {
        const parsed = JSON.parse(str);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

// ================= UPLOAD PHANTOM MAP =================
// POST /api/phantom/upload
// Role: "user" only
exports.uploadPhantomMap = async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Validate file
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Floorplan image is required. Upload a PNG/JPG/JPEG/WEBP file.",
            });
        }

        // 2. Parse JSON arrays
        const walls = safeParseArray(req.body.walls);
        const markers = safeParseArray(req.body.markers);
        const doors = safeParseArray(req.body.doors);
        const windows = safeParseArray(req.body.windows);

        // 3. Upload to Cloudinary
        let cloudResult;
        try {
            cloudResult = await uploadToCloudinary(req.file.buffer, {
                public_id: `user_${userId}_${Date.now()}`,
            });
        } catch (cloudErr) {
            console.error("Cloudinary upload error:", cloudErr);
            return res.status(502).json({
                success: false,
                message: "Failed to upload image to cloud storage.",
                error: cloudErr.message,
            });
        }

        // 4. Deactivate all previous maps for this user
        await PhantomMap.updateMany(
            { user: userId, isActive: true },
            { $set: { isActive: false } }
        );

        // 5. Save new map as active
        const phantomMap = await PhantomMap.create({
            user: userId,
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
            isActive: true,
            metadata: {
                wallCount: walls.length,
                markerCount: markers.length,
                doorCount: doors.length,
                windowCount: windows.length,
            },
        });

        console.log(`✅ PhantomMap saved for user ${userId} — ID: ${phantomMap._id}`);

        res.status(201).json({
            success: true,
            message: "House layout saved as your active map.",
            data: phantomMap,
        });
    } catch (err) {
        console.error("Upload phantom map error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to save house layout.",
            error: err.message,
        });
    }
};

// ================= GET MY MAPS =================
// GET /api/phantom/my
// Role: "user" only
exports.getMyMaps = async (req, res) => {
    try {
        const maps = await PhantomMap.find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .lean();

        res.json({
            success: true,
            data: maps,
            total: maps.length,
        });
    } catch (err) {
        console.error("Get my phantom maps error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch your maps.",
            error: err.message,
        });
    }
};

// ================= GET ACTIVE MAP =================
// GET /api/phantom/active
// Role: "user" only
exports.getActiveMap = async (req, res) => {
    try {
        const map = await PhantomMap.findOne({
            user: req.user.id,
            isActive: true,
        }).lean();

        if (!map) {
            return res.status(404).json({
                success: false,
                message: "No active house layout found. Upload a floor plan first.",
            });
        }

        res.json({
            success: true,
            data: map,
        });
    } catch (err) {
        console.error("Get active phantom map error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch active map.",
            error: err.message,
        });
    }
};

// ================= DELETE MAP =================
// DELETE /api/phantom/:mapId
// Role: "user" (own only)
exports.deletePhantomMap = async (req, res) => {
    try {
        const { mapId } = req.params;

        const map = await PhantomMap.findById(mapId);
        if (!map) {
            return res.status(404).json({
                success: false,
                message: "Map not found.",
            });
        }

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
            }
        }

        await PhantomMap.findByIdAndDelete(mapId);

        // If deleted map was active, make the most recent remaining map active
        if (map.isActive) {
            const latest = await PhantomMap.findOne({ user: req.user.id })
                .sort({ createdAt: -1 });
            if (latest) {
                latest.isActive = true;
                await latest.save();
            }
        }

        res.json({
            success: true,
            message: "House layout deleted.",
        });
    } catch (err) {
        if (err.name === "CastError" && err.kind === "ObjectId") {
            return res.status(400).json({
                success: false,
                message: "Invalid map ID format.",
            });
        }
        console.error("Delete phantom map error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to delete map.",
            error: err.message,
        });
    }
};

// ================= SET ACTIVE MAP =================
// PUT /api/phantom/:mapId/activate
// Role: "user" (own only)
exports.setActiveMap = async (req, res) => {
    try {
        const { mapId } = req.params;

        const map = await PhantomMap.findById(mapId);
        if (!map) {
            return res.status(404).json({
                success: false,
                message: "Map not found.",
            });
        }

        if (map.user.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "Access denied.",
            });
        }

        // Deactivate all, activate this one
        await PhantomMap.updateMany(
            { user: req.user.id, isActive: true },
            { $set: { isActive: false } }
        );
        map.isActive = true;
        await map.save();

        res.json({
            success: true,
            message: "Map set as active house layout.",
            data: map,
        });
    } catch (err) {
        if (err.name === "CastError" && err.kind === "ObjectId") {
            return res.status(400).json({
                success: false,
                message: "Invalid map ID format.",
            });
        }
        console.error("Set active map error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to set active map.",
            error: err.message,
        });
    }
};
