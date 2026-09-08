const Donation = require("../models/Donation");

/**
 * Track donation status and send notifications
 */
class DonationTracker {
  constructor() {
    this.pendingDonations = new Map();
  }

  /**
   * Track a new donation
   */
  async trackDonation(donationData, transactionHash) {
    try {
      // Store in memory for real-time tracking
      this.pendingDonations.set(transactionHash, {
        ...donationData,
        transactionHash,
        status: 'pending',
        timestamp: new Date(),
        confirmations: 0
      });

      // Save to database
      const donation = new Donation({
        ...donationData,
        transactionHash,
        status: 'pending'
      });
      
      await donation.save();
      
      return transactionHash;
    } catch (error) {
      console.error('Error tracking donation:', error);
      throw error;
    }
  }

  /**
   * Update donation status when confirmed
   */
  async confirmDonation(transactionHash, receipt) {
    try {
      // Update memory
      if (this.pendingDonations.has(transactionHash)) {
        this.pendingDonations.set(transactionHash, {
          ...this.pendingDonations.get(transactionHash),
          status: 'confirmed',
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString()
        });
      }

      // Update database
      await Donation.findOneAndUpdate(
        { transactionHash },
        { 
          status: 'confirmed',
          blockNumber: receipt.blockNumber,
          timestamp: new Date()
        }
      );

      return true;
    } catch (error) {
      console.error('Error confirming donation:', error);
      throw error;
    }
  }

  /**
   * Get donation status
   */
  async getDonationStatus(transactionHash) {
    // Check memory first
    if (this.pendingDonations.has(transactionHash)) {
      return this.pendingDonations.get(transactionHash);
    }

    // Check database
    const donation = await Donation.findOne({ transactionHash });
    return donation;
  }

  /**
   * Get all pending donations
   */
  getPendingDonations() {
    return Array.from(this.pendingDonations.values())
      .filter(d => d.status === 'pending');
  }

  /**
   * Get donation statistics
   */
  async getDonationStats() {
    const stats = await Donation.aggregate([
      {
        $group: {
          _id: null,
          totalDonations: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalAmountINR: { $sum: '$amountINR' },
          avgAmount: { $avg: '$amount' },
          maxAmount: { $max: '$amount' },
          uniqueDonors: { $addToSet: '$donorName' }
        }
      }
    ]);

    const pending = this.getPendingDonations().length;

    return {
      ...(stats[0] || {
        totalDonations: 0,
        totalAmount: 0,
        totalAmountINR: 0,
        avgAmount: 0,
        maxAmount: 0,
        uniqueDonors: []
      }),
      pendingTransactions: pending,
      uniqueDonorsCount: stats[0]?.uniqueDonors?.length || 0
    };
  }

  /**
   * Clean up old pending donations (call this periodically)
   */
  cleanupPendingDonations(maxAge = 3600000) { // 1 hour default
    const now = Date.now();
    for (const [hash, donation] of this.pendingDonations.entries()) {
      if (now - donation.timestamp > maxAge) {
        this.pendingDonations.delete(hash);
      }
    }
  }
}

// Export singleton instance
module.exports = new DonationTracker();