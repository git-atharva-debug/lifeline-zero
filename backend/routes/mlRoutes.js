const express = require("express");
const router = express.Router();

// The Python ML service runs on port 5001
const ML_SERVICE_URL = "http://localhost:5001/api/predict-hotspots";

router.post("/hotspots", async (req, res) => {
    try {
        const { grids, weather, time } = req.body;
        
        if (!grids || !Array.isArray(grids)) {
            return res.status(400).json({ success: false, error: "grids array required" });
        }

        // Call the Python Microservice
        const response = await fetch(ML_SERVICE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ grids, weather, time })
        });
        
        if (!response.ok) {
            throw new Error(`Python API returned ${response.status}`);
        }

        const data = await response.json();
        res.status(200).json(data);

    } catch (error) {
        console.error("ML Service Error:", error.message);
        res.status(500).json({ success: false, error: "Failed to connect to ML prediction service" });
    }
});

module.exports = router;
