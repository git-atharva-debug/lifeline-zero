// backend/middleware/upload.js
// Rescue.AI — Multer File Upload Middleware

const multer = require("multer");
const path = require("path");

// Allowed image MIME types
const ALLOWED_TYPES = ["image/png", "image/jpg", "image/jpeg", "image/webp"];

// Max file size: 10MB
const MAX_SIZE = 10 * 1024 * 1024;

// Use memory storage (buffer) so we can stream directly to Cloudinary
const storage = multer.memoryStorage();

// File filter — only allow images
const fileFilter = (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        const ext = path.extname(file.originalname);
        cb(
            new Error(
                `Invalid file type "${ext}" (${file.mimetype}). Allowed: PNG, JPG, JPEG, WEBP.`
            ),
            false
        );
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_SIZE,
        files: 1,
    },
});

// Error handler wrapper for multer errors
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                success: false,
                message: "File too large. Maximum size is 10MB.",
            });
        }
        if (err.code === "LIMIT_FILE_COUNT") {
            return res.status(400).json({
                success: false,
                message: "Only 1 file is allowed per upload.",
            });
        }
        return res.status(400).json({
            success: false,
            message: `Upload error: ${err.message}`,
        });
    }
    if (err) {
        return res.status(400).json({
            success: false,
            message: err.message || "File upload failed.",
        });
    }
    next();
};

module.exports = { upload, handleMulterError };
