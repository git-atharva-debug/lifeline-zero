// src/context/AlertContext.jsx
import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { broadcastAPI } from '../services/api';

// ─── Constants ────────────────────────────────────────────────────────────────
export const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧', voice: 'en-IN' },
  { code: 'hi', label: 'हिंदी',   flag: '🇮🇳', voice: 'hi-IN' },
  { code: 'ta', label: 'தமிழ்',   flag: '🇮🇳', voice: 'ta-IN' },
  { code: 'bn', label: 'বাংলা',   flag: '🇮🇳', voice: 'bn-IN' },
  { code: 'mr', label: 'मराठी',   flag: '🇮🇳', voice: 'mr-IN' },
  { code: 'te', label: 'తెలుగు',  flag: '🇮🇳', voice: 'te-IN' },
  { code: 'gu', label: 'ગુજરાતી', flag: '🇮🇳', voice: 'gu-IN' },
  { code: 'ur', label: 'اردو',    flag: '🇵🇰', voice: 'ur-PK' },
];

export const TRANSLATION_FALLBACK = {
  'FLOOD WARNING: Water levels rising rapidly in your zone. Evacuate immediately to higher ground.': {
    hi: 'बाढ़ की चेतावनी: आपके क्षेत्र में जल स्तर तेज़ी से बढ़ रहा है। तुरंत ऊँची जगह पर जाएँ।',
    ta: 'வெள்ள எச்சரிக்கை: உங்கள் பகுதியில் நீர் மட்டம் வேகமாக உயர்கிறது। உடனடியாக உயரமான இடத்திற்கு செல்லுங்கள்.',
    bn: 'বন্যা সতর্কতা: আপনার অঞ্চলে দ্রুত জলস্তর বাড়ছে। অবিলম্বে উচ্চ স্থানে সরে যান।',
    mr: 'पूर इशारा: तुमच्या भागात पाण्याची पातळी वेगाने वाढत आहे। ताबडतोब उंच ठिकाणी जा.',
    te: 'వరద హెచ్చరిక: మీ ప్రాంతంలో నీటి మట్టం వేగంగా పెరుగుతోంది। వెంటనే ఎత్తైన ప్రదేశానికి వెళ్ళండి.',
    gu: 'પૂર ચેતવણી: તમારા વિસ્તારમાં પાણીની સપાટી ઝડપથી વધી રહી છે। તાત્કાલિક ઊંચી જગ્યાએ જાઓ.',
    ur: 'سیلاب کی تنبیہ: آپ کے علاقے میں پانی کی سطح تیزی سے بڑھ رہی ہے۔ فوری طور پر اونچی جگہ پر جائیں۔',
  },
  'MANDATORY EVACUATION: All residents must evacuate immediately. Rescue teams are deployed.': {
    hi: 'अनिवार्य निकासी: सभी निवासियों को तुरंत निकलना होगा। बचाव दल तैनात हैं।',
    ta: 'கட்டாய வெளியேற்றம்: அனைவரும் உடனடியாக வெளியேற வேண்டும். மீட்புக் குழுக்கள் நிலைநிறுத்தப்பட்டுள்ளன.',
    bn: 'বাধ্যতামূলক উচ্ছেদ: সকল বাসিন্দাদের অবিলম্বে সরে যেতে হবে। উদ্ধারকারী দল মোতায়েন।',
    mr: 'अनिवार्य स्थलांतर: सर्व रहिवाशांनी ताबडतोब स्थलांतर करावे। बचाव पथके तैनात आहेत.',
    te: 'తప్పనిసరి తరలింపు: అందరూ వెంటనే తరలిపోవాలి। రెస్క్యూ బృందాలు మోహరించబడ్డాయి.',
    gu: 'ફરજિયાત સ્થળાંતર: તમામ રહેવાસીઓ તાત્કાલિક ખાલી કરો. બચાવ ટીમો તૈનાત.',
    ur: 'لازمی انخلاء: تمام باشندوں کو فوری طور پر نکلنا ہوگا۔ ریسکیو ٹیمیں تعینات۔',
  },
  'SHELTER IN PLACE: Do not go outside. A hazard has been detected. Seal doors and windows.': {
    hi: 'घर में रहें: बाहर मत जाइए। खतरा पाया गया है। दरवाज़े और खिड़कियाँ बंद करें।',
    ta: 'உள்ளேயே இருங்கள்: வெளியே போகாதீர்கள். ஆபத்து கண்டறியப்பட்டது. கதவுகள் மூடுங்கள்.',
    bn: 'ঘরে থাকুন: বাইরে যাবেন না। বিপদ সনাক্ত হয়েছে। দরজা ও জানালা বন্ধ করুন।',
    mr: 'घरातच राहा: बाहेर जाऊ नका. धोका आढळला. दरवाजे व खिडक्या बंद करा.',
    te: 'ఇంట్లోనే ఉండండి: బయటకు వెళ్ళకండి. ప్రమాదం గుర్తించబడింది. తలుపులు మూయండి.',
    gu: 'ઘરમાં રહો: બહાર ન જાઓ. ખતરો મળ્યો. દરવાજા અને બારીઓ બંધ કરો.',
    ur: 'گھر میں رہیں: باہر مت جائیں۔ خطرہ پایا گیا۔ دروازے اور کھڑکیاں بند کریں۔',
  },
  'ALL CLEAR: The emergency has been resolved. You may return to your homes safely.': {
    hi: 'सब ठीक है: आपातकाल समाप्त। आप सुरक्षित रूप से घर लौट सकते हैं।',
    ta: 'அனைத்தும் தெளிவு: அவசரநிலை தீர்க்கப்பட்டது. பாதுகாப்பாக வீடு திரும்பலாம்.',
    bn: 'সব ঠিক: জরুরি পরিস্থিতি সমাধান। নিরাপদে বাড়িতে ফিরুন।',
    mr: 'सर्व ठीक: आणीबाणी संपली. सुरक्षितपणे घरी परत या.',
    te: 'అంతా సవ్యంగా: అత్యవసర పరిస్థితి పరిష్కరించబడింది. సురక్షితంగా ఇళ్ళకు రండి.',
    gu: 'બધું ઠીક: કટોકટી ઉકેલાઈ. સુરક્షિત રીતે ઘરે પાછા આવો.',
    ur: 'سب ٹھیک: ہنگامی صورتحال حل۔ محفوظ طریقے سے گھر واپس آئیں۔',
  },
  'MEDICAL ALERT: Free medical camps set up at Community Hall. Bring injured persons immediately.': {
    hi: 'चिकित्सा सतर्कता: सामुदायिक हॉल में मोफत चिकित्सा शिविर। घायलों को तुरंत लाएँ।',
    ta: 'மருத்துவ எச்சரிக்கை: சமூக மண்டபத்தில் இலவச முகாம். காயமடைந்தவர்களை அழைத்து வாருங்கள்.',
    bn: 'চিকিৎসা সতর্কতা: কমিউনিটি হলে বিনামূল্যে ক্যাম্প। আহতদের এখনই আনুন।',
    mr: 'वैद्यकीय सतर्कता: सामुदायिक हॉलमध्ये मोफत शिबिर। जखमींना आणा.',
    te: 'వైద్య హెచ్చరిక: కమ్యూనిటీ హాల్‌లో ఉచిత శిబిరం. గాయపడిన వారిని తీసుకు రండి.',
    gu: 'તબીબી ચેતવણી: કોમ્યુનિટી હોલ પર મફત શિબિર. ઇજાગ્રસ્ત વ્યક્તિઓ લાવો.',
    ur: 'طبی انتباہ: کمیونٹی ہال میں مفت کیمپ۔ زخمی افراد فوری لائیں۔',
  },
};

export const STATIC_ALERTS = [
  { id: 'ALT-001', message: 'FLOOD WARNING: Water levels rising rapidly in your zone. Evacuate immediately to higher ground.', severity: 'HIGH', zone: 'Zone 3', sentBy: 'Command Officer Sharma', timestamp: new Date(Date.now() - 1000 * 60 * 8).toISOString(), read: false, pinned: false, voiceEnabled: true },
  { id: 'ALT-002', message: 'MANDATORY EVACUATION: All residents must evacuate immediately. Rescue teams are deployed.', severity: 'CRITICAL', zone: 'Zone 3', sentBy: 'Regional HQ', timestamp: new Date(Date.now() - 1000 * 60 * 22).toISOString(), read: false, pinned: true, voiceEnabled: true },
  { id: 'ALT-003', message: 'MEDICAL ALERT: Free medical camps set up at Community Hall. Bring injured persons immediately.', severity: 'MODERATE', zone: 'All Zones', sentBy: 'NDRF Medical Unit', timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(), read: true, pinned: false, voiceEnabled: false },
  { id: 'ALT-004', message: 'ALL CLEAR: The emergency has been resolved. You may return to your homes safely.', severity: 'LOW', zone: 'Zone 2', sentBy: 'Command Officer Sharma', timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(), read: true, pinned: false, voiceEnabled: false },
];

// ─── Utilities ────────────────────────────────────────────────────────────────
export function getTranslation(alert, lang) {
  if (alert.translations?.[lang]) return alert.translations[lang];
  const enMsg = alert.message || alert.translations?.en || '';
  if (lang !== 'en' && TRANSLATION_FALLBACK[enMsg]?.[lang]) return TRANSLATION_FALLBACK[enMsg][lang];
  return enMsg;
}

export function speakText(text, voiceLang) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  const match = voices.find(v => v.lang === voiceLang || v.lang.startsWith(voiceLang.split('-')[0]));
  if (match) utt.voice = match;
  utt.lang = voiceLang;
  utt.rate = 0.88;
  window.speechSynthesis.speak(utt);
}

export function playBeep(severity) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const freq = severity === 'CRITICAL' ? 1000 : severity === 'HIGH' ? 800 : 600;
    const beeps = severity === 'CRITICAL' ? 4 : 2;
    for (let i = 0; i < beeps; i++) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.35;
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.start(t); osc.stop(t + 0.25);
    }
  } catch { }
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AlertContext = createContext(null);

export function AlertProvider({ children, role }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('rescue_lang') || 'en');
  const [voiceMode, setVoiceModeState] = useState(() => localStorage.getItem('rescue_voice') !== 'false');
  const [soundOn, setSoundOn] = useState(true);
  const [alerts, setAlerts] = useState(STATIC_ALERTS);
  const [toastAlert, setToastAlert] = useState(null);

  // Refs — keep the polling closure always reading the latest values
  const langRef      = useRef(lang);
  const voiceModeRef = useRef(voiceMode);
  const soundOnRef   = useRef(soundOn);
  const roleRef      = useRef(role);       // key fix: role via ref, not stale closure
  const knownIds     = useRef(new Set());
  const initialLoad  = useRef(true);

  useEffect(() => { langRef.current      = lang;      }, [lang]);
  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);
  useEffect(() => { soundOnRef.current   = soundOn;   }, [soundOn]);
  useEffect(() => { roleRef.current      = role;      }, [role]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const setLang = useCallback((code) => {
    setLangState(code);
    localStorage.setItem('rescue_lang', code);
  }, []);

  const setVoiceMode = useCallback((next) => {
    setVoiceModeState(next);
    localStorage.setItem('rescue_voice', String(next));
    if (next) {
      const vl = LANGUAGES.find(l => l.code === langRef.current)?.voice || 'en-IN';
      speakText('Voice alerts are now enabled.', vl);
    } else {
      window.speechSynthesis?.cancel();
    }
  }, []);

  const toggleVoice  = useCallback(() => setVoiceMode(!voiceModeRef.current), [setVoiceMode]);
  const speak        = useCallback((alert) => {
    const vl = LANGUAGES.find(l => l.code === langRef.current)?.voice || 'en-IN';
    speakText(getTranslation(alert, langRef.current), vl);
  }, []);
  const markRead     = useCallback((id) => setAlerts(a => a.map(x => x.id === id ? { ...x, read: !x.read }   : x)), []);
  const togglePin    = useCallback((id) => setAlerts(a => a.map(x => x.id === id ? { ...x, pinned: !x.pinned } : x)), []);
  const deleteAlert  = useCallback((id) => setAlerts(a => a.filter(x => x.id !== id)), []);
  const markAllRead  = useCallback(()   => setAlerts(a => a.map(x => ({ ...x, read: true }))), []);
  const dismissToast = useCallback(()   => setToastAlert(null), []);

  // ── Polling (single interval, lives as long as the app) ──────────────────
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await broadcastAPI.getAll(50);
        if (!res.success || !res.data?.length) return;

        const mapped = res.data.map(b => ({
          id:           b._id,
          message:      b.message,
          severity:     b.severity,
          zone:         b.zone,
          sentBy:       b.sentBy,
          timestamp:    b.createdAt,
          read:         false,
          pinned:       false,
          voiceEnabled: ['CRITICAL', 'HIGH'].includes(b.severity),
        }));

        // First load — seed known IDs silently, no toast/sound
        if (initialLoad.current) {
          initialLoad.current = false;
          mapped.forEach(a => knownIds.current.add(a.id));
          setAlerts(mapped);
          return;
        }

        // Only update state if there are genuinely new alerts
        const brandNew = mapped.filter(a => !knownIds.current.has(a.id));
        if (!brandNew.length) return; // ← nothing new, no setState, no re-render

        brandNew.forEach(a => knownIds.current.add(a.id));

        // Merge preserving local read/pin state
        setAlerts(prev => {
          const prevMap = {};
          prev.forEach(a => { prevMap[a.id] = a; });
          return mapped.map(a => ({
            ...a,
            read:   prevMap[a.id]?.read   ?? a.read,
            pinned: prevMap[a.id]?.pinned ?? a.pinned,
          }));
        });

        // ── Command users get NO toast, sound, or voice ───────────────────
        if (roleRef.current === 'command') return;

        const newest = brandNew[0];

        setToastAlert(newest);
        setTimeout(() => setToastAlert(null), 6000);

        if (soundOnRef.current) playBeep(newest.severity);

        if (voiceModeRef.current && newest.voiceEnabled) {
          const vl = LANGUAGES.find(l => l.code === langRef.current)?.voice || 'en-IN';
          setTimeout(() => speakText(getTranslation(newest, langRef.current), vl), 800);
        }
      } catch (err) {
        console.error('AlertContext poll error:', err);
      }
    };

    poll();
    const iv = setInterval(poll, 10000);
    return () => clearInterval(iv);
  }, []); // empty — single interval, reads everything via refs

  const value = useMemo(() => ({
    lang, setLang,
    voiceMode, toggleVoice, setVoiceMode,
    soundOn, setSoundOn,
    alerts,
    toastAlert,
    markRead, togglePin, deleteAlert, markAllRead,
    speak, dismissToast,
    LANGUAGES, getTranslation,
  }), [lang, voiceMode, soundOn, alerts, toastAlert, setLang, toggleVoice, setVoiceMode, setSoundOn, markRead, togglePin, deleteAlert, markAllRead, speak, dismissToast]);

  return (
    <AlertContext.Provider value={value}>
      {children}
    </AlertContext.Provider>
  );
}

// Throws a clear error if used outside the provider
export function useAlerts() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlerts must be used inside <AlertProvider>');
  return ctx;
}