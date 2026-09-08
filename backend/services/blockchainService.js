const { ethers } = require("ethers");
const { getServerContract, getReadOnlyContract, CONTRACT_ADDRESS, EXPLORER_URL } = require("../config/blockchain");
const Donation = require("../models/Donation");

// ETH to INR conversion (you can fetch live rates)
const ETH_TO_INR = 250000;

const toINR = (eth) => Math.round(parseFloat(eth || 0) * ETH_TO_INR);

/**
 * Process a donation through the server wallet
 * @param {Object} donationData - { donorName, amount, message, donorEmail, donorPhone }
 * @returns {Promise<Object>} - Transaction receipt
 */
exports.processDonation = async (donationData) => {
  try {
    const { donorName, amount, message = "", donorEmail, donorPhone } = donationData;
    
    // Validate amount
    if (!amount || parseFloat(amount) <= 0) {
      throw new Error("Invalid donation amount");
    }
    
    // Get server contract (server wallet will send the transaction)
    const contract = getServerContract();
    
    // Prepare donation message with donor name
    const donationMessage = `${donorName} — ${message || "Supporting disaster relief"}`;
    
    // Send transaction from server wallet
    const tx = await contract.donate(donationMessage, {
      value: ethers.parseEther(amount.toString())
    });
    
    // Wait for confirmation
    const receipt = await tx.wait();
    
    // Save to database
    const donation = new Donation({
      donorName,
      donorEmail,
      donorPhone,
      amount: parseFloat(amount),
      amountINR: toINR(amount),
      message: donationMessage,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      timestamp: new Date(),
      donorAddress: receipt.from,
    });
    
    await donation.save();
    
    return {
      success: true,
      transactionHash: receipt.hash,
      explorerUrl: `${EXPLORER_URL}/tx/${receipt.hash}`,
      amount,
      amountINR: toINR(amount),
      donorName,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error("Blockchain donation error:", error);
    throw error;
  }
};

/**
 * Fetch all donations from blockchain and sync with DB
 */
exports.syncDonationsWithBlockchain = async () => {
  try {
    const contract = getReadOnlyContract();
    
    // Get all donations from blockchain
    const donationsRaw = await contract.getAllDonations();
    
    // Get existing transaction hashes from DB
    const existingHashes = await Donation.find().distinct("transactionHash");
    
    const newDonations = [];
    
    // Process each blockchain donation
    for (const donation of donationsRaw) {
      // In a real contract, you'd get tx hash from events
      // For now, create a placeholder hash
      const txHash = `0x${donation.timestamp.toString(16)}${Math.random().toString(16).substring(2, 10)}`;
      
      // Check if already in DB
      if (!existingHashes.includes(txHash)) {
        // Parse donor name from message (format: "Name — message")
        const messageParts = donation.message.split(" — ");
        const donorName = messageParts[0] || "Anonymous";
        const cleanMessage = messageParts[1] || donation.message;
        
        newDonations.push({
          donorName,
          amount: parseFloat(ethers.formatEther(donation.amount)),
          amountINR: toINR(ethers.formatEther(donation.amount)),
          message: donation.message,
          transactionHash: txHash,
          blockNumber: null,
          timestamp: new Date(Number(donation.timestamp) * 1000),
          donorAddress: donation.donor,
        });
      }
    }
    
    // Save new donations to DB
    if (newDonations.length > 0) {
      await Donation.insertMany(newDonations);
    }
    
    return newDonations.length;
    
  } catch (error) {
    console.error("Sync error:", error);
    throw error;
  }
};

/**
 * Authorize fund deployment (for command center)
 */
exports.authorizeDeployment = async (amountEth, purpose, authorizedBy) => {
  try {
    const contract = getServerContract();
    
    const tx = await contract.authorizeDeployment(
      ethers.parseEther(amountEth.toString()),
      purpose
    );
    
    const receipt = await tx.wait();
    
    return {
      success: true,
      transactionHash: receipt.hash,
      explorerUrl: `${EXPLORER_URL}/tx/${receipt.hash}`,
      amount: amountEth,
      purpose,
      authorizedBy,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error("Deployment authorization error:", error);
    throw error;
  }
};

/**
 * Update fund goal
 */
exports.updateGoal = async (newGoalEth) => {
  try {
    const contract = getServerContract();
    const tx = await contract.updateGoal(ethers.parseEther(newGoalEth.toString()));
    const receipt = await tx.wait();
    return { success: true, hash: receipt.hash };
  } catch (error) {
    console.error("Update goal error:", error);
    throw error;
  }
};

/**
 * Update disaster context
 */
exports.updateContext = async (context) => {
  try {
    const contract = getServerContract();
    const tx = await contract.updateContext(context);
    const receipt = await tx.wait();
    return { success: true, hash: receipt.hash };
  } catch (error) {
    console.error("Update context error:", error);
    throw error;
  }
};