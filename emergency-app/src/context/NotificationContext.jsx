import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { broadcastAPI } from '../services/api';

const NotificationContext = createContext();

const POLL_INTERVAL = 15000; // 15 seconds

export function NotificationProvider({ children }) {
  const [globalAlert, setGlobalAlert] = useState(null);
  const [allAlerts, setAllAlerts] = useState([]);
  const [lang, setLang] = useState(() => localStorage.getItem('rescue_lang') || 'en');
  const [voiceMode, setVoiceMode] = useState(() => localStorage.getItem('rescue_voice') !== 'false');
  const [soundOn, setSoundOn] = useState(true);

  const lastCount = useRef(0);
  const initialLoad = useRef(true);
  const intervalRef = useRef(null);

  // ✅ SAFE FETCH
  const fetchBroadcasts = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return; // ⛔ Stop if not logged in

    try {
      const res = await broadcastAPI.getAll(50);

      if (!res?.success || !res?.data) return;

      const mapped = res.data.map(b => ({
        id: b._id,
        message: b.message,
        severity: b.severity,
        zone: b.zone,
        sentBy: b.sentBy,
        timestamp: b.createdAt,
        read: false,
        pinned: false,
        voiceEnabled: ['CRITICAL', 'HIGH'].includes(b.severity),
      }));

      if (initialLoad.current) {
        initialLoad.current = false;
        lastCount.current = mapped.length;
        setAllAlerts(mapped);
        return;
      }

      if (mapped.length > lastCount.current) {
        const newest = mapped[0];
        lastCount.current = mapped.length;

        setAllAlerts(prev => {
          const prevMap = {};
          prev.forEach(a => (prevMap[a.id] = a));

          return mapped.map(a => ({
            ...a,
            read: prevMap[a.id]?.read ?? a.read,
            pinned: prevMap[a.id]?.pinned ?? a.pinned,
          }));
        });

        setGlobalAlert(newest);

        if (soundOn) playBeep(newest.severity);

        if (voiceMode && newest.voiceEnabled) {
          setTimeout(() => {
            speakText(newest.message, 'en-IN');
          }, 800);
        }

        setTimeout(() => setGlobalAlert(null), 6000);
      }
    } catch (err) {
      console.error("Broadcast fetch failed:", err?.response?.data || err.message);
    }
  }, [soundOn, voiceMode]);

  // ✅ Start polling ONLY if token exists
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    fetchBroadcasts(); // initial load

    intervalRef.current = setInterval(() => {
      fetchBroadcasts();
    }, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchBroadcasts]);

  const value = {
    allAlerts,
    globalAlert,
    lang,
    voiceMode,
    soundOn,
    setLang,
    toggleVoice: () => setVoiceMode(v => !v),
    toggleSound: () => setSoundOn(s => !s),
    dismissGlobalAlert: () => setGlobalAlert(null),
    markAlertRead: (id) =>
      setAllAlerts(prev =>
        prev.map(a => (a.id === id ? { ...a, read: true } : a))
      ),
    getUnreadCount: () => allAlerts.filter(a => !a.read).length,
    getCriticalCount: () =>
      allAlerts.filter(a => a.severity === 'CRITICAL' && !a.read).length,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {globalAlert && (
        <GlobalToast
          alert={globalAlert}
          onDismiss={() => setGlobalAlert(null)}
        />
      )}
    </NotificationContext.Provider>
  );
}

/* ---------- Helper Functions ---------- */

function speakText(text, lang) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = lang;
  utt.rate = 0.9;
  window.speechSynthesis.speak(utt);
}

function playBeep(severity) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const freq = severity === 'CRITICAL' ? 1000 : 700;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch { }
}

/* ---------- Toast ---------- */

function GlobalToast({ alert, onDismiss }) {
  return (
    <div
      onClick={onDismiss}
      style={{
        position: "fixed",
        top: 20,
        right: 20,
        background: "#0f1623",
        color: "white",
        padding: "1rem",
        borderRadius: 10,
        border: "2px solid #ef4444",
        zIndex: 9999,
        cursor: "pointer"
      }}
    >
      <strong>{alert.severity}</strong>
      <p style={{ margin: 0 }}>{alert.message}</p>
    </div>
  );
}

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
};