import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  TrendingUp, Users, Target, DollarSign, CheckCircle, XCircle,
  Clock, Activity, Shield, Zap, Download, Filter, RefreshCw,
  Award, BarChart3, PieChart, Settings, Wallet, Lock, Unlock
} from "lucide-react";

const API = "http://localhost:5000/api/emergency-fund";

const formatINR = (num) => {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(num);
};

const formatETH = (eth) => {
  return parseFloat(eth || 0).toFixed(4);
};

const shortenAddress = (addr) => {
  if (!addr) return "—";
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
};

const getStatusColor = (pct) => {
  if (pct >= 100) return { bg: "#10b981", text: "#047857", light: "#d1fae5", dark: "#064e3b" };
  if (pct >= 75) return { bg: "#3b82f6", text: "#1e40af", light: "#dbeafe", dark: "#1e3a8a" };
  if (pct >= 50) return { bg: "#f59e0b", text: "#b45309", light: "#fef3c7", dark: "#78350f" };
  if (pct >= 25) return { bg: "#f97316", text: "#c2410c", light: "#ffedd5", dark: "#7c2d12" };
  return { bg: "#ef4444", text: "#b91c1c", light: "#fee2e2", dark: "#7f1d1d" };
};

export default function CommandEmergencyFund() {
  const [fundData, setFundData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedTimeframe, setSelectedTimeframe] = useState("7d");
  const [deployModal, setDeployModal] = useState(false);
  const [deployForm, setDeployForm] = useState({ amount: "", purpose: "" });
  const [deployLoading, setDeployLoading] = useState(false);
  const [deployResult, setDeployResult] = useState(null);
  const [settingsModal, setSettingsModal] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ goal: "", context: "" });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [connectedWallet, setConnectedWallet] = useState("0x742d35Cc6634C0532925a3b844Bc454e4438f44e"); // Mock

  // Fetch data
  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const { data } = await axios.get(`${API}/transactions`);
      if (data.success) {
        setFundData(data);
        setSettingsForm({
          goal: data.goalAmount || "",
          context: data.disasterContext || ""
        });
      }
    } catch (error) {
      console.error("Error fetching fund data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Handle deployment
  const handleDeploy = async () => {
    if (!deployForm.amount || !deployForm.purpose) {
      alert("Please fill all fields");
      return;
    }

    if (parseFloat(deployForm.amount) > (fundData?.availableFund || 0)) {
      alert(`Insufficient funds. Available: ${formatETH(fundData?.availableFund)} ETH`);
      return;
    }

    setDeployLoading(true);
    try {
      const { data } = await axios.post(`${API}/deploy`, {
        amountEth: deployForm.amount,
        purpose: deployForm.purpose,
        authorizedBy: connectedWallet
      });

      if (data.success) {
        setDeployResult(data);
        setTimeout(() => setDeployResult(null), 8000);
        setDeployModal(false);
        setDeployForm({ amount: "", purpose: "" });
        fetchData(true);
      }
    } catch (error) {
      console.error("Deployment error:", error);
      alert(error.response?.data?.message || "Deployment failed");
    } finally {
      setDeployLoading(false);
    }
  };

  // Handle settings update
  const handleUpdateSettings = async () => {
    setSettingsLoading(true);
    try {
      if (settingsForm.goal && settingsForm.goal !== fundData?.goalAmount) {
        await axios.post(`${API}/update-goal`, { newGoalEth: settingsForm.goal });
      }
      if (settingsForm.context && settingsForm.context !== fundData?.disasterContext) {
        await axios.post(`${API}/update-context`, { context: settingsForm.context });
      }
      setSettingsModal(false);
      fetchData(true);
    } catch (error) {
      console.error("Settings update error:", error);
      alert("Failed to update settings");
    } finally {
      setSettingsLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={{ color: "#1e293b", fontWeight: 500 }}>Loading blockchain data...</p>
      </div>
    );
  }

  const status = getStatusColor(fundData?.coveragePercent || 0);
  const canDeploy = (fundData?.coveragePercent || 0) >= 75;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.title}>Emergency Fund Command Center</h1>
          <div style={styles.statusBadge}>
            <div style={{ ...styles.statusDot, background: status.bg }} />
            <span style={{ color: status.dark, fontWeight: 600 }}>Coverage: {fundData?.coveragePercent?.toFixed(1)}%</span>
          </div>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.walletInfo}>
            <Wallet size={16} color="#475569" />
            <span style={styles.walletAddress}>{shortenAddress(connectedWallet)}</span>
          </div>
          <button 
            onClick={() => fetchData(true)} 
            style={styles.refreshButton}
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? "spin" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button onClick={() => setSettingsModal(true)} style={styles.settingsButton}>
            <Settings size={16} />
            Settings
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      {canDeploy && (
        <div style={styles.quickActions}>
          <button onClick={() => setDeployModal(true)} style={styles.deployButton}>
            <Zap size={18} />
            Authorize Fund Deployment
          </button>
          <div style={styles.availableFunds}>
            <span style={{ color: "#334155" }}>Available to Deploy:</span>
            <strong style={{ color: "#0f172a" }}>{formatETH(fundData?.availableFund)} ETH</strong>
            <span style={styles.availableInr}>(₹{formatINR(fundData?.availableFundINR)})</span>
          </div>
        </div>
      )}

      {/* Deploy Result Toast */}
      {deployResult && (
        <div style={styles.toast}>
          <CheckCircle size={20} color="#059669" />
          <div style={styles.toastContent}>
            <strong style={{ color: "#065f46" }}>Deployment Authorized</strong>
            <span style={{ color: "#047857" }}>{formatETH(deployResult.amount)} ETH · {deployResult.purpose}</span>
          </div>
          <a href={deployResult.explorerUrl} target="_blank" rel="noopener" style={styles.toastLink}>
            View ↗
          </a>
        </div>
      )}

      {/* Tabs */}
      <div style={styles.tabs}>
        {[
          { id: "overview", label: "Overview", icon: BarChart3 },
          { id: "transactions", label: "Ledger", icon: Activity },
          { id: "deployments", label: "Deployments", icon: Award },
          { id: "analytics", label: "Analytics", icon: PieChart },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.activeTab : {}),
            }}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={styles.tabContent}>
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div style={styles.overview}>
            {/* KPI Cards */}
            <div style={styles.kpiGrid}>
              {[
                { 
                  icon: TrendingUp, 
                  label: "Total Raised", 
                  value: `₹${formatINR(fundData?.totalFundINR)}`,
                  sub: `${formatETH(fundData?.totalFund)} ETH`,
                  color: "#1e40af",
                  bg: "#dbeafe",
                  gradient: "linear-gradient(145deg, #ffffff, #f0f5ff)"
                },
                { 
                  icon: Target, 
                  label: "Goal Amount", 
                  value: `₹${formatINR(fundData?.goalAmountINR)}`,
                  sub: `${formatETH(fundData?.goalAmount)} ETH`,
                  color: "#6d28d9",
                  bg: "#ede9fe",
                  gradient: "linear-gradient(145deg, #ffffff, #f5f0ff)"
                },
                { 
                  icon: DollarSign, 
                  label: "Deployed", 
                  value: `₹${formatINR(fundData?.totalDeployedINR)}`,
                  sub: `${formatETH(fundData?.totalDeployed)} ETH`,
                  color: "#b45309",
                  bg: "#fef3c7",
                  gradient: "linear-gradient(145deg, #ffffff, #fff7e6)"
                },
                { 
                  icon: Users, 
                  label: "Total Donors", 
                  value: fundData?.donorCount || 0,
                  sub: "verified on-chain",
                  color: "#059669",
                  bg: "#d1fae5",
                  gradient: "linear-gradient(145deg, #ffffff, #f0fdf4)"
                },
              ].map((kpi, idx) => (
                <div key={idx} style={{ ...styles.kpiCard, background: kpi.gradient }}>
                  <div style={{ ...styles.kpiIcon, background: kpi.bg, color: kpi.color }}>
                    <kpi.icon size={20} />
                  </div>
                  <div style={styles.kpiContent}>
                    <div style={styles.kpiValue}>{kpi.value}</div>
                    <div style={styles.kpiLabel}>{kpi.label}</div>
                    <div style={styles.kpiSub}>{kpi.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Coverage Chart */}
            <div style={styles.coverageCard}>
              <div style={styles.coverageHeader}>
                <h3 style={{ color: "#0f172a", fontSize: 18, fontWeight: 600, margin: 0 }}>Fund Coverage Status</h3>
                <span style={{ ...styles.coveragePercent, color: status.dark }}>
                  {fundData?.coveragePercent?.toFixed(1)}%
                </span>
              </div>
              <div style={styles.progressContainer}>
                <div 
                  style={{ 
                    ...styles.progressBar, 
                    width: `${Math.min(fundData?.coveragePercent || 0, 100)}%`,
                    background: `linear-gradient(90deg, ${status.bg}, ${status.text})`,
                    boxShadow: `0 2px 8px ${status.bg}80`
                  }} 
                />
              </div>
              <div style={styles.coverageMarkers}>
                {[25, 50, 75, 100].map((mark) => (
                  <div key={mark} style={styles.marker}>
                    <div style={styles.markerLine} />
                    <span style={{ color: "#475569", fontWeight: 500 }}>{mark}%</span>
                  </div>
                ))}
              </div>
              <div style={styles.coverageFooter}>
                <div>
                  <span style={styles.coverageLabel}>Goal:</span>
                  <span style={styles.coverageValue}>{formatETH(fundData?.goalAmount)} ETH</span>
                </div>
                <div>
                  <span style={styles.coverageLabel}>Raised:</span>
                  <span style={styles.coverageValue}>{formatETH(fundData?.totalFund)} ETH</span>
                </div>
                <div>
                  <span style={styles.coverageLabel}>Remaining:</span>
                  <span style={styles.coverageValue}>
                    {formatETH(Math.max(0, (fundData?.goalAmount || 0) - (fundData?.totalFund || 0)))} ETH
                  </span>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div style={styles.recentCard}>
              <h3 style={{ color: "#0f172a", fontSize: 18, fontWeight: 600, margin: 0 }}>Recent Transactions</h3>
              <div style={styles.transactionList}>
                {fundData?.transactions?.slice(0, 5).map((tx, idx) => (
                  <div key={idx} style={styles.transactionItem}>
                    <div style={styles.txAvatar}>
                      {tx.donorName?.[0] || "A"}
                    </div>
                    <div style={styles.txInfo}>
                      <div style={styles.txDonor}>{tx.donorName || "Anonymous"}</div>
                      <div style={styles.txMessage}>"{tx.message || "—"}"</div>
                    </div>
                    <div style={styles.txAmount}>
                      <div style={styles.txEth}>{tx.amount} ETH</div>
                      <div style={styles.txInr}>₹{formatINR(tx.amountINR)}</div>
                    </div>
                    <div style={styles.txTime}>
                      <Clock size={12} color="#64748b" />
                      <span style={{ color: "#475569" }}>{new Date(tx.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Contract Info */}
            <div style={styles.contractCard}>
              <h3 style={{ color: "#0f172a", fontSize: 18, fontWeight: 600, margin: 0 }}>Blockchain Details</h3>
              <div style={styles.contractGrid}>
                <div style={styles.contractItem}>
                  <span style={styles.contractLabel}>Contract Address</span>
                  <a 
                    href={`${fundData?.explorerBase}/address/${fundData?.contractAddress}`}
                    target="_blank"
                    rel="noopener"
                    style={styles.contractValue}
                  >
                    {shortenAddress(fundData?.contractAddress)}
                  </a>
                </div>
                <div style={styles.contractItem}>
                  <span style={styles.contractLabel}>Network</span>
                  <span style={styles.contractValue}>Ethereum Sepolia</span>
                </div>
                <div style={styles.contractItem}>
                  <span style={styles.contractLabel}>Disaster Context</span>
                  <span style={styles.contractValue}>{fundData?.disasterContext || "—"}</span>
                </div>
                <div style={styles.contractItem}>
                  <span style={styles.contractLabel}>Deployment Threshold</span>
                  <span style={styles.contractValue}>75% Coverage Required</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TRANSACTIONS TAB */}
        {activeTab === "transactions" && (
          <div style={styles.transactionsTab}>
            <div style={styles.tabHeader}>
              <h2 style={{ color: "#0f172a", fontSize: 20, fontWeight: 600, margin: 0 }}>Complete Transaction Ledger</h2>
              <div style={styles.tabActions}>
                <button style={styles.filterButton}>
                  <Filter size={14} />
                  Filter
                </button>
                <button style={styles.exportButton}>
                  <Download size={14} />
                  Export
                </button>
              </div>
            </div>
            <div style={styles.tableContainer}>
              <table style={styles.table}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={styles.th}>Donor</th>
                    <th style={styles.th}>Message</th>
                    <th style={styles.th}>Amount (ETH)</th>
                    <th style={styles.th}>Amount (INR)</th>
                    <th style={styles.th}>Timestamp</th>
                    <th style={styles.th}>Explorer</th>
                  </tr>
                </thead>
                <tbody>
                  {fundData?.transactions?.map((tx, idx) => (
                    <tr key={idx} style={styles.tr}>
                      <td style={styles.td}>
                        <div style={styles.tdDonor}>
                          <div style={styles.tdAvatar}>{tx.donorName?.[0] || "A"}</div>
                          <div>
                            <div style={{ color: "#0f172a", fontWeight: 500 }}>{tx.donorName || "Anonymous"}</div>
                            <div style={styles.tdAddress}>{shortenAddress(tx.donor)}</div>
                          </div>
                        </div>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.tdMessage}>"{tx.message || "—"}"</span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.tdEth}>{tx.amount} ETH</span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.tdInr}>₹{formatINR(tx.amountINR)}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.tdTime}>{new Date(tx.timestamp).toLocaleString()}</span>
                      </td>
                      <td style={styles.td}>
                        <a 
                          href={`${fundData?.explorerBase}/address/${tx.donor}`}
                          target="_blank"
                          rel="noopener"
                          style={styles.tdLink}
                        >
                          View ↗
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* DEPLOYMENTS TAB */}
        {activeTab === "deployments" && (
          <div style={styles.deploymentsTab}>
            <div style={styles.tabHeader}>
              <h2 style={{ color: "#0f172a", fontSize: 20, fontWeight: 600, margin: 0 }}>Authorized Fund Deployments</h2>
              {canDeploy && (
                <button onClick={() => setDeployModal(true)} style={styles.newDeployButton}>
                  <Zap size={14} />
                  New Deployment
                </button>
              )}
            </div>
            {!canDeploy && (
              <div style={styles.deployWarning}>
                <Lock size={16} color="#b91c1c" />
                <span style={{ color: "#b91c1c", fontWeight: 500 }}>Deployments require 75% fund coverage. Currently at {fundData?.coveragePercent?.toFixed(1)}%</span>
              </div>
            )}
            <div style={styles.deploymentsGrid}>
              {fundData?.deployments?.map((dep, idx) => (
                <div key={idx} style={styles.deploymentCard}>
                  <div style={styles.deploymentHeader}>
                    <h4 style={{ color: "#78350f", fontSize: 16, fontWeight: 600, margin: 0 }}>{dep.purpose}</h4>
                    <div style={styles.deploymentBadge}>✓ On-Chain</div>
                  </div>
                  <div style={styles.deploymentBody}>
                    <div style={styles.deploymentAmount}>
                      <span style={styles.deploymentEth}>{dep.amount} ETH</span>
                      <span style={styles.deploymentInr}>₹{formatINR(dep.amountINR)}</span>
                    </div>
                    <div style={styles.deploymentMeta}>
                      <div>
                        <span style={styles.metaLabel}>Authorized by:</span>
                        <span style={styles.metaValue}>{shortenAddress(dep.authorizedBy)}</span>
                      </div>
                      <div>
                        <span style={styles.metaLabel}>Timestamp:</span>
                        <span style={styles.metaValue}>{new Date(dep.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {(!fundData?.deployments || fundData.deployments.length === 0) && (
                <div style={styles.emptyState}>
                  <Award size={48} color="#94a3b8" />
                  <h3 style={{ color: "#334155", margin: "16px 0 8px" }}>No Deployments Yet</h3>
                  <p style={{ color: "#64748b" }}>Funds will appear here once authorized for deployment</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === "analytics" && (
          <div style={styles.analyticsTab}>
            <div style={styles.tabHeader}>
              <h2 style={{ color: "#0f172a", fontSize: 20, fontWeight: 600, margin: 0 }}>Fund Analytics</h2>
              <div style={styles.timeframeSelector}>
                {["24h", "7d", "30d", "all"].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setSelectedTimeframe(tf)}
                    style={{
                      ...styles.timeframeButton,
                      ...(selectedTimeframe === tf ? styles.activeTimeframe : {})
                    }}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
            <div style={styles.analyticsGrid}>
              <div style={styles.analyticsCard}>
                <h4 style={{ color: "#0f172a", fontSize: 16, fontWeight: 600, margin: "0 0 16px 0" }}>Donation Distribution</h4>
                <div style={styles.chartPlaceholder}>
                  <PieChart size={120} color="#94a3b8" />
                  <p style={{ color: "#64748b", marginTop: 16 }}>Chart visualization would go here</p>
                </div>
              </div>
              <div style={styles.analyticsCard}>
                <h4 style={{ color: "#0f172a", fontSize: 16, fontWeight: 600, margin: "0 0 16px 0" }}>Donation Trends</h4>
                <div style={styles.statsList}>
                  <div style={styles.statRow}>
                    <span style={{ color: "#475569" }}>Average Donation:</span>
                    <strong style={{ color: "#0f172a" }}>
                      {formatETH((fundData?.totalFund || 0) / (fundData?.donorCount || 1))} ETH
                    </strong>
                  </div>
                  <div style={styles.statRow}>
                    <span style={{ color: "#475569" }}>Largest Donation:</span>
                    <strong style={{ color: "#0f172a" }}>
                      {Math.max(...(fundData?.transactions?.map(t => t.amount) || [0]))} ETH
                    </strong>
                  </div>
                  <div style={styles.statRow}>
                    <span style={{ color: "#475569" }}>Total Transactions:</span>
                    <strong style={{ color: "#0f172a" }}>{fundData?.donorCount || 0}</strong>
                  </div>
                  <div style={styles.statRow}>
                    <span style={{ color: "#475569" }}>Deployment Ratio:</span>
                    <strong style={{ color: "#0f172a" }}>
                      {((fundData?.totalDeployed / (fundData?.totalFund || 1)) * 100).toFixed(1)}%
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DEPLOYMENT MODAL */}
      {deployModal && (
        <div style={styles.modalOverlay} onClick={() => setDeployModal(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: "#0f172a", fontSize: 20, fontWeight: 600, margin: 0 }}>Authorize Fund Deployment</h3>
            <div style={styles.availableInfo}>
              <span style={{ color: "#065f46" }}>Available to Deploy:</span>
              <strong style={{ color: "#047857" }}>{formatETH(fundData?.availableFund)} ETH (₹{formatINR(fundData?.availableFundINR)})</strong>
            </div>
            <div style={styles.modalForm}>
              <div style={styles.modalGroup}>
                <label style={{ color: "#1e293b", fontWeight: 500, fontSize: 14 }}>Amount (ETH)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={deployForm.amount}
                  onChange={e => setDeployForm({ ...deployForm, amount: e.target.value })}
                  style={styles.modalInput}
                />
              </div>
              <div style={styles.modalGroup}>
                <label style={{ color: "#1e293b", fontWeight: 500, fontSize: 14 }}>Purpose / Operation</label>
                <input
                  type="text"
                  placeholder="e.g. Medical supplies for Pune Zone 3"
                  value={deployForm.purpose}
                  onChange={e => setDeployForm({ ...deployForm, purpose: e.target.value })}
                  style={styles.modalInput}
                />
              </div>
              <div style={styles.modalActions}>
                <button onClick={() => setDeployModal(false)} style={styles.modalCancel}>
                  Cancel
                </button>
                <button 
                  onClick={handleDeploy}
                  disabled={deployLoading}
                  style={{
                    ...styles.modalSubmit,
                    opacity: deployLoading ? 0.6 : 1
                  }}
                >
                  {deployLoading ? "Processing..." : "✓ Sign & Authorize"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {settingsModal && (
        <div style={styles.modalOverlay} onClick={() => setSettingsModal(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: "#0f172a", fontSize: 20, fontWeight: 600, margin: 0 }}>Fund Configuration</h3>
            <div style={styles.modalForm}>
              <div style={styles.modalGroup}>
                <label style={{ color: "#1e293b", fontWeight: 500, fontSize: 14 }}>Fund Goal (ETH)</label>
                <input
                  type="number"
                  placeholder="New goal amount"
                  value={settingsForm.goal}
                  onChange={e => setSettingsForm({ ...settingsForm, goal: e.target.value })}
                  style={styles.modalInput}
                />
              </div>
              <div style={styles.modalGroup}>
                <label style={{ color: "#1e293b", fontWeight: 500, fontSize: 14 }}>Disaster Context</label>
                <input
                  type="text"
                  placeholder="e.g. Pune Flood Relief"
                  value={settingsForm.context}
                  onChange={e => setSettingsForm({ ...settingsForm, context: e.target.value })}
                  style={styles.modalInput}
                />
              </div>
              <div style={styles.modalActions}>
                <button onClick={() => setSettingsModal(false)} style={styles.modalCancel}>
                  Cancel
                </button>
                <button 
                  onClick={handleUpdateSettings}
                  disabled={settingsLoading}
                  style={{
                    ...styles.modalSubmit,
                    opacity: settingsLoading ? 0.6 : 1
                  }}
                >
                  {settingsLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        
        * {
          box-sizing: border-box;
        }
        
        input:focus, button:focus {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
        }
        
        button:not(:disabled) {
          transition: all 0.2s ease;
        }
        
        button:not(:disabled):hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        table tr:hover {
          background: #f8fafc;
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    background: "#f8fafc",
    minHeight: "100vh",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    padding: "24px 32px",
    color: "#0f172a",
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    background: "#f8fafc",
  },
  spinner: {
    width: 40,
    height: 40,
    border: "3px solid #e2e8f0",
    borderTop: "3px solid #3b82f6",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    marginBottom: 16,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    flexWrap: "wrap",
    gap: 16,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: "#0f172a",
    margin: 0,
    letterSpacing: "-0.02em",
  },
  statusBadge: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#ffffff",
    padding: "6px 14px",
    borderRadius: 40,
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  walletInfo: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#ffffff",
    padding: "8px 16px",
    borderRadius: 40,
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
  },
  walletAddress: {
    color: "#334155",
    fontSize: 13,
    fontFamily: "monospace",
    fontWeight: 500,
  },
  refreshButton: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    padding: "8px 16px",
    borderRadius: 40,
    fontSize: 13,
    fontWeight: 500,
    color: "#334155",
    cursor: "pointer",
    boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
  },
  settingsButton: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#0f172a",
    border: "none",
    padding: "8px 16px",
    borderRadius: 40,
    fontSize: 13,
    fontWeight: 500,
    color: "white",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(15,23,42,0.2)",
  },
  quickActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "linear-gradient(135deg, #f0f9ff, #e6f7ff)",
    border: "1px solid #bae6fd",
    borderRadius: 16,
    padding: "16px 24px",
    marginBottom: 24,
    boxShadow: "0 4px 12px rgba(59,130,246,0.1)",
  },
  deployButton: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "linear-gradient(135deg, #10b981, #059669)",
    border: "none",
    padding: "10px 20px",
    borderRadius: 12,
    color: "white",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(16,185,129,0.3)",
  },
  availableFunds: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  availableInr: {
    color: "#475569",
    fontSize: 13,
    fontWeight: 500,
  },
  toast: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: 12,
    padding: "12px 20px",
    marginBottom: 20,
    boxShadow: "0 4px 12px rgba(16,185,129,0.1)",
  },
  toastContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  toastLink: {
    color: "#2563eb",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 500,
  },
  tabs: {
    display: "flex",
    gap: 8,
    borderBottom: "1px solid #e2e8f0",
    marginBottom: 24,
  },
  tab: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 20px",
    border: "none",
    background: "none",
    fontSize: 14,
    fontWeight: 500,
    color: "#475569",
    cursor: "pointer",
    borderBottom: "2px solid transparent",
  },
  activeTab: {
    color: "#2563eb",
    borderBottom: "2px solid #2563eb",
    fontWeight: 600,
  },
  tabContent: {
    minHeight: 400,
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 20,
    marginBottom: 24,
  },
  kpiCard: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
  },
  kpiIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  kpiContent: {
    flex: 1,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: 700,
    color: "#0f172a",
  },
  kpiLabel: {
    fontSize: 13,
    color: "#475569",
    marginTop: 2,
    fontWeight: 500,
  },
  kpiSub: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
    fontWeight: 400,
  },
  coverageCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
  },
  coverageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  coveragePercent: {
    fontSize: 32,
    fontWeight: 700,
  },
  progressContainer: {
    width: "100%",
    height: 12,
    background: "#e2e8f0",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBar: {
    height: "100%",
    transition: "width 0.5s ease",
  },
  coverageMarkers: {
    display: "flex",
    justifyContent: "space-between",
    position: "relative",
    marginBottom: 20,
  },
  marker: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    fontSize: 10,
  },
  markerLine: {
    width: 1,
    height: 8,
    background: "#94a3b8",
    marginBottom: 4,
  },
  coverageFooter: {
    display: "flex",
    justifyContent: "space-between",
    paddingTop: 16,
    borderTop: "1px solid #e2e8f0",
  },
  coverageLabel: {
    color: "#475569",
    fontSize: 12,
    marginRight: 8,
    fontWeight: 500,
  },
  coverageValue: {
    fontWeight: 600,
    color: "#0f172a",
  },
  recentCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
  },
  transactionList: {
    marginTop: 16,
  },
  transactionItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 0",
    borderBottom: "1px solid #f1f5f9",
  },
  txAvatar: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #2563eb, #7c3aed)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontWeight: 600,
    fontSize: 14,
    boxShadow: "0 4px 8px rgba(37,99,235,0.2)",
  },
  txInfo: {
    flex: 1,
  },
  txDonor: {
    fontWeight: 600,
    color: "#0f172a",
    fontSize: 14,
  },
  txMessage: {
    color: "#475569",
    fontSize: 12,
    fontStyle: "italic",
  },
  txAmount: {
    textAlign: "right",
  },
  txEth: {
    fontWeight: 600,
    color: "#0f172a",
    fontSize: 14,
  },
  txInr: {
    color: "#059669",
    fontSize: 12,
    fontWeight: 500,
  },
  txTime: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    minWidth: 80,
    fontSize: 11,
  },
  contractCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 24,
    boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
  },
  contractGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 16,
    marginTop: 16,
  },
  contractItem: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  contractLabel: {
    fontSize: 11,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: 600,
  },
  contractValue: {
    fontSize: 14,
    color: "#0f172a",
    fontWeight: 500,
    textDecoration: "none",
  },
  transactionsTab: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 24,
    boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
  },
  tabHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  tabActions: {
    display: "flex",
    gap: 12,
  },
  filterButton: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 16px",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    fontSize: 13,
    color: "#334155",
    cursor: "pointer",
    fontWeight: 500,
  },
  exportButton: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 16px",
    background: "#0f172a",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    color: "white",
    cursor: "pointer",
    fontWeight: 500,
  },
  tableContainer: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "12px 16px",
    color: "#334155",
    fontSize: 13,
    fontWeight: 600,
    borderBottom: "2px solid #e2e8f0",
  },
  td: {
    padding: "12px 16px",
    borderBottom: "1px solid #f1f5f9",
  },
  tr: {
    transition: "background 0.2s",
  },
  tdDonor: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  tdAvatar: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "#e2e8f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 600,
    color: "#0f172a",
  },
  tdAddress: {
    fontSize: 10,
    color: "#64748b",
    fontFamily: "monospace",
  },
  tdMessage: {
    color: "#475569",
    fontSize: 13,
    maxWidth: 200,
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontStyle: "italic",
  },
  tdEth: {
    fontWeight: 600,
    color: "#0f172a",
  },
  tdInr: {
    color: "#059669",
    fontWeight: 500,
  },
  tdTime: {
    color: "#475569",
    fontSize: 12,
  },
  tdLink: {
    color: "#2563eb",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 500,
  },
  deploymentsTab: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 24,
    boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
  },
  newDeployButton: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 16px",
    background: "linear-gradient(135deg, #10b981, #059669)",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    color: "white",
    cursor: "pointer",
    fontWeight: 500,
    boxShadow: "0 4px 12px rgba(16,185,129,0.3)",
  },
  deployWarning: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: 12,
    padding: "12px 16px",
    marginBottom: 20,
  },
  deploymentsGrid: {
    display: "grid",
    gap: 16,
  },
  deploymentCard: {
    background: "linear-gradient(135deg, #fffbeb, #fef3c7)",
    border: "1px solid #fde68a",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 4px 12px rgba(245,158,11,0.1)",
  },
  deploymentHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  deploymentBadge: {
    background: "rgba(245,158,11,0.2)",
    color: "#b45309",
    padding: "4px 12px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
  },
  deploymentBody: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 12,
  },
  deploymentAmount: {
    display: "flex",
    flexDirection: "column",
  },
  deploymentEth: {
    fontSize: 20,
    fontWeight: 700,
    color: "#b45309",
  },
  deploymentInr: {
    fontSize: 13,
    color: "#475569",
    fontWeight: 500,
  },
  deploymentMeta: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  metaLabel: {
    fontSize: 11,
    color: "#64748b",
    marginRight: 8,
    fontWeight: 500,
  },
  metaValue: {
    fontSize: 12,
    color: "#0f172a",
    fontWeight: 500,
  },
  emptyState: {
    textAlign: "center",
    padding: "60px 20px",
  },
  analyticsTab: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 24,
    boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
  },
  timeframeSelector: {
    display: "flex",
    gap: 4,
    background: "#f1f5f9",
    padding: 4,
    borderRadius: 8,
  },
  timeframeButton: {
    padding: "6px 12px",
    border: "none",
    background: "transparent",
    borderRadius: 6,
    fontSize: 12,
    cursor: "pointer",
    color: "#475569",
    fontWeight: 500,
  },
  activeTimeframe: {
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 600,
    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
  },
  analyticsGrid: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: 20,
    marginTop: 20,
  },
  analyticsCard: {
    background: "#f8fafc",
    borderRadius: 16,
    padding: 20,
    border: "1px solid #e2e8f0",
  },
  chartPlaceholder: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 20px",
  },
  statsList: {
    marginTop: 16,
  },
  statRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "12px 0",
    borderBottom: "1px solid #e2e8f0",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(15,23,42,0.6)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    background: "#ffffff",
    borderRadius: 24,
    padding: 32,
    width: "90%",
    maxWidth: 480,
    boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
  },
  availableInfo: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: 12,
    padding: "12px 16px",
    margin: "20px 0",
  },
  modalForm: {
    marginTop: 20,
  },
  modalGroup: {
    marginBottom: 20,
  },
  modalInput: {
    width: "100%",
    padding: "12px 16px",
    border: "1.5px solid #e2e8f0",
    borderRadius: 12,
    fontSize: 14,
    marginTop: 6,
    outline: "none",
    color: "#0f172a",
    background: "#ffffff",
  },
  modalActions: {
    display: "flex",
    gap: 12,
    marginTop: 24,
  },
  modalCancel: {
    flex: 1,
    padding: "12px",
    background: "#ffffff",
    border: "1.5px solid #e2e8f0",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    color: "#475569",
    cursor: "pointer",
  },
  modalSubmit: {
    flex: 2,
    padding: "12px",
    background: "linear-gradient(135deg, #10b981, #059669)",
    border: "none",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    color: "white",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(16,185,129,0.3)",
  },
};