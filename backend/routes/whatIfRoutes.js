const express = require("express");
const router = express.Router();
const { simulateScenario } = require("../controllers/whatIfController");

router.post("/simulate", simulateScenario);

module.exports = router;
