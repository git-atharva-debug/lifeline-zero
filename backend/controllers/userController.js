// backend/controllers/userController.js
// Rescue.AI — Emergency Profile Controller

const User = require("../models/User");

// ================= UPDATE EMERGENCY PROFILE =================
// PUT /api/users/profile/emergency
exports.updateEmergencyProfile = async (req, res) => {
    try {
        const {
            bloodGroup,
            medicalConditions,
            medications,
            allergies,
            emergencyContact,
            emergencyPhone,
            relation,
            address,
            notes
        } = req.body;

        // Validate required fields
        if (!emergencyContact || !emergencyContact.trim()) {
            return res.status(400).json({
                success: false,
                message: "Emergency contact name is required."
            });
        }

        if (!emergencyPhone || !emergencyPhone.trim()) {
            return res.status(400).json({
                success: false,
                message: "Emergency contact phone is required."
            });
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            {
                $set: {
                    "emergencyProfile.bloodGroup": bloodGroup || "",
                    "emergencyProfile.medicalConditions": medicalConditions || "",
                    "emergencyProfile.medications": medications || "",
                    "emergencyProfile.allergies": allergies || "",
                    "emergencyProfile.emergencyContact": emergencyContact.trim(),
                    "emergencyProfile.emergencyPhone": emergencyPhone.trim(),
                    "emergencyProfile.relation": relation || "",
                    "emergencyProfile.address": address || "",
                    "emergencyProfile.notes": notes || ""
                }
            },
            { new: true, runValidators: true }
        ).select("-password");

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        res.status(200).json({
            success: true,
            message: "Emergency profile updated successfully.",
            data: updatedUser.emergencyProfile
        });
    } catch (err) {
        console.error("Update emergency profile error:", err);
        res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: err.message
        });
    }
};

// ================= GET EMERGENCY PROFILE =================
// GET /api/users/profile/emergency
exports.getEmergencyProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("emergencyProfile");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        res.status(200).json({
            success: true,
            data: user.emergencyProfile || {}
        });
    } catch (err) {
        console.error("Get emergency profile error:", err);
        res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: err.message
        });
    }
};
