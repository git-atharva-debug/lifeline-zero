const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true
    },

    password: {
      type: String,
      required: true,
      minlength: 6
    },

    phone: {
      type: String,
      default: ""
    },

    role: {
      type: String,
      enum: ["user", "command"],
      default: "user"
    },

    emergencyProfile: {
      bloodGroup: { type: String, default: "" },
      medicalConditions: { type: String, default: "" },
      medications: { type: String, default: "" },
      allergies: { type: String, default: "" },
      emergencyContact: { type: String, default: "" },
      emergencyPhone: { type: String, default: "" },
      relation: { type: String, default: "" },
      address: { type: String, default: "" },
      notes: { type: String, default: "" }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
