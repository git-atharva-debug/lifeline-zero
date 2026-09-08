// backend/controllers/preparednessController.js
// LifeShield OS — Preparedness Score Controller

/**
 * Calculates preparedness score from weighted checklist inputs.
 *
 * Weights:
 *  - Kit Checklist:       30%
 *  - Evacuation Route:    25%
 *  - Family Plan:         20%
 *  - Emergency Contacts:  15%
 *  - Drill Participation: 10%
 *
 * Survival probability model:
 *  survival = 40 + (score * 0.6)
 *  Range: 40% (score=0) → 100% (score=100)
 */

const WEIGHTS = {
  kitChecklist: 0.30,
  evacRouteSaved: 0.25,
  familyPlan: 0.20,
  emergencyContacts: 0.15,
  drillParticipation: 0.10,
};

const RISK_LEVELS = [
  { min: 80, label: "Low",      color: "#00ff88", badge: "WELL PREPARED"  },
  { min: 60, label: "Moderate", color: "#ffb800", badge: "NEEDS IMPROVEMENT" },
  { min: 40, label: "High",     color: "#ff6b00", badge: "HIGH RISK"      },
  { min: 0,  label: "Critical", color: "#ff2d55", badge: "CRITICAL RISK"  },
];

/**
 * Kit sub-score: each item in the kit array is worth equal share.
 * kitItems: array of booleans (true = item present)
 */
function calcKitScore(kitItems = []) {
  if (!kitItems.length) return 0;
  const checked = kitItems.filter(Boolean).length;
  return Math.round((checked / kitItems.length) * 100);
}

/**
 * Main score calculation
 * @param {Object} data - form data from frontend
 * @returns {Object} - { score, survivalProbability, riskLevel, breakdown, warnings }
 */
function calculateScore(data) {
  const {
    kitItems = [],          // boolean[]  — emergency kit items checked
    evacRouteSaved = false, // boolean    — route confirmed
    familyPlanDone = false, // boolean    — family plan complete
    contactsCount = 0,      // number     — 0-5 emergency contacts stored
    drillCount = 0,         // number     — number of drills done (0-3+)
  } = data;

  // --- Component scores (0–100 each) ---
  const kitScore       = calcKitScore(kitItems);
  const evacScore      = evacRouteSaved ? 100 : 0;
  const familyScore    = familyPlanDone ? 100 : 0;
  const contactScore   = Math.min(100, Math.round((contactsCount / 5) * 100));
  const drillScore     = Math.min(100, Math.round((drillCount / 3) * 100));

  // --- Weighted total ---
  const score = Math.round(
    kitScore       * WEIGHTS.kitChecklist     +
    evacScore      * WEIGHTS.evacRouteSaved   +
    familyScore    * WEIGHTS.familyPlan       +
    contactScore   * WEIGHTS.emergencyContacts +
    drillScore     * WEIGHTS.drillParticipation
  );

  // --- Survival probability ---
  const survivalProbability = Math.min(100, Math.round(40 + score * 0.6));

  // --- Risk level ---
  const risk = RISK_LEVELS.find(r => score >= r.min);

  // --- Warnings ---
  const warnings = [];
  if (kitScore < 50)       warnings.push("Emergency kit is less than half complete — pack water, food, and first aid essentials.");
  if (!evacRouteSaved)     warnings.push("No evacuation route saved — identify and memorise 2 routes from your area.");
  if (!familyPlanDone)     warnings.push("Family emergency plan is missing — define meeting points and communication protocols.");
  if (contactsCount < 3)   warnings.push("Store at least 3 emergency contacts offline including a local authority number.");
  if (drillCount === 0)    warnings.push("No drills completed — practice improves survival response time by up to 40%.");

  return {
    score,
    survivalProbability,
    riskLevel: risk.label,
    riskBadge: risk.badge,
    riskColor: risk.color,
    breakdown: {
      kit:      { score: kitScore,      weight: "30%", label: "Emergency Kit" },
      evac:     { score: evacScore,     weight: "25%", label: "Evacuation Route" },
      family:   { score: familyScore,   weight: "20%", label: "Family Plan" },
      contacts: { score: contactScore,  weight: "15%", label: "Emergency Contacts" },
      drill:    { score: drillScore,    weight: "10%", label: "Drill Participation" },
    },
    warnings,
  };
}

// ── Express route handler ────────────────────────────────────────────────────

/**
 * POST /api/preparedness/calculate
 * Body: { kitItems, evacRouteSaved, familyPlanDone, contactsCount, drillCount }
 */
const calculate = (req, res) => {
  try {
    const data = req.body;

    // Basic validation
    if (!data || typeof data !== "object") {
      return res.status(400).json({ error: "Invalid request body." });
    }

    const result = calculateScore(data);
    return res.status(200).json(result);
  } catch (err) {
    console.error("[preparednessController] Error:", err.message);
    return res.status(500).json({ error: "Score calculation failed." });
  }
};

module.exports = { calculate };