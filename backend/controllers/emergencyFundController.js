const { getReadOnlyContract, CONTRACT_ADDRESS, EXPLORER_URL } = require("../config/blockchain");
const blockchainService = require("../services/blockchainService");
const Donation = require("../models/Donation");
const { ethers } = require("ethers");


// ── Get all fund data from chain + database ──────────────────────────────
exports.getTransactions = async (req, res) => {
  try {
    const contract = getReadOnlyContract();

    const [
      totalDonatedWei,
      goalAmountWei,
      coveragePct,
      balanceWei,
      donationsRaw,
      deploymentsRaw,
      context,
    ] = await Promise.all([
      contract.totalDonated(),
      contract.goalAmount(),
      contract.coveragePercent(),
      contract.getBalance(),
      contract.getAllDonations(),
      contract.getAllDeployments(),
      contract.disasterContext(),
    ]);

    const totalFund = parseFloat(ethers.formatEther(totalDonatedWei));
    const goalAmount = parseFloat(ethers.formatEther(goalAmountWei));
    const availableFund = parseFloat(ethers.formatEther(balanceWei));
    const totalDeployed = totalFund - availableFund;

    // Get donations from database (with names)
    const dbDonations = await Donation.find().sort({ timestamp: -1 }).limit(100);

    // Create a map of transaction hashes to donor names
    const donorNameMap = {};
    dbDonations.forEach(d => {
      // In a real scenario, you'd match by transaction hash
      // For now, we'll match by approximate timestamp and amount
      donorNameMap[`${d.amount}_${d.timestamp.getTime()}`] = d.donorName;
    });

    // Map blockchain donations with donor names from DB
    const transactions = donationsRaw
      .map((d) => {
        const amount = parseFloat(ethers.formatEther(d.amount));
        const timestamp = Number(d.timestamp) * 1000;

        // Try to find matching donor name
        let donorName = "Anonymous";
        for (const [key, name] of Object.entries(donorNameMap)) {
          if (key.startsWith(amount.toString())) {
            donorName = name;
            break;
          }
        }

        return {
          donor: d.donor,
          donorName,
          amount,
          amountINR: Math.round(amount * 250000),
          timestamp: new Date(timestamp).toISOString(),
          message: d.message,
          // We don't have transaction hash in this view function
          // In a real contract, you'd emit events to capture hashes
        };
      })
      .reverse();

    const deployments = deploymentsRaw.map((d) => ({
      amount: parseFloat(ethers.formatEther(d.amount)),
      amountINR: Math.round(parseFloat(ethers.formatEther(d.amount)) * 250000),
      purpose: d.purpose,
      timestamp: new Date(Number(d.timestamp) * 1000).toISOString(),
      authorizedBy: d.authorizedBy,
    }));

    res.json({
      success: true,
      totalFund,
      totalFundINR: Math.round(totalFund * 250000),
      goalAmount,
      goalAmountINR: Math.round(goalAmount * 250000),
      availableFund,
      availableFundINR: Math.round(availableFund * 250000),
      totalDeployed,
      totalDeployedINR: Math.round(totalDeployed * 250000),
      coveragePercent: Number(coveragePct),
      disasterContext: context,
      contractAddress: CONTRACT_ADDRESS,
      explorerBase: EXPLORER_URL,
      transactions,
      deployments,
      donorCount: transactions.length,
    });
  } catch (err) {
    console.error("Blockchain read error:", err);
    res.status(500).json({ success: false, message: "Failed to read from blockchain" });
  }
};

// ── Process donation (backend handles blockchain) ───────────────────────
exports.processDonation = async (req, res) => {
  try {
    const { donorName, amount, message, donorEmail, donorPhone } = req.body;

    if (!donorName || !amount || !donorEmail || !donorPhone) {
      return res.status(400).json({
        success: false,
        message: "Name, email, phone and amount are required"
      });
    }

    // Basic format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(donorEmail)) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }

    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(donorPhone)) {
      return res.status(400).json({ success: false, message: "Invalid 10-digit phone number" });
    }

    // Process donation through blockchain service
    const result = await blockchainService.processDonation({
      donorName,
      amount,
      message,
      donorEmail,
      donorPhone
    });

    res.json({
      success: true,
      ...result
    });

  } catch (err) {
    console.error("Donation processing error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to process donation"
    });
  }
};

// ── Authorize deployment (command only) ─────────────────────────────────
exports.authorizeDeployment = async (req, res) => {
  try {
    const { amountEth, purpose, authorizedBy } = req.body;

    if (!amountEth || !purpose) {
      return res.status(400).json({
        success: false,
        message: "Amount and purpose are required"
      });
    }

    const result = await blockchainService.authorizeDeployment(
      amountEth,
      purpose,
      authorizedBy || "Command Center"
    );

    res.json(result);

  } catch (err) {
    console.error("Deployment error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to authorize deployment"
    });
  }
};

// ── Get donation history from DB ────────────────────────────────────────
exports.getDonationHistory = async (req, res) => {
  try {
    const donations = await Donation.find()
      .sort({ timestamp: -1 })
      .limit(req.query.limit || 100);

    res.json({
      success: true,
      donations: donations.map(d => ({
        id: d._id,
        donorName: d.donorName,
        amount: d.amount,
        amountINR: d.amountINR,
        message: d.message,
        transactionHash: d.transactionHash,
        explorerUrl: `${EXPLORER_URL}/tx/${d.transactionHash}`,
        timestamp: d.timestamp,
        status: d.status
      }))
    });
  } catch (err) {
    console.error("DB fetch error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch donation history" });
  }
};

// ── Sync blockchain with DB (admin endpoint) ────────────────────────────
exports.syncBlockchain = async (req, res) => {
  try {
    const count = await blockchainService.syncDonationsWithBlockchain();
    res.json({ success: true, synced: count });
  } catch (err) {
    console.error("Sync error:", err);
    res.status(500).json({ success: false, message: "Sync failed" });
  }
};

// ── Update goal ─────────────────────────────────────────────────────────
exports.updateGoal = async (req, res) => {
  try {
    const { newGoalEth } = req.body;
    const result = await blockchainService.updateGoal(newGoalEth);
    res.json(result);
  } catch (err) {
    console.error("Update goal error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Update context ──────────────────────────────────────────────────────
exports.updateContext = async (req, res) => {
  try {
    const { context } = req.body;
    const result = await blockchainService.updateContext(context);
    res.json(result);
  } catch (err) {
    console.error("Update context error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Contract info ───────────────────────────────────────────────────────
exports.getContractInfo = (req, res) => {
  res.json({
    success: true,
    contractAddress: CONTRACT_ADDRESS,
    network: "Sepolia Testnet",
    explorerBase: EXPLORER_URL,
  });
};