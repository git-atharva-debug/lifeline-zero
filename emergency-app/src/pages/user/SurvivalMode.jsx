import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Groq AI (ultra-fast inference) ──────────────────────────────────────────
async function askGroqAI(question, situation) {
  const API_KEY = process.env.REACT_APP_GROQ_API_KEY;
  if (!API_KEY) return null;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 300,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: `You are AEGIS emergency AI. Situation: ${situation}. Give 3 ultra-short survival steps. Direct commands only. Max 15 words per step.`,
          },
          { role: 'user', content: question },
        ],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.error('Groq Error:', e);
    return null;
  }
}

// ─── Offline survival database ────────────────────────────────────────────────
const SURVIVAL_DB = {
  Fire: {
    icon: '🔥',
    color: '#ef4444',
    steps: [
      { step: 'STAY LOW', detail: 'Crawl below smoke — air is cleaner near the floor.' },
      { step: 'TEST DOORS', detail: 'Touch door before opening. If hot — DO NOT open.' },
      { step: 'SIGNAL', detail: 'Wave cloth from window. Shout. Never use elevator.' },
      { step: 'SEAL GAPS', detail: 'Block door gaps with cloth to slow smoke entry.' },
      { step: 'NEVER HIDE', detail: 'Closets trap you. Get to window or exit.' },
    ],
    preDisaster: [
      { step: 'INSTALL ALARMS', detail: 'Place smoke detectors on every level. Test monthly.' },
      { step: 'PLAN ESCAPE', detail: 'Map 2 ways out of every room. Practice with family.' },
      { step: 'CHECK EXTINGUISHERS', detail: 'Ensure ABC extinguishers are accessible and charged.' },
      { step: 'CLEAR HAZARDS', detail: 'Remove clutter from exits. Store flammables safely.' },
      { step: 'KNOW MEETING POINT', detail: 'Designate a safe outdoor meeting spot.' },
    ]
  },
  Flood: {
    icon: '🌊',
    color: '#3b82f6',
    steps: [
      { step: 'GO HIGH', detail: 'Move to highest floor. Never go to basement.' },
      { step: 'CUT POWER', detail: 'Turn off electrical mains — electrocution risk.' },
      { step: 'SIGNAL', detail: 'Wave bright cloth from window for rescue boats.' },
      { step: 'STAY PUT', detail: 'Do not wade in flood water — currents are deadly.' },
      { step: 'STORE WATER', detail: 'Fill bathtubs with clean water before supply cuts.' },
    ],
    preDisaster: [
      { step: 'ELEVATE APPLIANCES', detail: 'Move electronics and valuables to upper floors.' },
      { step: 'SAND BAGS', detail: 'Prepare sandbags for doorways and low openings.' },
      { step: 'DOCUMENTS', detail: 'Store important papers in waterproof containers.' },
      { step: 'CHECK SUMP PUMP', detail: 'Test battery backup sump pump before storm.' },
      { step: 'CLEAR DRAINS', detail: 'Remove debris from gutters and downspouts.' },
    ]
  },
  Earthquake: {
    icon: '🌍',
    color: '#f97316',
    steps: [
      { step: 'DROP COVER HOLD', detail: 'Drop to knees, cover head, hold under solid table.' },
      { step: 'AWAY FROM GLASS', detail: 'Move away from windows, shelves, hanging objects.' },
      { step: 'STAY INSIDE', detail: 'Most injuries happen trying to exit during shaking.' },
      { step: 'AFTER: CHECK GAS', detail: 'Smell gas? Open windows and leave immediately.' },
      { step: 'AFTERSHOCKS', detail: 'Expect aftershocks. Stay away from damaged structures.' },
    ],
    preDisaster: [
      { step: 'SECURE FURNITURE', detail: 'Anchor heavy items like bookshelves to walls.' },
      { step: 'STORE SUPPLIES', detail: 'Keep 3-day water, food, and first aid kit ready.' },
      { step: 'IDENTIFY SAFE SPOTS', detail: 'Find sturdy tables and interior walls.' },
      { step: 'LEARN SHUT-OFFS', detail: 'Know how to turn off gas, water, and electricity.' },
      { step: 'PRACTICE DROP COVER', detail: 'Run regular drills with all household members.' },
    ]
  },
  Cyclone: {
    icon: '🌀',
    color: '#8b5cf6',
    steps: [
      { step: 'INTERIOR ROOM', detail: 'Move to innermost room — away from all windows.' },
      { step: 'LIE FLAT', detail: 'If no shelter — lie flat in ditch, arms over head.' },
      { step: 'EYE WARNING', detail: "Calm during eye is TEMPORARY. Storm WILL resume." },
      { step: 'AVOID COAST', detail: 'Storm surge is deadlier than wind. Move inland.' },
      { step: 'NO CANDLES', detail: 'Use torch — gas leaks make candles lethal.' },
    ],
    preDisaster: [
      { step: 'BOARD WINDOWS', detail: 'Install storm shutters or plywood over windows.' },
      { step: 'TRIM TREES', detail: 'Cut weak branches that could fall on house.' },
      { step: 'SECURE OUTDOORS', detail: 'Bring in patio furniture, grills, and trash cans.' },
      { step: 'FILL VEHICLES', detail: 'Keep gas tanks full for possible evacuation.' },
      { step: 'CHARGE DEVICES', detail: 'Power banks and phones fully before storm.' },
    ]
  },
  Landslide: {
    icon: '⛰️',
    color: '#84cc16',
    steps: [
      { step: 'RUN SIDEWAYS', detail: 'Escape perpendicular to slide path — not downhill.' },
      { step: 'HIGH GROUND', detail: 'Move to high stable ground immediately.' },
      { step: 'IF BURIED', detail: 'Cover mouth. Spit to find gravity direction. Dig up.' },
      { step: 'AVOID RIVER', detail: 'Landslide can dam and suddenly release water.' },
      { step: 'LISTEN', detail: 'Rumbling, cracking trees = imminent slide. Run now.' },
    ],
    preDisaster: [
      { step: 'WATCH SIGNS', detail: 'Look for cracks, bulges, or leaning trees.' },
      { step: 'IMPROVE DRAINAGE', detail: 'Divert water away from slopes.' },
      { step: 'PLANT GROUND COVER', detail: 'Deep-rooted plants help stabilize soil.' },
      { step: 'PROFESSIONAL INSPECT', detail: 'Get geotechnical assessment if concerned.' },
      { step: 'KNOW WARNINGS', detail: 'Monitor heavy rain forecasts in your area.' },
    ]
  },
  'Chemical Spill': {
    icon: '☣️',
    color: '#eab308',
    steps: [
      { step: 'GO UPWIND', detail: 'Evacuate upwind and uphill from spill immediately.' },
      { step: 'COVER MOUTH', detail: 'Use wet cloth over nose and mouth.' },
      { step: 'NO FLAME', detail: 'Many chemicals are explosive. No lighters, switches.' },
      { step: 'SEAL ROOM', detail: 'If stuck — seal doors/windows with tape and cloth.' },
      { step: 'STRIP CLOTHES', detail: 'If exposed — remove clothes, rinse skin with water.' },
    ],
    preDisaster: [
      { step: 'KNOW FACILITIES', detail: 'Identify nearby industrial sites and their hazards.' },
      { step: 'STORE SUPPLIES', detail: 'Keep duct tape, plastic sheeting, and masks ready.' },
      { step: 'PLAN ROUTES', detail: 'Map evacuation routes away from industrial areas.' },
      { step: 'MONITOR ALERTS', detail: 'Sign up for community warning systems.' },
      { step: 'PREP KIT', detail: 'Include goggles, gloves, and emergency contacts.' },
    ]
  },
};

// ─── Battery hook ─────────────────────────────────────────────────────────────
function useBattery() {
  const [battery, setBattery] = useState({ level: 1, charging: true, supported: false });

  useEffect(() => {
    if (!navigator.getBattery) return;
    navigator.getBattery().then(bat => {
      const update = () => setBattery({
        level: bat.level,
        charging: bat.charging,
        supported: true,
      });
      update();
      bat.addEventListener('levelchange',   update);
      bat.addEventListener('chargingchange',update);
      return () => {
        bat.removeEventListener('levelchange',   update);
        bat.removeEventListener('chargingchange',update);
      };
    });
  }, []);

  return battery;
}

// ─── Wake lock hook ───────────────────────────────────────────────────────────
function useWakeLock(active) {
  const lockRef = useRef(null);
  useEffect(() => {
    if (!active || !navigator.wakeLock) return;
    navigator.wakeLock.request('screen')
      .then(lock => { lockRef.current = lock; })
      .catch(() => {});
    return () => { lockRef.current?.release(); };
  }, [active]);
}

// ─── Grayscale effect hook (for demo) ────────────────────────────────────────
function useGrayscale(active) {
  useEffect(() => {
    if (active) {
      document.documentElement.style.filter = 'grayscale(0.8)';
      document.documentElement.style.transition = 'filter 0.3s';
    } else {
      document.documentElement.style.filter = 'grayscale(0)';
    }
    return () => {
      document.documentElement.style.filter = 'grayscale(0)';
    };
  }, [active]);
}

// ─── Network hook ─────────────────────────────────────────────────────────────
function useNetwork() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

// ─── Battery bar ─────────────────────────────────────────────────────────────
function BatteryBar({ level, charging }) {
  const pct   = Math.round(level * 100);
  const color = pct <= 15 ? '#ef4444' : pct <= 30 ? '#f97316' : '#22c55e';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width: 32, height: 14,
        border: `1.5px solid ${color}`, borderRadius: 4 }}>
        <div style={{
          position: 'absolute', right: -4, top: '50%',
          transform: 'translateY(-50%)',
          width: 3, height: 6, background: color, borderRadius: '0 2px 2px 0',
        }} />
        <div style={{
          width: `${pct}%`, height: '100%',
          background: color, borderRadius: 2,
          transition: 'width 0.3s',
        }} />
      </div>
      <span style={{ fontSize: '0.75rem', color, fontWeight: 600 }}>
        {charging ? '⚡' : ''}{pct}%
      </span>
    </div>
  );
}

// ─── Groq AI chat panel ───────────────────────────────────────────────────────
function GroqPanel({ situation, animationsOff, survivalMode }) {
  const [query,    setQuery]    = useState('');
  const [answer,   setAnswer]   = useState('');
  const [loading,  setLoading]  = useState(false);
  const [usingMock,setUsingMock]= useState(false);

  const QUICK = [
    'I smell gas', 'No signal on phone', 'Someone is unconscious',
    'Water rising fast', 'Trapped in elevator', 'Child is injured',
  ];

  const MOCK_ANSWERS = {
    'gas':         '1. Leave immediately — do not use switches.\n2. Open all windows as you exit.\n3. Call emergency from outside the building.',
    'signal':      '1. Move to open elevated area.\n2. Use SMS — it uses less signal than calls.\n3. Activate offline SOS beacon in this app.',
    'unconscious': '1. Check breathing — tilt head back, lift chin.\n2. If not breathing — start CPR immediately.\n3. Send someone to call 108 while you continue.',
    'water':       '1. Move to highest floor now — do not delay.\n2. Signal from window with bright cloth.\n3. Turn off electricity at mains panel.',
    'elevator':    '1. Press emergency button and hold.\n2. Shout every 5 minutes — rescuers listen.\n3. Stay calm — elevators rarely fall; wait for rescue.',
    'child':       '1. Stop bleeding with firm direct pressure.\n2. Keep child still, warm and conscious.\n3. Call 108 — describe injury and location clearly.',
  };

  const getMockAnswer = (q) => {
    const ql = q.toLowerCase();
    for (const [k, v] of Object.entries(MOCK_ANSWERS)) {
      if (ql.includes(k)) return v;
    }
    return '1. Stay calm — assess your immediate environment.\n2. Move to the safest area available.\n3. Signal for help using any means available.';
  };

  const ask = async (q) => {
    if (!q.trim()) return;
    setQuery(q); setLoading(true); setAnswer('');
    const real = await askGroqAI(q, situation);
    if (real) {
      setAnswer(real); setUsingMock(false);
    } else {
      await new Promise(r => setTimeout(r, 800));
      setAnswer(getMockAnswer(q)); setUsingMock(true);
    }
    setLoading(false);
  };

  return (
    <div style={{
      ...styles.groqPanel,
      background: survivalMode ? '#1a1a1a' : '#ffffff',
      borderColor: survivalMode ? '#333333' : '#e2e8f0',
    }}>
      <div style={styles.groqHeader}>
        <span style={styles.groqTitle}>Emergency Assistant</span>
        <span style={{
          ...styles.groqSubtitle,
          color: survivalMode ? '#60a5fa' : '#3b82f6',
          borderColor: survivalMode ? '#60a5fa40' : '#3b82f630',
          background: survivalMode ? '#60a5fa15' : '#3b82f610',
        }}>Powered by AEGIS</span>
      </div>

      {/* Quick queries */}
      <div style={styles.quickQueries}>
        {QUICK.map(q => (
          <button key={q} onClick={() => ask(q)} style={{
            ...styles.quickQueryButton,
            background: survivalMode ? '#262626' : '#f8fafc',
            borderColor: survivalMode ? '#404040' : '#e2e8f0',
            color: survivalMode ? '#d1d5db' : '#475569',
          }}>
            {q}
          </button>
        ))}
      </div>

      {/* Custom input */}
      <div style={styles.inputWrapper}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ask(query)}
          placeholder="Ask about your situation..."
          style={{
            ...styles.input,
            background: survivalMode ? '#262626' : '#ffffff',
            borderColor: survivalMode ? '#404040' : '#e2e8f0',
            color: survivalMode ? '#f5f5f5' : '#0f172a',
          }}
        />
        <button 
          onClick={() => ask(query)} 
          disabled={loading} 
          style={{
            ...styles.askButton,
            background: survivalMode ? '#dc2626' : '#ef4444',
          }}
        >
          {loading ? '...' : 'Ask'}
        </button>
      </div>

      {/* Answer */}
      {answer && (
        <div style={{
          ...styles.answerContainer,
          background: survivalMode ? '#262626' : '#f8fafc',
        }}>
          {usingMock && (
            <div style={styles.mockIndicator}>
              Offline response
            </div>
          )}
          <pre style={{
            ...styles.answer,
            color: survivalMode ? '#e5e7eb' : '#0f172a',
          }}>
            {answer}
          </pre>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function SurvivalMode() {
  const battery     = useBattery();
  const online      = useNetwork();

  const batteryPct  = Math.round(battery.level * 100);
  const criticalBat = battery.supported && batteryPct <= 15 && !battery.charging;
  const lowBat      = battery.supported && batteryPct <= 30 && !battery.charging;

  // Auto-enable survival mode on low battery or offline
  const [survivalActive, setSurvivalActive] = useState(false);
  const [disaster,       setDisaster]       = useState('Flood');
  const [activeStep,     setActiveStep]     = useState(null);
  const [preDisasterMode, setPreDisasterMode] = useState(false);

  // Apply grayscale when survival mode is active
  useGrayscale(survivalActive);

  // Wake lock when survival mode is active
  useWakeLock(survivalActive);

  // Auto-trigger survival mode on low battery or going offline
  useEffect(() => {
    if (criticalBat || !online) setSurvivalActive(true);
  }, [criticalBat, online]);

  const guide = SURVIVAL_DB[disaster];

  // ── Color theme: survival mode = high contrast dark, normal = clean white ─────
  const theme = survivalActive
    ? { 
        bg: '#0a0a0a', 
        card: '#1a1a1a', 
        border: '#333333', 
        text: '#ffffff', 
        textSecondary: '#d1d5db',
        muted: '#9ca3af',
        accent: '#ef4444',
      }
    : { 
        bg: '#f9fafb', 
        card: '#ffffff', 
        border: '#e5e7eb', 
        text: '#111827', 
        textSecondary: '#4b5563',
        muted: '#6b7280',
        accent: '#ef4444',
      };

  const disasterTypes = Object.keys(SURVIVAL_DB);

  return (
    <div style={{
      ...styles.container,
      background: theme.bg,
      color: theme.text,
    }}>
      {/* Header with enhanced title */}
      <div style={styles.header}>
        <div>
          <h1 style={{
            ...styles.title,
            background: 'linear-gradient(135deg, #ef4444 0%, #f97316 50%, #eab308 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontSize: survivalActive ? '1.8rem' : '2.2rem',
            marginBottom: '0.25rem',
          }}>
            {survivalActive ? 'SURVIVAL MODE ACTIVE' : 'SURVIVAL PREPAREDNESS'}
          </h1>
          {survivalActive && (
            <div style={{
              ...styles.survivalBadge,
              color: theme.accent,
            }}>
              Power saving · Grayscale · Minimal animations
            </div>
          )}
        </div>

        {/* Status Indicators */}
        <div style={styles.statusBar}>
          {battery.supported && (
            <BatteryBar level={battery.level} charging={battery.charging} />
          )}

          <span style={{
            ...styles.networkStatus,
            background: online ? (survivalActive ? '#22c55e20' : '#22c55e15') : (survivalActive ? '#ef444420' : '#ef444415'),
            color: online ? '#22c55e' : '#ef4444',
            borderColor: online ? '#22c55e40' : '#ef444440',
          }}>
            {online ? '● Online' : '○ Offline'}
          </span>

          <button 
            onClick={() => setSurvivalActive(s => !s)} 
            style={{
              ...styles.survivalToggle,
              borderColor: survivalActive ? theme.accent : theme.border,
              color: survivalActive ? theme.accent : theme.muted,
              background: survivalActive ? `${theme.accent}15` : 'transparent',
            }}
          >
            {survivalActive ? 'Exit Survival' : 'Activate Survival'}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {!online && (
        <div style={{
          ...styles.alert,
          background: survivalActive ? '#1f2937' : '#f3f4f6',
          borderColor: survivalActive ? '#374151' : '#e5e7eb',
          color: survivalActive ? '#f3f4f6' : '#374151',
        }}>
          <span style={styles.alertIcon}>📵</span>
          <span>No internet connection — using offline survival database</span>
        </div>
      )}
      {criticalBat && (
        <div style={{
          ...styles.alert,
          background: survivalActive ? '#2d1a1a' : '#fee2e2',
          borderColor: survivalActive ? '#7f1d1d' : '#fecaca',
          color: survivalActive ? '#fca5a5' : '#b91c1c',
        }}>
          <span style={styles.alertIcon}>🔋</span>
          <span>Critical battery ({batteryPct}%) — Survival mode activated</span>
        </div>
      )}
      {lowBat && !criticalBat && (
        <div style={{
          ...styles.alert,
          background: survivalActive ? '#2d241a' : '#fff3e0',
          borderColor: survivalActive ? '#854d0e' : '#fed7aa',
          color: survivalActive ? '#fcd34d' : '#b45309',
        }}>
          <span style={styles.alertIcon}>⚠️</span>
          <span>Low battery ({batteryPct}%) — Consider activating survival mode</span>
        </div>
      )}

      {/* Preparedness Toggle */}
      <div style={{
        ...styles.preparationCard,
        background: theme.card,
        borderColor: theme.border,
      }}>
        <div>
          <div style={{
            ...styles.preparationTitle,
            color: theme.text,
          }}>Preparedness Mode</div>
          <div style={{
            ...styles.preparationDesc,
            color: theme.muted,
          }}>Show preparation steps instead of emergency response</div>
        </div>
        <button
          onClick={() => setPreDisasterMode(!preDisasterMode)}
          style={{
            ...styles.preparationToggle,
            background: preDisasterMode ? '#22c55e' : 'transparent',
            color: preDisasterMode ? '#ffffff' : theme.muted,
            borderColor: preDisasterMode ? '#22c55e' : theme.border,
          }}
        >
          {preDisasterMode ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Disaster Selector - Icons removed as requested */}
      <div style={{
        ...styles.selectorCard,
        background: theme.card,
        borderColor: theme.border,
      }}>
        <div style={{
          ...styles.selectorLabel,
          color: theme.muted,
        }}>Disaster Type</div>
        <div style={styles.disasterGrid}>
          {disasterTypes.map(d => {
            const g = SURVIVAL_DB[d];
            const active = disaster === d;
            return (
              <button 
                key={d} 
                onClick={() => { setDisaster(d); setActiveStep(null); }}
                style={{
                  ...styles.disasterButton,
                  borderColor: active ? g.color : theme.border,
                  background: active ? `${g.color}15` : 'transparent',
                  color: active ? g.color : theme.muted,
                }}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      {/* Survival Steps */}
      <div style={{
        ...styles.stepsCard,
        background: theme.card,
        borderColor: theme.border,
      }}>
        <div style={styles.stepsHeader}>
          <div>
            <div style={{
              ...styles.stepsTitle,
              color: guide.color,
            }}>
              {preDisasterMode ? `${disaster} Preparedness` : `${disaster} Survival Guide`}
            </div>
            <div style={{
              ...styles.stepsSubtitle,
              color: theme.muted,
            }}>
              {preDisasterMode ? 'Pre-disaster preparation' : 'Emergency response'}
            </div>
          </div>
          <span style={{
            ...styles.offlineBadge,
            background: survivalActive ? '#22c55e20' : '#22c55e15',
            color: '#22c55e',
            borderColor: '#22c55e40',
          }}>
            Offline Available
          </span>
        </div>

        <div style={styles.stepsList}>
          {(preDisasterMode ? guide.preDisaster : guide.steps).map((s, i) => (
            <div key={i}
              onClick={() => setActiveStep(activeStep === i ? null : i)}
              style={{
                ...styles.stepItem,
                borderColor: activeStep === i ? guide.color : theme.border,
                background: activeStep === i ? (survivalActive ? '#262626' : `${guide.color}08`) : 'transparent',
              }}>
              <div style={styles.stepHeader}>
                <div style={{
                  ...styles.stepNumber,
                  background: i === 0 ? guide.color : theme.muted,
                  color: '#ffffff',
                }}>
                  {i + 1}
                </div>
                <span style={{
                  ...styles.stepTitle,
                  color: i === 0 ? guide.color : theme.text,
                }}>
                  {s.step}
                </span>
                <span style={{
                  ...styles.stepExpand,
                  color: theme.muted,
                }}>
                  {activeStep === i ? '−' : '+'}
                </span>
              </div>
              {activeStep === i && (
                <div style={{
                  ...styles.stepDetail,
                  borderTopColor: theme.border,
                  color: theme.textSecondary,
                }}>
                  {s.detail}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* AI Assistant - renamed to Emergency Assistant */}
      <GroqPanel situation={disaster} animationsOff={survivalActive} survivalMode={survivalActive} />

      {/* Emergency Contacts with Icons and Hover Effects */}
      <div style={{
        ...styles.contactsCard,
        background: theme.card,
        borderColor: theme.border,
      }}>
        <div style={styles.contactsHeader}>
          <span style={{
            ...styles.contactsTitle,
            background: 'linear-gradient(135deg, #ef4444, #f97316)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>Emergency Contacts</span>
          <span style={{
            ...styles.contactsSubheader,
            color: theme.muted,
          }}>Tap to call</span>
        </div>
        <div style={styles.contactsGrid}>
          {[
            { label: 'Fire', number: '101', icon: '🔥' },
            { label: 'Ambulance', number: '108', icon: '🚑' },
            { label: 'Police', number: '100', icon: '🚔' },
            { label: 'Disaster', number: '1077', icon: '🆘' },
            { label: 'NDRF', number: '011-24363260', icon: '⛑️' },
            { label: 'Coast Guard', number: '1554', icon: '🌊' },
          ].map(c => (
            <a 
              key={c.number} 
              href={`tel:${c.number}`} 
              style={{
                ...styles.contactLink,
                background: survivalActive ? '#262626' : '#f9fafb',
                borderColor: theme.border,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = survivalActive 
                  ? '0 8px 20px rgba(0,0,0,0.3)' 
                  : '0 8px 20px rgba(0,0,0,0.1)';
                e.currentTarget.style.borderColor = '#ef4444';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = theme.border;
              }}
            >
              <div style={styles.contactLeft}>
                <span style={styles.contactIcon}>{c.icon}</span>
                <span style={{
                  ...styles.contactLabel,
                  color: theme.text,
                }}>{c.label}</span>
              </div>
              <span style={{
                ...styles.contactNumber,
                color: survivalActive ? '#4ade80' : '#22c55e',
              }}>{c.number}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Survival Mode Features */}
      {survivalActive && (
        <div style={{
          ...styles.featuresBar,
          background: '#1a1a1a',
          borderColor: '#333333',
          color: '#9ca3af',
        }}>
          <span>🔋 Low Battery Mode</span>
          <span>🌑 Grayscale</span>
          <span>⚡ Minimal CPU</span>
          <span>📡 Emergency Ready</span>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes glow {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.05); }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    padding: '2rem',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    transition: 'background-color 0.3s, color 0.3s',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  title: {
    margin: 0,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    animation: 'glow 3s ease infinite',
  },
  survivalBadge: {
    fontSize: '0.8rem',
    marginTop: '0.25rem',
    fontWeight: 500,
  },
  statusBar: {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  networkStatus: {
    fontSize: '0.8rem',
    fontWeight: 600,
    padding: '0.4rem 1.2rem',
    borderRadius: '100px',
    border: '1px solid',
  },
  survivalToggle: {
    padding: '0.5rem 1.4rem',
    borderRadius: '8px',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    background: 'transparent',
    border: '1px solid',
    transition: 'all 0.2s',
  },
  alert: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem 1.25rem',
    border: '1px solid',
    borderRadius: '14px',
    marginBottom: '1rem',
    fontSize: '0.9rem',
  },
  alertIcon: {
    fontSize: '1.2rem',
  },
  preparationCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1.25rem 1.5rem',
    border: '1px solid',
    borderRadius: '18px',
    marginBottom: '1.5rem',
  },
  preparationTitle: {
    fontWeight: 600,
    fontSize: '1rem',
    marginBottom: '0.25rem',
  },
  preparationDesc: {
    fontSize: '0.85rem',
  },
  preparationToggle: {
    padding: '0.5rem 1.5rem',
    borderRadius: '100px',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    border: '1px solid',
    transition: 'all 0.2s',
  },
  selectorCard: {
    padding: '1.25rem 1.5rem',
    border: '1px solid',
    borderRadius: '18px',
    marginBottom: '1.5rem',
  },
  selectorLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '1rem',
  },
  disasterGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.75rem',
  },
  disasterButton: {
    padding: '0.6rem 1.2rem',
    borderRadius: '10px',
    fontSize: '0.9rem',
    fontWeight: 500,
    cursor: 'pointer',
    background: 'transparent',
    border: '1px solid',
    transition: 'all 0.2s',
  },
  stepsCard: {
    padding: '1.75rem',
    border: '1px solid',
    borderRadius: '22px',
    marginBottom: '1.5rem',
  },
  stepsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
  },
  stepsTitle: {
    fontWeight: 700,
    fontSize: '1.2rem',
    marginBottom: '0.25rem',
  },
  stepsSubtitle: {
    fontSize: '0.85rem',
  },
  offlineBadge: {
    fontSize: '0.75rem',
    padding: '0.3rem 1rem',
    borderRadius: '100px',
    border: '1px solid',
    fontWeight: 600,
  },
  stepsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  stepItem: {
    padding: '1.25rem',
    border: '1px solid',
    borderRadius: '16px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  stepHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  stepNumber: {
    width: '30px',
    height: '30px',
    borderRadius: '15px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.85rem',
    fontWeight: 600,
    flexShrink: 0,
  },
  stepTitle: {
    fontWeight: 600,
    fontSize: '1rem',
    flex: 1,
  },
  stepExpand: {
    fontSize: '1.3rem',
    fontWeight: 300,
  },
  stepDetail: {
    marginTop: '1rem',
    paddingTop: '1rem',
    borderTop: '1px solid',
    fontSize: '0.95rem',
    lineHeight: 1.7,
  },
  groqPanel: {
    padding: '1.75rem',
    border: '1px solid',
    borderRadius: '22px',
    marginBottom: '1.5rem',
  },
  groqHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
  },
  groqTitle: {
    fontWeight: 600,
    fontSize: '1.1rem',
    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  groqSubtitle: {
    fontSize: '0.75rem',
    padding: '0.3rem 0.8rem',
    borderRadius: '100px',
    border: '1px solid',
    fontWeight: 500,
  },
  quickQueries: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.6rem',
    marginBottom: '1.25rem',
  },
  quickQueryButton: {
    padding: '0.5rem 1.2rem',
    borderRadius: '100px',
    fontSize: '0.85rem',
    border: '1px solid',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  inputWrapper: {
    display: 'flex',
    gap: '0.75rem',
    marginBottom: '1.25rem',
  },
  input: {
    flex: 1,
    padding: '0.85rem 1.25rem',
    borderRadius: '14px',
    border: '1px solid',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'all 0.2s',
  },
  askButton: {
    padding: '0.85rem 1.8rem',
    borderRadius: '14px',
    border: 'none',
    color: 'white',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    ':hover': {
      transform: 'scale(1.02)',
      boxShadow: '0 4px 12px rgba(239,68,68,0.3)',
    },
  },
  answerContainer: {
    padding: '1.25rem',
    borderRadius: '16px',
  },
  mockIndicator: {
    fontSize: '0.75rem',
    color: '#f97316',
    marginBottom: '0.5rem',
    fontWeight: 500,
  },
  answer: {
    margin: 0,
    fontSize: '0.95rem',
    lineHeight: 1.7,
    whiteSpace: 'pre-wrap',
    fontFamily: 'inherit',
  },
  contactsCard: {
    padding: '1.75rem',
    border: '1px solid',
    borderRadius: '22px',
  },
  contactsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.25rem',
  },
  contactsTitle: {
    fontSize: '1.1rem',
    fontWeight: 600,
  },
  contactsSubheader: {
    fontSize: '0.75rem',
    fontWeight: 400,
  },
  contactsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '0.75rem',
  },
  contactLink: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.25rem',
    border: '1px solid',
    borderRadius: '16px',
    textDecoration: 'none',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
  },
  contactLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  contactIcon: {
    fontSize: '1.2rem',
  },
  contactLabel: {
    fontSize: '0.9rem',
    fontWeight: 500,
  },
  contactNumber: {
    fontSize: '0.95rem',
    fontWeight: 600,
    fontFamily: 'monospace',
  },
  featuresBar: {
    marginTop: '1.5rem',
    padding: '1rem',
    border: '1px solid',
    borderRadius: '14px',
    display: 'flex',
    justifyContent: 'center',
    gap: '2rem',
    fontSize: '0.8rem',
    flexWrap: 'wrap',
  },
};