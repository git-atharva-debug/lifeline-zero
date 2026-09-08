// backend/config/cloudinary.js
// Rescue.AI — Cloudinary Configuration

const cloudinary = require("cloudinary").v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Verify connection
const verifyCloudinary = async () => {
    try {
        if (
            !process.env.CLOUDINARY_CLOUD_NAME ||
            !process.env.CLOUDINARY_API_KEY ||
            !process.env.CLOUDINARY_API_SECRET
        ) {
            console.warn("⚠️  Cloudinary env vars missing — map uploads will fail");
            return false;
        }
        console.log("✅ Cloudinary configured");
        return true;
    } catch (err) {
        console.error("❌ Cloudinary config error:", err.message);
        return false;
    }
};

module.exports = { cloudinary, verifyCloudinary };
