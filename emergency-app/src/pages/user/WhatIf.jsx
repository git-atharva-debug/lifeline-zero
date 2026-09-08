import React, { useState, useEffect } from "react";
import "./WhatIf.css";

const WhatIf = () => {
  const [disasterType, setDisasterType] = useState("earthquake");
  const [impact, setimpact] = useState(6);
  const [timeOfDay, setTimeOfDay] = useState("Day");
  const [populationDensity, setPopulationDensity] = useState("medium");
  const [preparednessScore, setPreparednessScore] = useState(60);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [animatedSurvival, setAnimatedSurvival] = useState(0);
  const [activeTab, setActiveTab] = useState("metrics");

  const disasters = [
    { id: "earthquake", label: "Earthquake", color: "#f59e0b" },
    { id: "flood", label: "Flood", color: "#06b6d4" },
    { id: "heatwave", label: "Heatwave", color: "#ef4444" },
    { id: "fire", label: "Wildfire", color: "#f97316" },
  ];

  const selectedDisaster = disasters.find((d) => d.id === disasterType);

  useEffect(() => {
    if (result) {
      setAnimatedSurvival(0);
      const sim = result.simulation || result;
      const target = sim.survivalProbability;
      const duration = 1500;
      const step = target / (duration / 16);
      let current = 0;
      const timer = setInterval(() => {
        current = Math.min(current + step, target);
        setAnimatedSurvival(Math.round(current));
        if (current >= target) clearInterval(timer);
      }, 16);
      return () => clearInterval(timer);
    }
  }, [result]);

  const handleSimulate = async () => {
    setLoading(true);
    setResult(null);
    setActiveTab("metrics");
    try {
      const response = await fetch("http://localhost:5000/api/whatif/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disasterType, imapct: impact, timeOfDay, preparednessScore, populationDensity }),
      });
      const data = await response.json();
      if (data.success) {
        setResult(data);
      } else {
        console.error("API error:", data.message);
        setResult(null);
      }
    } catch (error) {
      console.error("Simulation error:", error);
      setResult(null);
    }
    setLoading(false);
  };

  const getSurvivalColor = (val) => {
    if (val >= 75) return "#10b981";
    if (val >= 50) return "#f59e0b";
    if (val >= 25) return "#f97316";
    return "#ef4444";
  };

  const getImpactColor = (level) => {
    const colors = {
      Low: { bg: "#f0fdf4", text: "#166534", border: "#86efac" },
      Moderate: { bg: "#fefce8", text: "#854d0e", border: "#fde047" },
      High: { bg: "#fff7ed", text: "#9a3412", border: "#fdba74" },
      Critical: { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" },
    };
    return colors[level] || colors.Low;
  };

  return (
    <div className="whatif-container">
      <div className="bg-gradient-animated">
        <div className="gradient-blob blob-1"></div>
        <div className="gradient-blob blob-2"></div>
        <div className="gradient-blob blob-3"></div>
      </div>

      <div className="whatif-content">
        <div className="whatif-header">
          <div className="header-badge">
            <span className="pulse-dot"></span>
            AI-Powered Simulation
          </div>
          <h1>
            <span>What</span>
            <span className="gradient-text"> If</span>
            <span> Scenarios</span>
          </h1>
          <p>Configure disaster parameters and let our AI engine calculate your survival probability in real-time.</p>
        </div>

        <div className="whatif-grid">
          {/* LEFT - Controls */}
          <div className="control-panel">
            {/* Disaster Type */}
            <div className="control-section">
              <p className="section-label">Disaster Type</p>
              <div className="disaster-grid">
                {disasters.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDisasterType(d.id)}
                    className={`disaster-btn ${disasterType === d.id ? 'active' : ''}`}
                    style={{
                      borderColor: disasterType === d.id ? d.color : "#e2e8f0",
                      background: disasterType === d.id ? `${d.color}10` : "#ffffff",
                      color: disasterType === d.id ? d.color : "#64748b",
                    }}
                  >
                    <span className="disaster-label">{d.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* impact */}
            <div className="control-section">
              <div className="slider-container">
                <p className="section-label" style={{ margin: 0 }}>Impact Severity</p>
                <span className="slider-value" style={{ color: selectedDisaster?.color || "#0f172a" }}>{impact}/10</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={impact}
                onChange={(e) => setimpact(Number(e.target.value))}
                className="slider"
                style={{ background: `linear-gradient(90deg, ${selectedDisaster?.color || '#3b82f6'} 0%, ${selectedDisaster?.color || '#3b82f6'} ${(impact - 1) / 9 * 100}%, #e2e8f0 ${(impact - 1) / 9 * 100}%, #e2e8f0 100%)` }}
              />
              <div className="slider-labels">
                <span>Minor</span>
                <span>Moderate</span>
                <span>Severe</span>
                <span>Catastrophic</span>
              </div>
            </div>

            {/* Time of Day */}
            <div className="control-section">
              <p className="section-label">Time of Day</p>
              <div className="btn-group">
                {[{ val: "Day", label: "Day" }, { val: "3AM", label: "Night" }].map((t) => (
                  <button
                    key={t.val}
                    onClick={() => setTimeOfDay(t.val)}
                    className={`btn-toggle ${timeOfDay === t.val ? 'active' : ''}`}
                  >
                    <span className="btn-label">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Population Density */}
            <div className="control-section">
              <p className="section-label">Population Density</p>
              <div className="btn-group">
                {[{ val: "low", label: "Sparse" }, { val: "medium", label: "Urban" }, { val: "high", label: "Dense" }].map((d) => (
                  <button
                    key={d.val}
                    onClick={() => setPopulationDensity(d.val)}
                    className={`btn-toggle ${populationDensity === d.val ? 'active' : ''}`}
                  >
                    <span className="btn-label">{d.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Preparedness */}
            <div className="control-section">
              <div className="slider-container">
                <p className="section-label" style={{ margin: 0 }}>Preparedness Level</p>
                <span className="slider-value" style={{ color: preparednessScore >= 70 ? "#10b981" : preparednessScore >= 40 ? "#f59e0b" : "#ef4444" }}>
                  {preparednessScore}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={preparednessScore}
                onChange={(e) => setPreparednessScore(Number(e.target.value))}
                className="slider"
                style={{
                  background: `linear-gradient(90deg, ${preparednessScore >= 70 ? "#10b981" : preparednessScore >= 40 ? "#f59e0b" : "#ef4444"} 0%, ${preparednessScore >= 70 ? "#10b981" : preparednessScore >= 40 ? "#f59e0b" : "#ef4444"} ${preparednessScore}%, #e2e8f0 ${preparednessScore}%, #e2e8f0 100%)`,
                }}
              />
              <div className="slider-labels">
                <span>Not Ready</span>
                <span>Partially</span>
                <span>Prepared</span>
                <span>Fully Ready</span>
              </div>
            </div>

            {/* Simulate Button */}
            <button onClick={handleSimulate} disabled={loading} className="simulate-btn">
              {loading ? (
                <>
                  <span className="spinner"></span> Analyzing...
                </>
              ) : (
                <>Run Simulation</>
              )}
            </button>
          </div>

          {/* RIGHT - Results */}
          <div className="results-panel">
            {!result && !loading && (
              <div className="empty-state">
                <div className="empty-icon">📊</div>
                <h3 className="empty-title">Configure & Simulate</h3>
                <p className="empty-text">Adjust parameters on the left and run a simulation to see your AI-powered survival analysis.</p>
              </div>
            )}

            {loading && (
              <div className="loading-state">
                <div className="loading-spinner">
                  <div className="spinner-ring spinner-ring-1"></div>
                  <div className="spinner-ring spinner-ring-2"></div>
                </div>
                <h3 className="loading-title">Processing...</h3>
                <p className="loading-text">Running AI probability calculations</p>
              </div>
            )}

            {result && (
              <div className="results-content">
                {/* Tab Navigation */}
                <div className="tab-nav">
                  <button
                    onClick={() => setActiveTab("metrics")}
                    className={`tab-btn ${activeTab === "metrics" ? 'active' : ''}`}
                  >
                    Impact Metrics
                  </button>
                  {result.aiReport && (
                    <button
                      onClick={() => setActiveTab("ai")}
                      className={`tab-btn ${activeTab === "ai" ? 'active' : ''}`}
                    >
                      AI Analysis
                    </button>
                  )}
                </div>

                {activeTab === "metrics" && (
                  <>
                    {/* Hero Card */}
                    <div className="hero-card">
                      <div className="survival-circle" style={{ borderColor: getSurvivalColor(result.simulation.survivalProbability) }}>
                        <div className="survival-percent" style={{ color: getSurvivalColor(result.simulation.survivalProbability) }}>{animatedSurvival}%</div>
                        <div className="survival-label">Survival Rate</div>
                      </div>
                      <div className="hero-content">
                        <div className="hero-header">
                          <span className="impact-badge" style={getImpactColor(result.simulation.impactLevel)}>
                            {result.simulation.impactLevel} Impact
                          </span>
                          <span className="disaster-tag">{selectedDisaster?.label}</span>
                        </div>
                        <h2 className="hero-title" style={{ color: getSurvivalColor(result.simulation.survivalProbability) }}>
                          {animatedSurvival >= 75 ? "High Survival Probability" : 
                           animatedSurvival >= 50 ? "Moderate Survival Odds" : 
                           animatedSurvival >= 25 ? "High Risk Scenario" : "Critical Danger Zone"}
                        </h2>
                        <p className="hero-subtitle">AI-powered Monte Carlo simulation analysis</p>
                        <div className="stats-grid">
                          <div className="stat-item">
                            <div className="stat-label">Fatality Risk</div>
                            <div className="stat-value" style={{ color: "#ef4444" }}>{result.simulation.fatalityRisk}%</div>
                          </div>
                          <div className="stat-item">
                            <div className="stat-label">Preparedness</div>
                            <div className="stat-value" style={{ color: preparednessScore >= 70 ? "#10b981" : preparednessScore >= 40 ? "#f59e0b" : "#ef4444" }}>
                              {preparednessScore}%
                            </div>
                          </div>
                          <div className="stat-item">
                            <div className="stat-label">Impact Level</div>
                            <div className="stat-value">{impact}/10</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="metrics-card">
                      <h3 className="metrics-title">Multi-Layer Impact Analysis</h3>
                      <div className="metrics-grid">
                        {/* Structural Damage */}
                        <div className="metric-item">
                          <div className="metric-header">
                            <span className="metric-label">Infrastructure Damage</span>
                            <span className="metric-value">{result.simulation.structuralDamagePercent}%</span>
                          </div>
                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${Math.min(result.simulation.structuralDamagePercent, 100)}%`, background: "linear-gradient(90deg, #f97316, #f59e0b)" }}></div>
                          </div>
                        </div>

                        {/* Hospital Overload */}
                        <div className="metric-item">
                          <div className="metric-header">
                            <span className="metric-label">Hospital Capacity Load</span>
                            <span className="metric-value">{result.simulation.hospitalCapacityLoadPercent}%</span>
                          </div>
                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${Math.min(result.simulation.hospitalCapacityLoadPercent, 100)}%`, background: result.simulation.hospitalCapacityLoadPercent > 130 ? "linear-gradient(90deg, #ef4444, #dc2626)" : "linear-gradient(90deg, #f59e0b, #ef4444)" }}></div>
                          </div>
                          {result.simulation.hospitalCapacityLoadPercent > 130 && (
                            <div className="warning-text">Critical Overload</div>
                          )}
                        </div>

                        {/* Communication */}
                        <div className="metric-item">
                          <div className="metric-header">
                            <span className="metric-label">Communication Failure Risk</span>
                            <span className="metric-value">{result.simulation.communicationFailureRiskPercent}%</span>
                          </div>
                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${result.simulation.communicationFailureRiskPercent}%`, background: "linear-gradient(90deg, #06b6d4, #0891b2)" }}></div>
                          </div>
                        </div>

                        {/* Evacuation Time & Casualty Range */}
                        <div className="metric-grid">
                          <div className="metric-card">
                            <div className="metric-card-label">Evacuation Time</div>
                            <div className="metric-card-value">
                              {result.simulation.evacuationCongestionTimeEstimate} <span className="metric-card-unit">min</span>
                            </div>
                          </div>
                          <div className="metric-card">
                            <div className="metric-card-label">Casualty Range</div>
                            <div className="metric-card-value">
                              {result.simulation.estimatedCasualtyRange.min}-{result.simulation.estimatedCasualtyRange.max}
                            </div>
                            <div className="metric-card-subtext">per 100k population</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Risk Bar */}
                    <div className="risk-card">
                      <div className="risk-header">
                        <span>Survival Probability</span>
                        <span style={{ color: getSurvivalColor(result.simulation.survivalProbability) }}>{result.simulation.survivalProbability}%</span>
                      </div>
                      <div className="risk-bar">
                        <div className="risk-fill" style={{ width: `${animatedSurvival}%`, background: `linear-gradient(90deg, ${getSurvivalColor(result.simulation.survivalProbability)}, ${getSurvivalColor(result.simulation.survivalProbability)}aa)` }}></div>
                      </div>
                      <div className="risk-footer">
                        <span style={{ color: getSurvivalColor(result.simulation.survivalProbability) }}>Survival: {result.simulation.survivalProbability}%</span>
                        <span style={{ color: "#ef4444" }}>Fatality: {result.simulation.fatalityRisk}%</span>
                      </div>
                    </div>

                    {/* Assessment Alert */}
                    <div className="alert-card" style={getImpactColor(result.simulation.impactLevel)}>
                      <div className="alert-icon">
                        {result.simulation.survivalProbability >= 75 ? "✓" : 
                         result.simulation.survivalProbability >= 50 ? "!" : 
                         result.simulation.survivalProbability >= 25 ? "!!" : "!!!"}
                      </div>
                      <div className="alert-content">
                        <h4 style={{ color: getSurvivalColor(result.simulation.survivalProbability) }}>
                          {result.simulation.survivalProbability >= 75 ? "Well Prepared" :
                           result.simulation.survivalProbability >= 50 ? "Moderate Risk" :
                           result.simulation.survivalProbability >= 25 ? "High Risk" : "Critical Danger"}
                        </h4>
                        <p>
                          {result.simulation.survivalProbability >= 75
                            ? "Your preparedness level provides strong protection. Continue maintaining emergency supplies."
                            : result.simulation.survivalProbability >= 50
                              ? "You have moderate preparation. Consider improving emergency kits and evacuation plans."
                              : result.simulation.survivalProbability >= 25
                                ? "Your preparedness is insufficient. Take immediate action to improve survival chances."
                                : "Critical situation. Immediate evacuation planning and emergency preparation required."}
                        </p>
                      </div>
                    </div>

                    {/* Parameters */}
                    <div className="params-card">
                      <h3 className="params-title">Scenario Parameters</h3>
                      <div className="params-grid">
                        <div className="param-item">
                          <div className="param-label">Disaster</div>
                          <div className="param-value">{selectedDisaster?.label}</div>
                        </div>
                        <div className="param-item">
                          <div className="param-label">Time</div>
                          <div className="param-value">{timeOfDay === "Day" ? "Daytime" : "Night"}</div>
                        </div>
                        <div className="param-item">
                          <div className="param-label">Density</div>
                          <div className="param-value">
                            {populationDensity === "low" ? "Sparse" : populationDensity === "medium" ? "Urban" : "Dense"}
                          </div>
                        </div>
                        <div className="param-item">
                          <div className="param-label">Impact</div>
                          <div className="param-value">{impact}/10</div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {activeTab === "ai" && result.aiReport && (
                  <div className="ai-card">
                    <div className="ai-header">
                      <div className="ai-icon">AI</div>
                      <div>
                        <h3 className="ai-title">AI Emergency Assessment</h3>
                        <p className="ai-subtitle">Generated by advanced disaster simulation engine</p>
                      </div>
                    </div>

                    {/* Infrastructure Impact */}
                    <div className="ai-section">
                      <h4 className="ai-section-title">Infrastructure Impact</h4>
                      <p className="ai-text">{result.aiReport.infrastructureImpact}</p>
                    </div>

                    {/* Healthcare Impact */}
                    <div className="ai-section">
                      <h4 className="ai-section-title">Healthcare System Impact</h4>
                      <p className="ai-text">{result.aiReport.healthcareImpact}</p>
                    </div>

                    {/* Evacuation Impact */}
                    <div className="ai-section">
                      <h4 className="ai-section-title">Evacuation & Transportation</h4>
                      <p className="ai-text">{result.aiReport.evacuationImpact}</p>
                    </div>

                    {/* Cascading Risks */}
                    <div className="ai-section">
                      <h4 className="ai-section-title">Secondary Risks</h4>
                      <p className="ai-text">{result.aiReport.cascadingRisks}</p>
                    </div>

                    {/* Priority Actions */}
                    <div>
                      <h4 className="ai-section-title">Priority Actions</h4>
                      <div className="priority-list">
                        {Array.isArray(result.aiReport.priorityActions) && result.aiReport.priorityActions.map((action, idx) => (
                          <div key={idx} className="priority-item">
                            <span className="priority-number">{idx + 1}</span>
                            <p className="priority-text">{action}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="footer-tip">
          Higher preparedness scores significantly improve survival probability across all disaster types
        </div>
      </div>
    </div>
  );
};

export default WhatIf;