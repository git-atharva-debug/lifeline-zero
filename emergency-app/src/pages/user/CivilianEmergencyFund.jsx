import React, { useState, useEffect } from "react";
import axios from "axios";
import { CheckCircle, Heart, Users, Target, Clock, Award } from "lucide-react";

const API = "http://localhost:5000/api/emergency-fund";

const IMPACT_TIERS = [
  { amount: "0.001", inr: "250", label: "Basic Aid Kit", icon: "🧰", desc: "Supplies for 1 person", color: "#3b82f6" },
  { amount: "0.003", inr: "750", label: "Food Package", icon: "🍱", desc: "Feeds a family for a day", color: "#8b5cf6" },
  { amount: "0.005", inr: "1250", label: "Medical Support", icon: "💊", desc: "First aid for 5 people", color: "#ec4899" },
  { amount: "0.01", inr: "2500", label: "Rescue Equipment", icon: "⛑️", desc: "Gear for rescue team", color: "#f97316" },
  { amount: "0.05", inr: "12500", label: "Relief Camp", icon: "🏕️", desc: "Shelter for 10 families", color: "#10b981" },
  { amount: "0.1", inr: "25000", label: "Emergency Vehicle", icon: "🚑", desc: "Transport + crew for a day", color: "#ef4444" },
];

const formatINR = (num) => {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(num);
};

export default function CivilianEmergencyFund() {
  const [formData, setFormData] = useState({
    donorName: "",
    donorEmail: "",
    donorPhone: "",
    amount: "",
    message: "",
    selectedTier: null
  });

  const [fundData, setFundData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [donationResult, setDonationResult] = useState(null);
  const [step, setStep] = useState("form"); // form, processing, success
  const [recentDonations, setRecentDonations] = useState([]);

  // Fetch fund data
  const fetchFundData = async () => {
    try {
      const { data } = await axios.get(`${API}/transactions`);
      if (data.success) {
        setFundData(data);
        setRecentDonations(data.transactions?.slice(0, 5) || []);
      }
    } catch (error) {
      console.error("Error fetching fund data:", error);
    }
  };

  useEffect(() => {
    fetchFundData();
    const interval = setInterval(fetchFundData, 15000);
    return () => clearInterval(interval);
  }, []);

  // Handle tier selection
  const selectTier = (tier) => {
    setFormData({
      ...formData,
      selectedTier: tier,
      amount: tier.amount
    });
  };

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Silent validation - button should be disabled anyway, but good to have
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[6-9]\d{9}$/;

    if (!formData.donorName || !formData.amount || !emailRegex.test(formData.donorEmail) || !phoneRegex.test(formData.donorPhone)) {
      return;
    }

    setStep("processing");
    setLoading(true);

    try {
      const { data } = await axios.post(`${API}/donate`, {
        donorName: formData.donorName,
        donorEmail: formData.donorEmail,
        donorPhone: formData.donorPhone,
        amount: formData.amount,
        message: formData.message
      });

      if (data.success) {
        setDonationResult(data);
        setStep("success");
        fetchFundData();
      }
    } catch (error) {
      console.error("Donation error:", error);
      setStep("form");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep("form");
    setFormData({
      donorName: "",
      donorEmail: "",
      donorPhone: "",
      amount: "",
      message: "",
      selectedTier: null
    });
    setDonationResult(null);
  };

  const totalRaised = fundData?.totalFundINR || 0;
  const goalAmount = fundData?.goalAmountINR || 10000000; // Default 1 Cr
  const progressPercent = (totalRaised / goalAmount) * 100;
  const donorCount = fundData?.donorCount || 0;

  return (
    <div style={styles.container}>
      {/* Hero Section */}
      <div style={styles.hero}>
        <div style={styles.heroContent}>
          <span style={styles.emergencyBadge}>🚨 ACTIVE EMERGENCY • PUNE FLOOD RELIEF</span>
          <h1 style={styles.heroTitle}>
            Every Contribution<br />
            <span style={styles.heroHighlight}>Saves a Life Today</span>
          </h1>
          <p style={styles.heroSubtitle}>
            100% of your donation goes directly to disaster relief.
            Every transaction is permanently recorded on the Ethereum blockchain for complete transparency.
          </p>
        </div>
      </div>

      <div style={styles.mainGrid}>
        {/* Left Column - Fund Status */}
        <div style={styles.leftColumn}>
          {/* Stats Cards */}
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={{ ...styles.statIcon, background: "linear-gradient(135deg, #3b82f6, #2563eb)" }}>
                <Heart size={20} color="white" />
              </div>
              <div style={styles.statContent}>
                <div style={styles.statValue}>₹{formatINR(totalRaised)}</div>
                <div style={styles.statLabel}>Total Raised</div>
              </div>
            </div>

            <div style={styles.statCard}>
              <div style={{ ...styles.statIcon, background: "linear-gradient(135deg, #10b981, #059669)" }}>
                <Target size={20} color="white" />
              </div>
              <div style={styles.statContent}>
                <div style={styles.statValue}>₹{formatINR(goalAmount)}</div>
                <div style={styles.statLabel}>Goal Amount</div>
              </div>
            </div>

            <div style={styles.statCard}>
              <div style={{ ...styles.statIcon, background: "linear-gradient(135deg, #8b5cf6, #7c3aed)" }}>
                <Users size={20} color="white" />
              </div>
              <div style={styles.statContent}>
                <div style={styles.statValue}>{donorCount}</div>
                <div style={styles.statLabel}>Contributors</div>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={styles.progressCard}>
            <div style={styles.progressHeader}>
              <h3 style={styles.cardTitle}>Fund Coverage Progress</h3>
              <span style={styles.progressPercent}>{progressPercent.toFixed(1)}%</span>
            </div>
            <div style={styles.progressBarContainer}>
              <div style={{ ...styles.progressBar, width: `${Math.min(progressPercent, 100)}%` }} />
            </div>
            <div style={styles.progressLabels}>
              <span>₹{formatINR(totalRaised)} raised</span>
              <span>Goal: ₹{formatINR(goalAmount)}</span>
            </div>
          </div>

          {/* Recent Donations */}
          <div style={styles.recentCard}>
            <h3 style={styles.cardTitle}>Recent Contributions</h3>
            <div style={styles.donationList}>
              {recentDonations.map((donation, idx) => (
                <div key={idx} style={styles.donationItem}>
                  <div style={styles.donorAvatar}>
                    {donation.donorName?.[0] || "A"}
                  </div>
                  <div style={styles.donorInfo}>
                    <div style={styles.donorName}>{donation.donorName || "Anonymous"}</div>
                    <div style={styles.donorMessage}>"{donation.message || "Supporting relief"}"</div>
                  </div>
                  <div style={styles.donationAmount}>
                    <div style={styles.amountEth}>{donation.amount} ETH</div>
                    <div style={styles.amountInr}>₹{formatINR(donation.amountINR)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trust Badges */}
          <div style={styles.trustBadges}>
            {[
              { icon: "🔗", text: "Blockchain Secured" },
              { icon: "✅", text: "100% Transparent" },
              { icon: "⚡", text: "Instant Transfer" },
              { icon: "🏛️", text: "Govt. Verified" }
            ].map((badge, idx) => (
              <div key={idx} style={styles.badge}>
                <span style={styles.badgeIcon}>{badge.icon}</span>
                <span style={styles.badgeText}>{badge.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column - Donation Form */}
        <div style={styles.rightColumn}>
          {step === "form" && (
            <div style={styles.formCard}>
              <h2 style={styles.formTitle}>Make a Contribution</h2>
              <p style={styles.formSubtitle}>Choose an impact level or enter custom amount</p>

              <form onSubmit={handleSubmit}>
                {/* Name Input */}
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Your Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Rahul Sharma"
                    value={formData.donorName}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                      setFormData({ ...formData, donorName: val });
                    }}
                    style={styles.input}
                    required
                  />
                </div>

                {/* Email & Phone (Required) */}
                <div style={styles.rowInputs}>
                  <div style={{ ...styles.inputGroup, flex: 1 }}>
                    <label style={styles.label}>Email *</label>
                    <input
                      type="email"
                      placeholder="your@email.com"
                      value={formData.donorEmail}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\s/g, "");
                        setFormData({ ...formData, donorEmail: val });
                      }}
                      style={styles.input}
                      required
                    />
                  </div>
                  <div style={{ ...styles.inputGroup, flex: 1 }}>
                    <label style={styles.label}>Phone *</label>
                    <input
                      type="tel"
                      placeholder="e.g. 9876543210"
                      value={formData.donorPhone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                        setFormData({ ...formData, donorPhone: val });
                      }}
                      style={styles.input}
                      required
                    />
                  </div>
                </div>

                {/* Impact Tiers */}
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Select Impact Level</label>
                  <div style={styles.tierGrid}>
                    {IMPACT_TIERS.map((tier, idx) => (
                      <div
                        key={idx}
                        onClick={() => selectTier(tier)}
                        style={{
                          ...styles.tierCard,
                          border: formData.selectedTier?.amount === tier.amount
                            ? `2px solid ${tier.color}`
                            : "1px solid #e5e7eb",
                          background: formData.selectedTier?.amount === tier.amount
                            ? `${tier.color}10`
                            : "white"
                        }}
                      >
                        <div style={styles.tierIcon}>{tier.icon}</div>
                        <div style={{ ...styles.tierAmount, color: tier.color }}>₹{tier.inr}</div>
                        <div style={styles.tierLabel}>{tier.label}</div>
                        <div style={styles.tierDesc}>{tier.desc}</div>
                        {formData.selectedTier?.amount === tier.amount && (
                          <div style={{ ...styles.tierCheck, background: tier.color }}>
                            ✓
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Custom Amount */}
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Or Enter Custom Amount (ETH)</label>
                  <div style={styles.customAmountWrapper}>
                    <span style={styles.ethPrefix}>ETH</span>
                    <input
                      type="number"
                      placeholder="0.000"
                      min="0.001"
                      step="0.001"
                      value={formData.amount}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          amount: e.target.value,
                          selectedTier: null
                        });
                      }}
                      style={styles.customAmountInput}
                    />
                    {formData.amount && (
                      <span style={styles.inrEstimate}>
                        ≈ ₹{formatINR(parseFloat(formData.amount || 0) * 250000)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Message */}
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Message of Support (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Prayers for everyone in Pune..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    style={styles.input}
                  />
                </div>

                {/* Summary */}
                {formData.amount && parseFloat(formData.amount) > 0 && (
                  <div style={styles.summaryBox}>
                    <span>Your Contribution</span>
                    <span style={styles.summaryAmount}>
                      ₹{formatINR(parseFloat(formData.amount) * 250000)}
                      <span style={styles.summaryEth}>({formData.amount} ETH)</span>
                    </span>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={
                    loading ||
                    !formData.donorName ||
                    !formData.amount ||
                    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.donorEmail || '') ||
                    !/^[6-9]\d{9}$/.test(formData.donorPhone || '')
                  }
                  style={{
                    ...styles.submitButton,
                    opacity: (
                      loading ||
                      !formData.donorName ||
                      !formData.amount ||
                      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.donorEmail || '') ||
                      !/^[6-9]\d{9}$/.test(formData.donorPhone || '')
                    ) ? 0.6 : 1,
                    cursor: (
                      loading ||
                      !formData.donorName ||
                      !formData.amount ||
                      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.donorEmail || '') ||
                      !/^[6-9]\d{9}$/.test(formData.donorPhone || '')
                    ) ? "not-allowed" : "pointer"
                  }}
                >
                  {loading ? "Processing..." : "🤝 Contribute Now"}
                </button>

                <p style={styles.secureNote}>
                  🔒 Your donation is processed securely on the Ethereum blockchain
                </p>
              </form>
            </div>
          )}

          {step === "processing" && (
            <div style={styles.processingCard}>
              <div style={styles.processingAnimation}>
                <div style={styles.spinner} />
              </div>
              <h3 style={styles.processingTitle}>Processing Your Donation</h3>
              <p style={styles.processingText}>
                Please wait while we securely record your contribution on the blockchain...
              </p>
            </div>
          )}

          {step === "success" && donationResult && (
            <div style={styles.successCard}>
              <div style={styles.successIcon}>
                <CheckCircle size={48} color="#10b981" />
              </div>
              <h3 style={styles.successTitle}>Thank You, {donationResult.donorName}!</h3>
              <p style={styles.successText}>
                Your contribution of <strong>₹{formatINR(donationResult.amountINR)}</strong> has been confirmed.
              </p>

              <div style={styles.successDetails}>
                <div style={styles.detailRow}>
                  <span>Transaction Hash:</span>
                  <a
                    href={donationResult.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.txHash}
                  >
                    {donationResult.transactionHash.slice(0, 18)}...
                  </a>
                </div>
                <div style={styles.detailRow}>
                  <span>Amount:</span>
                  <span>{donationResult.amount} ETH (₹{formatINR(donationResult.amountINR)})</span>
                </div>
                <div style={styles.detailRow}>
                  <span>Time:</span>
                  <span>{new Date(donationResult.timestamp).toLocaleString()}</span>
                </div>
              </div>

              <button onClick={resetForm} style={styles.anotherButton}>
                + Make Another Contribution
              </button>

              <p style={styles.permanentRecord}>
                ✅ Permanently recorded on Ethereum blockchain • Fully auditable
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    background: "#f8fafc",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  hero: {
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    padding: "48px 24px",
    color: "white",
  },
  heroContent: {
    maxWidth: 1200,
    margin: "0 auto",
  },
  emergencyBadge: {
    display: "inline-block",
    background: "rgba(239, 68, 68, 0.2)",
    color: "#fecaca",
    padding: "6px 16px",
    borderRadius: 40,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 0.5,
    marginBottom: 20,
    border: "1px solid rgba(239, 68, 68, 0.3)",
  },
  heroTitle: {
    fontSize: 48,
    fontWeight: 800,
    margin: "0 0 16px",
    lineHeight: 1.1,
    color: "#ffffff",
  },
  heroHighlight: {
    color: "#f97316",
    background: "linear-gradient(135deg, #f97316, #ef4444)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  heroSubtitle: {
    fontSize: 18,
    color: "#cbd5e1",
    maxWidth: 600,
    lineHeight: 1.6,
  },
  mainGrid: {
    maxWidth: 1200,
    margin: "-24px auto 48px",
    padding: "0 24px",
    display: "grid",
    gridTemplateColumns: "1fr 380px",
    gap: 24,
  },
  leftColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  rightColumn: {
    position: "sticky",
    top: 24,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 16,
  },
  statCard: {
    background: "white",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
    display: "flex",
    alignItems: "center",
    gap: 14,
    border: "1px solid #eef2f6",
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 700,
    color: "#0f172a",
    lineHeight: 1.2,
  },
  statLabel: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: 500,
  },
  progressCard: {
    background: "white",
    borderRadius: 20,
    padding: 24,
    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
    border: "1px solid #eef2f6",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: "#0f172a",
    margin: 0,
  },
  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  progressPercent: {
    fontSize: 28,
    fontWeight: 700,
    color: "#10b981",
  },
  progressBarContainer: {
    width: "100%",
    height: 10,
    background: "#e2e8f0",
    borderRadius: 10,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    background: "linear-gradient(90deg, #10b981, #34d399)",
    borderRadius: 10,
    transition: "width 0.5s ease",
  },
  progressLabels: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 12,
    color: "#64748b",
    fontSize: 13,
  },
  recentCard: {
    background: "white",
    borderRadius: 20,
    padding: 24,
    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
    border: "1px solid #eef2f6",
  },
  donationList: {
    marginTop: 16,
  },
  donationItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 0",
    borderBottom: "1px solid #f1f5f9",
  },
  donorAvatar: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontWeight: 600,
    fontSize: 16,
  },
  donorInfo: {
    flex: 1,
  },
  donorName: {
    fontWeight: 600,
    color: "#0f172a",
    fontSize: 14,
  },
  donorMessage: {
    color: "#64748b",
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 2,
  },
  donationAmount: {
    textAlign: "right",
  },
  amountEth: {
    fontWeight: 600,
    color: "#0f172a",
    fontSize: 14,
  },
  amountInr: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: 500,
  },
  trustBadges: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
  },
  badge: {
    background: "white",
    border: "1px solid #eef2f6",
    borderRadius: 12,
    padding: "12px 8px",
    textAlign: "center",
  },
  badgeIcon: {
    fontSize: 20,
    display: "block",
    marginBottom: 6,
  },
  badgeText: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: 500,
  },
  formCard: {
    background: "white",
    borderRadius: 24,
    padding: 28,
    boxShadow: "0 12px 24px rgba(0,0,0,0.1)",
    border: "1px solid #eef2f6",
  },
  formTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: "#0f172a",
    margin: "0 0 8px",
  },
  formSubtitle: {
    color: "#64748b",
    fontSize: 14,
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  rowInputs: {
    display: "flex",
    gap: 12,
    marginBottom: 0,
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "#334155",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    width: "100%",
    padding: "12px 16px",
    border: "1.5px solid #e2e8f0",
    borderRadius: 12,
    fontSize: 14,
    outline: "none",
    transition: "border 0.2s",
    fontFamily: "inherit",
  },
  tierGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 10,
  },
  tierCard: {
    borderRadius: 14,
    padding: "16px 8px",
    textAlign: "center",
    cursor: "pointer",
    transition: "all 0.2s",
    position: "relative",
    border: "1px solid #e5e7eb",
  },
  tierIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  tierAmount: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 4,
  },
  tierLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#0f172a",
    marginBottom: 2,
  },
  tierDesc: {
    fontSize: 10,
    color: "#64748b",
  },
  tierCheck: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: "50%",
    color: "white",
    fontSize: 11,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  customAmountWrapper: {
    display: "flex",
    alignItems: "center",
    border: "1.5px solid #e2e8f0",
    borderRadius: 12,
    overflow: "hidden",
  },
  ethPrefix: {
    padding: "0 14px",
    background: "#f1f5f9",
    color: "#475569",
    fontSize: 13,
    fontWeight: 600,
    borderRight: "1.5px solid #e2e8f0",
    height: "46px",
    display: "flex",
    alignItems: "center",
  },
  customAmountInput: {
    flex: 1,
    padding: "12px 14px",
    border: "none",
    outline: "none",
    fontSize: 14,
  },
  inrEstimate: {
    padding: "0 14px",
    color: "#10b981",
    fontSize: 13,
    fontWeight: 600,
  },
  summaryBox: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#f0f9ff",
    border: "1px solid #bae6fd",
    borderRadius: 12,
    padding: "14px 18px",
    marginBottom: 20,
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: 700,
    color: "#0369a1",
  },
  summaryEth: {
    fontSize: 12,
    color: "#64748b",
    marginLeft: 8,
    fontWeight: 400,
  },
  submitButton: {
    width: "100%",
    padding: "16px",
    background: "linear-gradient(135deg, #ef4444, #dc2626)",
    border: "none",
    borderRadius: 14,
    color: "white",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  secureNote: {
    textAlign: "center",
    color: "#64748b",
    fontSize: 12,
    marginTop: 16,
  },
  processingCard: {
    background: "white",
    borderRadius: 24,
    padding: 48,
    textAlign: "center",
    boxShadow: "0 12px 24px rgba(0,0,0,0.1)",
  },
  processingAnimation: {
    marginBottom: 24,
  },
  spinner: {
    width: 60,
    height: 60,
    border: "4px solid #e2e8f0",
    borderTop: "4px solid #ef4444",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    margin: "0 auto",
  },
  processingTitle: {
    fontSize: 20,
    fontWeight: 600,
    color: "#0f172a",
    marginBottom: 12,
  },
  processingText: {
    color: "#64748b",
    fontSize: 14,
  },
  successCard: {
    background: "white",
    borderRadius: 24,
    padding: 36,
    textAlign: "center",
    boxShadow: "0 12px 24px rgba(0,0,0,0.1)",
  },
  successIcon: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 8,
  },
  successText: {
    color: "#64748b",
    fontSize: 16,
    marginBottom: 24,
  },
  successDetails: {
    background: "#f8fafc",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    textAlign: "left",
  },
  detailRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 0",
    borderBottom: "1px solid #e2e8f0",
  },
  txHash: {
    color: "#3b82f6",
    textDecoration: "none",
    fontSize: 13,
    fontFamily: "monospace",
  },
  anotherButton: {
    width: "100%",
    padding: "14px",
    background: "#0f172a",
    border: "none",
    borderRadius: 12,
    color: "white",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    marginBottom: 12,
  },
  permanentRecord: {
    color: "#64748b",
    fontSize: 12,
  },
};