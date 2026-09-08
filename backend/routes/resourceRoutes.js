// backend/routes/resourceRoutes.js
const express = require("express");
const router = express.Router();
const { verifyToken, authorizeRoles } = require("../middleware/auth");
const {
    getAllResources,
    addResource,
    removeResourceByType,
    updateResource
} = require("../controllers/resourceController");

router.get("/", verifyToken, authorizeRoles("command"), getAllResources);
router.post("/add", verifyToken, authorizeRoles("command"), addResource);
router.delete("/remove/:type", verifyToken, authorizeRoles("command"), removeResourceByType);
router.patch("/:id", verifyToken, authorizeRoles("command"), updateResource);

module.exports = router;
