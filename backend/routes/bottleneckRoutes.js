// backend/routes/bottleneckRoutes.js
// Evacuation Bottleneck Prediction System — API Routes

const express = require('express');
const router = express.Router();
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const { simulateCommandMode } = require('../controllers/bottleneckCommandController');
const { simulateCivilianMode } = require('../controllers/bottleneckCivilianController');

// ==================== COMMAND MODE ====================
/**
 * POST /api/bottleneck/command
 * Authority/Command staff evacuation bottleneck simulation
 * Requires authentication and 'command' role
 */
router.post('/command', verifyToken, authorizeRoles('command'), simulateCommandMode);

// ==================== CIVILIAN MODE ====================
/**
 * POST /api/bottleneck/civilian
 * Citizen evacuation route recommendation and analysis
 * Requires authentication
 */
router.post('/civilian', verifyToken, simulateCivilianMode);

module.exports = router;

