const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/emergencyFundController");

// Public routes
router.get("/transactions",   ctrl.getTransactions);      // All fund data from chain
router.get("/contract-info",  ctrl.getContractInfo);      // Contract address + network
router.post("/donate",        ctrl.processDonation);      // Process donation (no MetaMask needed)
router.get("/history",        ctrl.getDonationHistory);   // Donation history from DB

// Command-only routes (protected in your actual app)
router.post("/deploy",        ctrl.authorizeDeployment);  // Authorize fund deployment
router.post("/update-goal",   ctrl.updateGoal);           // Update fundraising goal
router.post("/update-context", ctrl.updateContext);       // Update disaster context
router.post("/sync",          ctrl.syncBlockchain);       // Sync blockchain with DB

module.exports = router;