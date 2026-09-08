// backend/routes/preparednessRoutes.js
// LifeShield OS — Preparedness Score Routes

const express = require("express");
const router = express.Router();
const { calculate } = require("../controllers/preparednessController");

// Optional: JWT auth middleware
// const { verifyToken } = require("../middleware/auth");

/**
 * POST /api/preparedness/calculate
 *
 * Body (application/json):
 * {
 *   "kitItems":        [true, false, true, true, false, true, true],  // booleans per kit item
 *   "evacRouteSaved":  true,
 *   "familyPlanDone":  false,
 *   "contactsCount":   3,
 *   "drillCount":      1
 * }
 *
 * Response:
 * {
 *   "score":               62,
 *   "survivalProbability": 77,
 *   "riskLevel":           "Moderate",
 *   "riskBadge":           "NEEDS IMPROVEMENT",
 *   "riskColor":           "#ffb800",
 *   "breakdown":           { kit, evac, family, contacts, drill },
 *   "warnings":            ["..."]
 * }
 */
router.post("/calculate", calculate);
// With auth: router.post("/calculate", verifyToken, calculate);

module.exports = router;