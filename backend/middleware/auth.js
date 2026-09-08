// backend/middleware/auth.js
// Rescue.AI — JWT Authentication & Role-Based Authorization

const jwt = require("jsonwebtoken");

// ================= VERIFY JWT TOKEN =================
const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided."
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired. Please login again."
      });
    }
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token."
      });
    }
    return res.status(500).json({
      success: false,
      message: "Authentication error.",
      error: err.message
    });
  }
};

// ================= ROLE-BASED AUTHORIZATION =================
// Usage: authorizeRoles("user") or authorizeRoles("command") or authorizeRoles("user", "command")
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${roles.join(", ")}. Your role: ${req.user.role}`
      });
    }

    next();
  };
};

module.exports = { verifyToken, authorizeRoles };
