const axios = require("axios");

// ==================== SIMULATION ENGINE ====================

/**
 * Run a single Monte Carlo simulation iteration
 */
function runSingleSimulation(params) {
  const {
    disasterType,
    imapct,
    timeOfDay,
    preparednessScore,
    populationDensity,
  } = params;

  // Base survival derived from preparedness
  let baseSurvival = 40 + preparednessScore * 0.6;

  // Disaster type multipliers
  const disasterMultipliers = {
    earthquake: 1.3,
    flood: 1.2,
    heatwave: 1.1,
    fire: 1.25,
  };

  let multiplier = disasterMultipliers[disasterType] || 1.1;

  // Time-of-day vulnerability factor (3AM is deadlier)
  let timeFactor = timeOfDay === "3AM" ? 1.2 : 1.0;

  // Population density pressure factor
  let densityFactor = 1.0;
  if (populationDensity === "high") densityFactor = 1.15;
  if (populationDensity === "medium") densityFactor = 1.08;
  if (populationDensity === "low") densityFactor = 1.03;

  // Add randomized variation (±10%) for Monte Carlo realism
  const variance = 0.9 + Math.random() * 0.2;
  let riskImpact = multiplier * timeFactor * densityFactor * imapct * variance;

  let finalSurvival = baseSurvival - riskImpact;
  finalSurvival = Math.max(5, Math.min(95, finalSurvival));

  // ======== MULTI-LAYER IMPACT SIMULATION ========

  // Structural Damage (depends on imapct and type)
  let structuralDamage = 20 + imapct * 8 + (populationDensity === "high" ? 10 : 0);
  if (disasterType === "earthquake") structuralDamage *= 1.4;
  if (disasterType === "fire") structuralDamage *= 0.9;
  structuralDamage = Math.min(95, structuralDamage);

  // Hospital Capacity Overload Risk (%)
  let hospitalLoad = 50 + imapct * 8 + (populationDensity === "high" ? 25 : 0);
  if (timeOfDay === "3AM") hospitalLoad += 15; // Fewer staff at night
  hospitalLoad = Math.min(180, hospitalLoad);

  // Evacuation Congestion Time Estimate (minutes)
  let evacuationTime = 30;
  if (populationDensity === "high") evacuationTime += 45;
  if (populationDensity === "medium") evacuationTime += 20;
  if (imapct >= 7) evacuationTime += 30;
  if (timeOfDay === "3AM") evacuationTime += 15;

  // Communication Breakdown Likelihood (%)
  let commFailure = 15 + imapct * 5;
  if (populationDensity === "high" && timeOfDay === "3AM") commFailure += 25;
  if (disasterType === "heatwave") commFailure += 10;
  commFailure = Math.min(85, commFailure);

  // Estimated Casualty Range (people per 100k)
  let casualtyBase = (100 - finalSurvival) * 80; // Up to 8000 per 100k if 0% survival
  casualtyBase *= populationDensity === "high" ? 1.3 : populationDensity === "low" ? 0.6 : 1.0;
  let casualtyMin = Math.round(casualtyBase * 0.7);
  let casualtyMax = Math.round(casualtyBase * 1.3);

  return {
    survivalProbability: parseFloat(finalSurvival.toFixed(1)),
    structuralDamage: parseFloat(structuralDamage.toFixed(1)),
    hospitalLoad: parseFloat(hospitalLoad.toFixed(1)),
    evacuationTime: Math.round(evacuationTime),
    commFailure: parseFloat(commFailure.toFixed(1)),
    casualtyMin,
    casualtyMax,
  };
}

/**
 * Run Monte Carlo simulation (50 iterations) and return averaged results
 */
function monteCarloSimulation(params) {
  const iterations = 50;
  let results = {
    survivalProbability: 0,
    structuralDamagePercent: 0,
    hospitalCapacityLoadPercent: 0,
    evacuationCongestionTimeEstimate: 0,
    communicationFailureRiskPercent: 0,
    casualtyRangeMin: 0,
    casualtyRangeMax: 0,
  };

  // Run multiple simulations
  for (let i = 0; i < iterations; i++) {
    const run = runSingleSimulation(params);
    results.survivalProbability += run.survivalProbability;
    results.structuralDamagePercent += run.structuralDamage;
    results.hospitalCapacityLoadPercent += run.hospitalLoad;
    results.evacuationCongestionTimeEstimate += run.evacuationTime;
    results.communicationFailureRiskPercent += run.commFailure;
    results.casualtyRangeMin += run.casualtyMin;
    results.casualtyRangeMax += run.casualtyMax;
  }

  // Average the results
  results.survivalProbability = parseFloat((results.survivalProbability / iterations).toFixed(1));
  results.structuralDamagePercent = parseFloat((results.structuralDamagePercent / iterations).toFixed(1));
  results.hospitalCapacityLoadPercent = parseFloat((results.hospitalCapacityLoadPercent / iterations).toFixed(1));
  results.evacuationCongestionTimeEstimate = Math.round(results.evacuationCongestionTimeEstimate / iterations);
  results.communicationFailureRiskPercent = parseFloat((results.communicationFailureRiskPercent / iterations).toFixed(1));
  results.casualtyRangeMin = Math.round(results.casualtyRangeMin / iterations);
  results.casualtyRangeMax = Math.round(results.casualtyRangeMax / iterations);

  return results;
}

/**
 * Apply cascading logic to amplify impacts based on conditions
 */
function applyCascadingLogic(simulation, params) {
  const { imapct, populationDensity } = params;

  // Cascading Logic 1: High imapct earthquakes cause power grid failure
  if (imapct > 7) {
    simulation.hospitalCapacityLoadPercent += 20; // Less equipment works
    simulation.evacuationCongestionTimeEstimate += 25; // No traffic lights
    simulation.communicationFailureRiskPercent += 30; // Power grid down
  }

  // Cascading Logic 2: Hospital overload increases fatality
  if (simulation.hospitalCapacityLoadPercent > 130) {
    simulation.survivalProbability -= 15;
    simulation.casualtyRangeMin = Math.round(simulation.casualtyRangeMin * 1.4);
    simulation.casualtyRangeMax = Math.round(simulation.casualtyRangeMax * 1.4);
  }

  // Cascading Logic 3: High density + high communication failure = more casualties
  if (populationDensity === "high" && simulation.communicationFailureRiskPercent > 60) {
    simulation.evacuationCongestionTimeEstimate += 30;
    simulation.casualtyRangeMin = Math.round(simulation.casualtyRangeMin * 1.2);
  }

  // Ensure bounds
  simulation.survivalProbability = Math.max(5, Math.min(95, simulation.survivalProbability));
  simulation.structuralDamagePercent = Math.min(95, simulation.structuralDamagePercent);
  simulation.hospitalCapacityLoadPercent = Math.min(180, simulation.hospitalCapacityLoadPercent);

  return simulation;
}

/**
 * Determine impact level based on survival probability
 */
function getImpactLevel(survivalProbability) {
  if (survivalProbability >= 75) return "Low";
  if (survivalProbability >= 50) return "Moderate";
  if (survivalProbability >= 30) return "High";
  return "Critical";
}

// ==================== AI REPORT GENERATION ====================

/**
 * Generate AI disaster impact report using Groq API
 */
async function generateAIReport(simulationData, params) {
  try {
    const groqApiKey = process.env.GROQ_API_KEY;

    if (!groqApiKey) {
      console.warn("⚠️ GROQ_API_KEY not found in environment");
      return null;
    }

    const prompt = `You are an emergency management AI. Based on the following disaster simulation data, generate a structured JSON emergency impact assessment.

SIMULATION DATA:
- Disaster Type: ${params.disasterType}
- imapct: ${params.imapct}/10
- Time of Day: ${params.timeOfDay}
- Population Density: ${params.populationDensity}
- Preparedness Score: ${params.preparednessScore}/100
- Survival Probability: ${simulationData.survivalProbability}%
- Structural Damage: ${simulationData.structuralDamagePercent}%
- Hospital Capacity Load: ${simulationData.hospitalCapacityLoadPercent}%
- Evacuation Time: ${simulationData.evacuationCongestionTimeEstimate} minutes
- Communication Failure Risk: ${simulationData.communicationFailureRiskPercent}%
- Estimated Casualties: ${simulationData.casualtyRangeMin}-${simulationData.casualtyRangeMax} per 100k population

Generate a JSON response with this exact structure (ONLY return valid JSON, no markdown):
{
  "infrastructureImpact": "Brief summary of infrastructure damage and power grid implications",
  "healthcareImpact": "Hospital system strain, triage challenges, and resource needs",
  "evacuationImpact": "Transportation bottlenecks, shelter requirements, and accessibility issues",
  "cascadingRisks": "Secondary and tertiary failure risks (e.g., disease outbreaks, supply chain breakdown)",
  "priorityActions": ["Action 1 for authorities", "Action 2 for citizens", "Action 3 critical resource", "Action 4 communication"]
}`;

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You are an emergency management specialist. Return ONLY valid JSON, no markdown formatting.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      },
      {
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const content = response.data.choices[0].message.content.trim();

    // Try to parse JSON from response
    let aiReport = {};
    try {
      aiReport = JSON.parse(content);
    } catch (e) {
      // If response starts with ```json, extract it
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        aiReport = JSON.parse(jsonMatch[1]);
      } else {
        // Try to find JSON object in response
        const jsonStart = content.indexOf("{");
        const jsonEnd = content.lastIndexOf("}");
        if (jsonStart !== -1 && jsonEnd !== -1) {
          aiReport = JSON.parse(content.substring(jsonStart, jsonEnd + 1));
        }
      }
    }

    return {
      infrastructureImpact:
        aiReport.infrastructureImpact || "Infrastructure assessment pending",
      healthcareImpact: aiReport.healthcareImpact || "Healthcare impact assessment pending",
      evacuationImpact: aiReport.evacuationImpact || "Evacuation assessment pending",
      cascadingRisks: aiReport.cascadingRisks || "Cascading risk assessment pending",
      priorityActions: Array.isArray(aiReport.priorityActions)
        ? aiReport.priorityActions
        : ["Activate emergency protocols", "Mobilize medical resources", "Begin evacuation", "Establish communication channels"],
    };
  } catch (error) {
    console.error("❌ Groq API Error:", error.response?.data || error.message);
    return null; // Return null if AI fails, but still return numeric results
  }
}

// ==================== MAIN EXPORT ====================

exports.simulateScenario = async (req, res) => {
  try {
    const {
      disasterType,
      imapct,
      timeOfDay,
      preparednessScore,
      populationDensity,
    } = req.body;

    // Validate inputs
    if (!disasterType || !imapct || !timeOfDay || preparednessScore === undefined || !populationDensity) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters",
      });
    }

    // Run Monte Carlo simulation
    let simulationResults = monteCarloSimulation({
      disasterType,
      imapct: parseFloat(imapct),
      timeOfDay,
      preparednessScore: parseFloat(preparednessScore),
      populationDensity,
    });

    // Apply cascading logic
    simulationResults = applyCascadingLogic(simulationResults, {
      imapct: parseFloat(imapct),
      populationDensity,
    });

    // Determine impact level
    const impactLevel = getImpactLevel(simulationResults.survivalProbability);

    // Generate AI report (async, but don't block response if it fails)
    let aiReport = null;
    try {
      aiReport = await generateAIReport(simulationResults, {
        disasterType,
        imapct: parseFloat(imapct),
        timeOfDay,
        preparednessScore: parseFloat(preparednessScore),
        populationDensity,
      });
    } catch (error) {
      console.error("⚠️ AI report generation failed, returning numeric results only");
    }

    // Build response
    const response = {
      success: true,
      simulation: {
        survivalProbability: simulationResults.survivalProbability,
        structuralDamagePercent: simulationResults.structuralDamagePercent,
        hospitalCapacityLoadPercent: simulationResults.hospitalCapacityLoadPercent,
        evacuationCongestionTimeEstimate: simulationResults.evacuationCongestionTimeEstimate,
        communicationFailureRiskPercent: simulationResults.communicationFailureRiskPercent,
        estimatedCasualtyRange: {
          min: simulationResults.casualtyRangeMin,
          max: simulationResults.casualtyRangeMax,
          unit: "per 100k population",
        },
        impactLevel,
        fatalityRisk: (100 - simulationResults.survivalProbability).toFixed(1),
      },
      aiReport: aiReport || {
        infrastructureImpact: "AI analysis unavailable",
        healthcareImpact: "AI analysis unavailable",
        evacuationImpact: "AI analysis unavailable",
        cascadingRisks: "AI analysis unavailable",
        priorityActions: ["Refer to simulation numeric values for assessment"],
      },
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("❌ Simulation Error:", error);
    res.status(500).json({
      success: false,
      message: "Simulation failed",
      error: error.message,
    });
  }
};
