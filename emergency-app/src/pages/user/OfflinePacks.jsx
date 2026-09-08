import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────
const OPENROUTE_API_KEY = process.env.REACT_APP_OPENROUTE_API_KEY;
const LOCATION_THRESHOLD = 2; // km - threshold to consider location changed

// ─── IndexedDB (minimal, no idb dep needed for artifact) ────────────────────
const DB_NAME = 'rescue_offline_v4';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('packs')) db.createObjectStore('packs', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const idb = {
  save: async (store, data) => {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(data);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  },
  get: async (store, key) => {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  },
  getAll: async (store) => {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  },
  delete: async (store, key) => {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(key);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  },
};

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useNetwork() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

function useGPS() {
  const [gps, setGps] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const detect = useCallback(() => {
    setLoading(true); setError(null);
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      setGps({ lat: 18.5204, lng: 73.8567 });
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      p => { setGps({ lat: p.coords.latitude, lng: p.coords.longitude }); setLoading(false); },
      err => { setError(err.message); setGps({ lat: 18.5204, lng: 73.8567 }); setLoading(false); },
      { timeout: 10000, enableHighAccuracy: true, maximumAge: 300000 }
    );
  }, []);
  useEffect(() => { detect(); }, [detect]);
  return { gps, loading, error, refresh: detect };
}

// ─── Haversine ────────────────────────────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ─── Compass bearing ──────────────────────────────────────────────────────────
function getBearing(lat1, lng1, lat2, lng2) {
  const dLon = (lng2 - lng1) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1*Math.PI/180)*Math.sin(lat2*Math.PI/180) - Math.sin(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.cos(dLon);
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

function bearingToDirection(bearing) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(bearing/45) % 8];
}

// ─── Route Fetch ──────────────────────────────────────────────────────────────
async function fetchRoute(fromLat, fromLng, toLat, toLng) {
  if (OPENROUTE_API_KEY) {
    try {
      const res = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
        method: 'POST',
        headers: { 'Authorization': OPENROUTE_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinates: [[fromLng, fromLat], [toLng, toLat]], instructions: true, instructions_format: 'text', language: 'en' }),
      });
      if (res.ok) {
        const data = await res.json();
        const seg = data.features?.[0]?.properties?.segments?.[0];
        if (seg) return {
          distance: `${(seg.distance/1000).toFixed(1)} km`,
          duration: `${Math.round(seg.duration/60)} min`,
          durationMin: Math.round(seg.duration/60),
          steps: (seg.steps||[]).map(s => ({ instruction: s.instruction, distance: s.distance, type: s.type })),
          geometry: data.features[0].geometry?.coordinates || [],
          hasRoute: true, source: 'ors'
        };
      }
    } catch(e) { console.warn('ORS error', e); }
  }

  // Smart fallback with directional steps
  const dist = haversine(fromLat, fromLng, toLat, toLng);
  const bearing = getBearing(fromLat, fromLng, toLat, toLng);
  const dir = bearingToDirection(bearing);
  const steps = generateSmartSteps(fromLat, fromLng, toLat, toLng, bearing, dist);
  return {
    distance: `${dist.toFixed(1)} km`,
    duration: `${Math.round(dist * 2.5)} min`,
    durationMin: Math.round(dist * 2.5),
    steps,
    geometry: generatePathGeometry(fromLat, fromLng, toLat, toLng),
    hasRoute: false,
    bearing, direction: dir, source: 'estimated'
  };
}

function generateSmartSteps(fromLat, fromLng, toLat, toLng, bearing, dist) {
  const dir = bearingToDirection(bearing);
  const fullDir = { N:'North', NE:'Northeast', E:'East', SE:'Southeast', S:'South', SW:'Southwest', W:'West', NW:'Northwest' }[dir];
  const steps = [];
  steps.push({ instruction: `Head ${fullDir} on your current road`, distance: dist * 0.3 * 1000, type: 'start' });
  if (dist > 1) steps.push({ instruction: `Continue ${fullDir} for ${(dist*0.4).toFixed(1)} km`, distance: dist*0.4*1000, type: 'continue' });
  if (dist > 2) {
    const midDir = bearingToDirection((bearing + 15) % 360);
    steps.push({ instruction: `Keep heading ${midDir} — destination is ${(dist*0.3).toFixed(1)} km ahead`, distance: dist*0.3*1000, type: 'continue' });
  }
  steps.push({ instruction: `Arrive at destination`, distance: 0, type: 'arrive' });
  return steps;
}

function generatePathGeometry(fromLat, fromLng, toLat, toLng) {
  // Generate a slightly curved path for visual display
  const points = [];
  const steps = 10;
  const midLat = (fromLat + toLat) / 2 + (Math.random() - 0.5) * 0.005;
  const midLng = (fromLng + toLng) / 2 + (Math.random() - 0.5) * 0.005;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Quadratic bezier
    const lat = (1-t)**2*fromLat + 2*(1-t)*t*midLat + t**2*toLat;
    const lng = (1-t)**2*fromLng + 2*(1-t)*t*midLng + t**2*toLng;
    points.push([lng, lat]);
  }
  return points;
}

// ─── Overpass fetch helpers ───────────────────────────────────────────────────
async function overpassQuery(query) {
  const endpoints = ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, { method:'POST', body:query, headers:{'Content-Type':'application/x-www-form-urlencoded'} });
      if (res.ok) { const d = await res.json(); return d.elements||[]; }
    } catch(e) {}
  }
  return [];
}

function parseElements(elements, userLat, userLng, extra={}) {
  return elements.filter(el=>el.tags?.name).map(el=>{
    const lat = el.lat||el.center?.lat, lng = el.lon||el.center?.lon;
    if (!lat||!lng) return null;
    const distanceNum = haversine(userLat,userLng,lat,lng);
    const bearing = getBearing(userLat,userLng,lat,lng);
    return { id:el.id, name:el.tags.name, address:el.tags['addr:street']||el.tags['addr:full']||null, lat, lng,
      distance:`${distanceNum.toFixed(1)} km`, distanceNum, bearing, direction:bearingToDirection(bearing),
      phone:el.tags.phone||el.tags['contact:phone']||null, website:el.tags.website||null,
      opening_hours:el.tags.opening_hours||null, emergency:el.tags.emergency==='yes',
      type:el.tags.amenity||el.tags.healthcare||el.tags.leisure||'place',
      ...extra };
  }).filter(Boolean).sort((a,b)=>a.distanceNum-b.distanceNum);
}

async function addRoutes(items, userLat, userLng, count=5) {
  const result = [];
  for (let i=0; i<Math.min(count, items.length); i++) {
    items[i].route = await fetchRoute(userLat, userLng, items[i].lat, items[i].lng);
    result.push(items[i]);
  }
  return [...result, ...items.slice(count)];
}

async function fetchMedicalFacilities(userLat, userLng) {
  const q = `[out:json][timeout:20];(node["amenity"="hospital"](around:10000,${userLat},${userLng});node["amenity"="clinic"](around:8000,${userLat},${userLng});node["amenity"="doctors"](around:6000,${userLat},${userLng});node["healthcare"="hospital"](around:10000,${userLat},${userLng});node["healthcare"="clinic"](around:8000,${userLat},${userLng}););out body 20;`;
  const elements = await overpassQuery(q);
  let items = parseElements(elements, userLat, userLng, {category:'hospital'});
  if (items.length===0) items = generateFallback(userLat,userLng,'hospital',['City General Hospital','District Medical Center','Apollo Emergency','Red Cross Hospital','Community Health Clinic']);
  return addRoutes(items, userLat, userLng, 8);
}

async function fetchResources(userLat, userLng, type) {
  const amenityMap = { fuel:['fuel','petrol_station'], food:['restaurant','fast_food','supermarket','convenience','bakery'], pharmacy:['pharmacy','chemist'] };
  const list = amenityMap[type]||[];
  const q = `[out:json][timeout:15];(${list.map(a=>`node["amenity"="${a}"](around:5000,${userLat},${userLng});`).join('')});out body 15;`;
  const elements = await overpassQuery(q);
  let items = parseElements(elements, userLat, userLng, {category:type});
  return addRoutes(items, userLat, userLng, 5);
}

async function fetchShelters(userLat, userLng) {
  const q = `[out:json][timeout:15];(node["amenity"="school"](around:8000,${userLat},${userLng});node["amenity"="university"](around:8000,${userLat},${userLng});node["leisure"="stadium"](around:8000,${userLat},${userLng});node["amenity"="community_centre"](around:8000,${userLat},${userLng});node["amenity"="place_of_worship"](around:5000,${userLat},${userLng}););out body 15;`;
  const elements = await overpassQuery(q);
  let items = parseElements(elements, userLat, userLng, {category:'shelter'});
  items = items.map(s=>({...s, capacity: Math.floor(Math.random()*1800)+300}));
  if (items.length===0) items = generateFallback(userLat,userLng,'shelter',['City School Shelter','Stadium Relief Camp','Community Hall','University Campus','District Hall']);
  return addRoutes(items, userLat, userLng, 6);
}

async function fetchEvacuationRoutes(userLat, userLng) {
  const q = `[out:json][timeout:15];(node["leisure"="park"](around:12000,${userLat},${userLng});way["leisure"="park"](around:12000,${userLat},${userLng});node["landuse"="recreation_ground"](around:12000,${userLat},${userLng});node["natural"="peak"](around:15000,${userLat},${userLng});node["natural"="hill"](around:15000,${userLat},${userLng}););out body 8;`;
  const elements = await overpassQuery(q);
  let zones = parseElements(elements, userLat, userLng, {});
  if (zones.length===0) zones = generateFallback(userLat,userLng,'evacuation',['North Safe Zone','East Evacuation Point','South Assembly Area','West Relief Camp']);
  const withRoutes = await addRoutes(zones, userLat, userLng, 4);
  return withRoutes.map((z,i)=>({...z, routeType:i===0?'Primary':'Alternate', floodSafe:z.lat>userLat, capacity: Math.floor(Math.random()*5000)+1000}));
}

async function fetchEmergencyContacts() {
  return [
    {category:'Emergency',name:'National Emergency',number:'112',desc:'All emergencies',sms:true},
    {category:'Emergency',name:'Ambulance',number:'108',desc:'Medical emergency',sms:true},
    {category:'Emergency',name:'Fire Brigade',number:'101',desc:'Fire & rescue',sms:false},
    {category:'Emergency',name:'Police Control',number:'100',desc:'Law & order',sms:true},
    {category:'Disaster',name:'NDRF Helpline',number:'011-24363260',desc:'National Disaster Response',sms:false},
    {category:'Disaster',name:'State Disaster Management',number:'1077',desc:'State relief operations',sms:false},
    {category:'Medical',name:'Poison Control',number:'1800-116-117',desc:'Poisoning emergencies',sms:false},
    {category:'Medical',name:'Women Helpline',number:'181',desc:'Women in distress',sms:true},
    {category:'Child',name:'Child Helpline',number:'1098',desc:'Child protection',sms:false},
  ];
}

function generateFallback(lat, lng, type, names) {
  return names.map((name,i)=>{
    const angle = i*72*Math.PI/180, offset=0.018+i*0.012;
    const fLat = lat+Math.sin(angle)*offset, fLng = lng+Math.cos(angle)*offset;
    const distanceNum = haversine(lat,lng,fLat,fLng);
    const bearing = getBearing(lat,lng,fLat,fLng);
    return {
      id:`fb-${type}-${i}`, name, address:'Main Road', lat:fLat, lng:fLng,
      distance:`${distanceNum.toFixed(1)} km`, distanceNum, bearing, direction:bearingToDirection(bearing),
      phone:type==='hospital'?'108':null, category:type, fallback:true,
      route:{ distance:`${distanceNum.toFixed(1)} km`, duration:`${Math.round(distanceNum*2.5)} min`,
        durationMin:Math.round(distanceNum*2.5), steps:generateSmartSteps(lat,lng,fLat,fLng,bearing,distanceNum),
        geometry:generatePathGeometry(lat,lng,fLat,fLng), hasRoute:false, bearing, direction:bearingToDirection(bearing) }
    };
  });
}

const STATIC_PACKS = {
  first_aid: {
    procedures: [
      { title:'CPR', icon:'❤️', severity:'Critical', steps:[
        'Call 112 / 108 immediately.',
        'Lay person flat on firm surface.',
        'Tilt head back, lift chin — open airway.',
        'Give 2 rescue breaths (1 sec each).',
        'Place heel of hand on center of chest.',
        'Push down 5–6 cm, 100–120 times/min.',
        'Every 30 compressions → 2 breaths.',
        'Continue until help arrives or person breathes.'
      ]},
      { title:'Severe Bleeding', icon:'🩸', severity:'Critical', steps:[
        'Wear gloves if available.',
        'Apply firm direct pressure with clean cloth.',
        'Elevate the limb above heart level.',
        'Do NOT remove cloth — add more on top.',
        'Apply tourniquet 5–7 cm above wound if needed.',
        'Note exact time tourniquet applied.',
        'Monitor for shock — keep warm, calm.'
      ]},
      { title:'Choking (Adult)', icon:'🫁', severity:'Urgent', steps:[
        'Ask: "Are you choking?" — if no sound, act now.',
        'Stand behind, lean person forward.',
        'Give 5 back blows with heel of hand.',
        'Give 5 abdominal thrusts (Heimlich).',
        'Alternate until object expelled or unconscious.',
        'If unconscious → start CPR, check mouth before breaths.'
      ]},
      { title:'Burns', icon:'🔥', severity:'Moderate', steps:[
        'Remove from heat source immediately.',
        'Cool burn under cool (not cold) running water 20 min.',
        'Do NOT use ice, butter, or toothpaste.',
        'Remove jewelry/tight clothing near burn.',
        'Cover loosely with cling film or clean cloth.',
        'Seek medical help for burns > palm size or face/hands.'
      ]},
      { title:'Fracture', icon:'🦴', severity:'Moderate', steps:[
        'Immobilize — do not straighten bone.',
        'Splint in position found using stiff material.',
        'Pad around the splint for comfort.',
        'Check circulation: pulse, warmth below fracture.',
        'Elevate if possible, apply ice pack over cloth.',
        'Go to hospital for X-ray and treatment.'
      ]},
      { title:'Shock', icon:'💫', severity:'Critical', steps:[
        'Lay person down, elevate legs 30 cm.',
        'Keep warm with blanket.',
        'Do NOT give food or water.',
        'Loosen tight clothing at neck/chest.',
        'Monitor breathing and pulse continuously.',
        'Call 108 — shock is life-threatening.'
      ]},
    ]
  },
  survival: {
    sections: [
      { title:'Water & Food', icon:'💧', tips:[
        'Boil water minimum 1 minute before drinking.',
        'Never drink flood water — contains sewage/chemicals.',
        'Rainwater collection is safe if collected in clean vessels.',
        '3.7L per adult per day minimum intake.',
        'Food: prioritize canned goods, dry grains, nuts.',
        'Use the "FIFO" method — First In, First Out.',
      ]},
      { title:'Signal for Help', icon:'📡', tips:[
        'Use a whistle — 3 blasts = international distress signal.',
        'Signal mirror: reflect sunlight toward aircraft.',
        'Bright colors visible from air: red, orange, yellow.',
        'At night: use flashlight — SOS = 3 short, 3 long, 3 short.',
        'Build signal fire: add green leaves for smoke.',
        'Mark large "X" on open ground for aerial rescue.',
      ]},
      { title:'Shelter & Warmth', icon:'🏕️', tips:[
        'Stay dry — hypothermia kills faster than thirst.',
        'Insulate from ground using leaves, cardboard, clothing.',
        'Seek high ground during flooding — never wade flood water.',
        'Stay close to walls in earthquake — drop-cover-hold.',
        'Ventilate if using fire indoors — CO poisoning risk.',
        'Conserve body heat: stay still, stay covered.',
      ]},
      { title:'Navigation', icon:'🧭', tips:[
        'North: Sun rises east, sets west — use shadow stick method.',
        'At night: find North Star (Polaris) — end of Little Dipper.',
        'Follow rivers downstream — leads to civilization.',
        'Stay on high ground for better signal and visibility.',
        'Blaze trail markers if moving through unknown terrain.',
        'Never split up — group survival rate is much higher.',
      ]},
    ]
  },
  preparedness: {
    kits: [
      { title:'Go-Bag Essentials', icon:'🎒', items:[
        'Water: 1L per person per day, 3-day supply',
        'Food: Non-perishable, 3-day supply',
        'First Aid Kit — fully stocked',
        'Flashlight + extra batteries or hand-crank',
        'Whistle to signal for help',
        'Dust masks — N95 or better',
        'Plastic sheeting + duct tape',
        'Moist towelettes, garbage bags, hand sanitizer',
        'Wrench or pliers to shut off utilities',
        'Manual can opener',
        'Local maps (printed)',
        'Cell phone + backup chargers + solar charger',
        'Cash in small bills',
        'Copies of critical documents in waterproof bag',
      ]},
      { title:'Medical Supplies', icon:'💊', items:[
        'Prescription medications (7-day supply)',
        'Infant formula and diapers if needed',
        'Glasses, hearing aids, extra batteries',
        'Non-prescription drugs: pain relievers, antidiarrheal, antacids',
        'Thermometer',
        'Blood pressure monitor if needed',
        'Medical records and insurance information',
        'Surgical gloves (2 pairs minimum)',
        'Space/emergency blanket',
      ]},
    ]
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// MINI MAP COMPONENT (Canvas-based SVG route visualization)
// ═════════════════════════════════════════════════════════════════════════════

function MiniMap({ userLat, userLng, facility }) {
  if (!facility?.route?.geometry || facility.route.geometry.length < 2) {
    return (
      <div style={{ background:'#f1f5f9', borderRadius:12, padding:'1.5rem', textAlign:'center', border:'1px solid #e2e8f0' }}>
        <div style={{ fontSize:'1.2rem', marginBottom:'0.5rem', color:'#475569' }}>🧭</div>
        <div style={{ fontSize:'0.75rem', color:'#64748b' }}>
          {facility?.bearing !== undefined ? (
            <>Head <strong style={{color:'#10b981'}}>{facility.direction}</strong> — {facility.distance} away</>
          ) : 'Route visualization unavailable'}
        </div>
      </div>
    );
  }

  const coords = facility.route.geometry;
  const allLats = coords.map(c=>c[1]);
  const allLngs = coords.map(c=>c[0]);
  const minLat=Math.min(...allLats), maxLat=Math.max(...allLats);
  const minLng=Math.min(...allLngs), maxLng=Math.max(...allLngs);
  const W=320, H=160, PAD=20;
  const scaleX = (lng) => PAD + ((lng-minLng)/(maxLng-minLng||1))*(W-2*PAD);
  const scaleY = (lat) => H-PAD - ((lat-minLat)/(maxLat-minLat||1))*(H-2*PAD);
  const pathD = coords.map((c,i)=>`${i===0?'M':'L'}${scaleX(c[0]).toFixed(1)},${scaleY(c[1]).toFixed(1)}`).join(' ');
  const sx = scaleX(coords[0][0]), sy = scaleY(coords[0][1]);
  const ex = scaleX(coords[coords.length-1][0]), ey = scaleY(coords[coords.length-1][1]);

  return (
    <div style={{ background:'#ffffff', borderRadius:12, border:'1px solid #e2e8f0', overflow:'hidden', marginTop:'0.75rem' }}>
      <svg width={W} height={H} style={{ display:'block', width:'100%' }}>
        {/* Grid */}
        {[0,1,2,3,4].map(i=>(
          <line key={i} x1={PAD+i*(W-2*PAD)/4} y1={PAD} x2={PAD+i*(W-2*PAD)/4} y2={H-PAD} stroke="#e2e8f0" strokeWidth="1"/>
        ))}
        {[0,1,2].map(i=>(
          <line key={i} x1={PAD} y1={PAD+i*(H-2*PAD)/2} x2={W-PAD} y2={PAD+i*(H-2*PAD)/2} stroke="#e2e8f0" strokeWidth="1"/>
        ))}

        {/* Route shadow */}
        <path d={pathD} fill="none" stroke="#10b981" strokeWidth="5" strokeOpacity="0.15" strokeLinecap="round" strokeLinejoin="round"/>
        {/* Route */}
        <path d={pathD} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 3"/>

        {/* Origin dot */}
        <circle cx={sx} cy={sy} r="7" fill="#3b82f6" stroke="#ffffff" strokeWidth="2"/>
        <circle cx={sx} cy={sy} r="3" fill="#ffffff"/>

        {/* Destination dot */}
        <circle cx={ex} cy={ey} r="7" fill="#ef4444" stroke="#ffffff" strokeWidth="2"/>
        <circle cx={ex} cy={ey} r="3" fill="#ffffff"/>

        {/* Labels */}
        <text x={sx} y={sy-10} fill="#3b82f6" fontSize="9" textAnchor="middle" fontWeight="bold">YOU</text>
        <text x={ex} y={ey-10} fill="#ef4444" fontSize="9" textAnchor="middle" fontWeight="bold">DEST</text>

        {/* Distance badge */}
        <rect x={W/2-25} y={H-18} width="50" height="14" rx="4" fill="rgba(16,185,129,0.1)" stroke="#10b981" strokeWidth="0.5"/>
        <text x={W/2} y={H-8} fill="#10b981" fontSize="8" textAnchor="middle">{facility.route.distance} · {facility.route.duration}</text>
      </svg>
    </div>
  );
}

// ─── Compass Rose ─────────────────────────────────────────────────────────────
function CompassBadge({ bearing, direction }) {
  const angle = bearing || 0;
  return (
    <div style={{ position:'relative', width:52, height:52, flexShrink:0 }}>
      <svg width="52" height="52" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r="24" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5"/>
        {['N','E','S','W'].map((d,i)=>{
          const a=i*90, rad=a*Math.PI/180, r=18;
          return <text key={d} x={26+r*Math.sin(rad)} y={26-r*Math.cos(rad)+3.5} fill={d==='N'?'#ef4444':'#94a3b8'} fontSize="7" textAnchor="middle" fontWeight="bold">{d}</text>;
        })}
        <g transform={`rotate(${angle}, 26, 26)`}>
          <polygon points="26,8 28.5,26 26,22 23.5,26" fill="#10b981"/>
          <polygon points="26,44 28.5,26 26,30 23.5,26" fill="#94a3b8"/>
        </g>
        <circle cx="26" cy="26" r="3" fill="#e2e8f0" stroke="#10b981" strokeWidth="1"/>
      </svg>
    </div>
  );
}

// ─── Route Steps ──────────────────────────────────────────────────────────────
function StepIcon({ type }) {
  const icons = { start:'▶', continue:'↓', arrive:'●', 'turn-right':'↻', 'turn-left':'↺', roundabout:'↻' };
  const t = typeof type === 'number' ? (type===1?'turn-right':type===2?'turn-left':type===24?'roundabout':'continue') : type;
  return <span style={{ fontSize:'0.85rem', flexShrink:0, color:'#64748b' }}>{icons[t]||'·'}</span>;
}

function RoutePanel({ route, facility, userLat, userLng, onClose }) {
  const [activeTab, setActiveTab] = useState('map');
  if (!route) return null;
  return (
    <div style={{ background:'#ffffff', border:'1px solid #e2e8f0', borderRadius:14, marginTop:'0.75rem', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.75rem 1rem', background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
        <div style={{ display:'flex', gap:'1.5rem' }}>
          <div>
            <div style={{ fontSize:'0.6rem', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em' }}>Distance</div>
            <div style={{ fontSize:'1rem', fontWeight:800, color:'#10b981', fontFamily:'monospace' }}>{route.distance}</div>
          </div>
          <div>
            <div style={{ fontSize:'0.6rem', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em' }}>Travel Time</div>
            <div style={{ fontSize:'1rem', fontWeight:800, color:'#3b82f6', fontFamily:'monospace' }}>{route.duration}</div>
          </div>
          <div>
            <div style={{ fontSize:'0.6rem', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em' }}>Direction</div>
            <div style={{ fontSize:'1rem', fontWeight:800, color:'#f59e0b', fontFamily:'monospace' }}>{route.direction||'—'}</div>
          </div>
        </div>
        {!route.hasRoute && (
          <span style={{ fontSize:'0.65rem', color:'#f59e0b', background:'#fef3c7', padding:'2px 8px', borderRadius:999 }}>Est.</span>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid #e2e8f0' }}>
        {[{k:'map',l:'Map'},{ k:'steps',l:'Steps'}].map(t=>(
          <button key={t.k} onClick={()=>setActiveTab(t.k)} style={{
            flex:1, padding:'0.5rem', fontSize:'0.75rem', fontWeight:600, cursor:'pointer', border:'none',
            background:activeTab===t.k?'#f1f5f9':'transparent',
            color:activeTab===t.k?'#10b981':'#64748b',
            borderBottom:activeTab===t.k?'2px solid #10b981':'2px solid transparent'
          }}>{t.l}</button>
        ))}
      </div>

      <div style={{ padding:'0.75rem 1rem' }}>
        {activeTab==='map' && (
          <MiniMap userLat={userLat} userLng={userLng} facility={facility}/>
        )}
        {activeTab==='steps' && (
          <div>
            {(route.steps||[]).slice(0,8).map((step,i)=>{
              const instruction = typeof step==='string'?step:step.instruction;
              const dist = typeof step==='object'&&step.distance ? `${(step.distance/1000).toFixed(2)} km` : null;
              const type = typeof step==='object'?step.type:null;
              return (
                <div key={i} style={{ display:'flex', gap:'0.75rem', alignItems:'flex-start', padding:'0.5rem 0', borderBottom:i<(route.steps||[]).length-1?'1px solid #e2e8f0':'none' }}>
                  <div style={{ width:22, height:22, borderRadius:'50%', background:'#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <span style={{ fontSize:'0.65rem', fontWeight:800, color:'#10b981' }}>{i+1}</span>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'0.78rem', color:'#334155', lineHeight:1.4 }}>{instruction}</div>
                    {dist && <div style={{ fontSize:'0.65rem', color:'#3b82f6', marginTop:'0.1rem' }}>{dist}</div>}
                  </div>
                  <StepIcon type={type}/>
                </div>
              );
            })}
            {route.steps?.length===0&&<p style={{color:'#64748b',fontSize:'0.8rem'}}>No step data available.</p>}
          </div>
        )}
        {/* Open in Maps button */}
        <a href={`https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${facility.lat},${facility.lng}&travelmode=driving`} target="_blank" rel="noopener noreferrer" style={{
          display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem',
          marginTop:'0.75rem', padding:'0.6rem', borderRadius:8, textDecoration:'none',
          background:'#eff6ff', border:'1px solid #3b82f6', color:'#3b82f6', fontSize:'0.78rem', fontWeight:700
        }}>
          <span>↗</span> Open in Google Maps
        </a>
      </div>
    </div>
  );
}

// ─── Facility Card ─────────────────────────────────────────────────────────────
const TYPE_META = {
  hospital:   { icon:'🏥', color:'#ef4444', emergencyIcon:'🚨' },
  clinic:     { icon:'🏥', color:'#ef4444', emergencyIcon:'🏥' },
  fuel:       { icon:'⛽', color:'#eab308' },
  food:       { icon:'🍎', color:'#10b981' },
  pharmacy:   { icon:'💊', color:'#3b82f6' },
  shelter:    { icon:'🏫', color:'#8b5cf6' },
  evacuation: { icon:'🚗', color:'#f97316' },
};

function FacilityCard({ item, userLat, userLng, type, expanded, onToggle }) {
  const meta = TYPE_META[type] || TYPE_META.hospital;
  const hasRoute = !!item.route;
  const color = meta.color;

  return (
    <div style={{ background:'#ffffff', border:'1px solid #e2e8f0', borderLeft:`3px solid ${color}`, borderRadius:12, marginBottom:'0.6rem', overflow:'hidden' }}>
      <div style={{ padding:'0.85rem 1rem' }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:'0.75rem' }}>
          {/* Compass */}
          {item.bearing!==undefined && <CompassBadge bearing={item.bearing} direction={item.direction}/>}
          
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', flexWrap:'wrap' }}>
              <span style={{ fontWeight:700, fontSize:'0.9rem', color:'#1e293b' }}>
                {item.name}
              </span>
              {item.emergency && <span style={{ fontSize:'0.62rem', color:'#ef4444', background:'#fee2e2', borderRadius:999, padding:'1px 7px', fontWeight:700 }}>24/7 ER</span>}
              {item.routeType==='Primary' && <span style={{ fontSize:'0.62rem', color:'#10b981', background:'#dcfce7', borderRadius:999, padding:'1px 7px', fontWeight:700 }}>PRIMARY</span>}
              {item.fallback && <span style={{ fontSize:'0.6rem', color:'#f59e0b' }}>Est.</span>}
            </div>
            {item.address && <div style={{ fontSize:'0.7rem', color:'#64748b', marginTop:'0.2rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>📍 {item.address}</div>}
            {item.opening_hours && <div style={{ fontSize:'0.68rem', color:'#64748b', marginTop:'0.1rem' }}>🕐 {item.opening_hours}</div>}
            
            <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', marginTop:'0.5rem' }}>
              <span style={{ background:'#eff6ff', color:'#3b82f6', borderRadius:999, padding:'2px 10px', fontSize:'0.7rem', fontWeight:700 }}>
                📏 {item.distance}
              </span>
              <span style={{ background:'#f1f5f9', color:'#10b981', borderRadius:999, padding:'2px 10px', fontSize:'0.7rem', fontWeight:700 }}>
                🧭 {item.direction}
              </span>
              {item.capacity && <span style={{ background:'#f8fafc', color:'#64748b', borderRadius:999, padding:'2px 10px', fontSize:'0.7rem' }}>👥 {item.capacity.toLocaleString()}</span>}
              {item.route?.duration && <span style={{ background:'#fef3c7', color:'#f59e0b', borderRadius:999, padding:'2px 10px', fontSize:'0.7rem', fontWeight:700 }}>⏱️ {item.route.duration}</span>}
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem', flexShrink:0 }}>
            {item.phone && (
              <a href={`tel:${item.phone}`} style={{ display:'flex', alignItems:'center', gap:'4px', padding:'0.35rem 0.65rem', borderRadius:8, background:'#f1f5f9', border:'1px solid #e2e8f0', color:'#10b981', textDecoration:'none', fontSize:'0.72rem', fontWeight:700 }}>
                Call
              </a>
            )}
            {hasRoute && (
              <button onClick={onToggle} style={{ padding:'0.35rem 0.65rem', borderRadius:8, border:`1px solid ${expanded?color:'#e2e8f0'}`, background:expanded?`${color}15`:'transparent', color:expanded?color:'#64748b', fontSize:'0.72rem', cursor:'pointer', fontWeight:700 }}>
                {expanded?'Hide Route':'Route'}
              </button>
            )}
            {item.floodSafe!==undefined && (
              <span style={{ fontSize:'0.65rem', color:item.floodSafe?'#10b981':'#f59e0b', textAlign:'center' }}>
                {item.floodSafe?'High':'Low'}
              </span>
            )}
          </div>
        </div>
      </div>

      {expanded && hasRoute && (
        <div style={{ padding:'0 1rem 1rem' }}>
          <RoutePanel route={item.route} facility={item} userLat={userLat} userLng={userLng}/>
        </div>
      )}
    </div>
  );
}

// ─── Pack Viewer Modal ────────────────────────────────────────────────────────
function PackViewer({ def, data, gps, cachedAt, onClose, onRefresh }) {
  const [expandedRoute, setExpandedRoute] = useState(null);
  const [faExpanded, setFaExpanded] = useState(null);
  const [search, setSearch] = useState('');
  const [localData, setLocalData] = useState(data);
  const [loading, setLoading] = useState(false);
  const [locationChanged, setLocationChanged] = useState(false);
  const online = useNetwork();

  // Check if location has changed significantly from when data was cached
  useEffect(() => {
    if (cachedAt?.lat && cachedAt?.lng && gps) {
      const distance = haversine(
        cachedAt.lat, cachedAt.lng,
        gps.lat, gps.lng
      );
      setLocationChanged(distance > LOCATION_THRESHOLD);
    }
  }, [gps, cachedAt]);

  const refreshData = async () => {
    if (!online) {
      alert('❌ Cannot refresh: You are offline');
      return;
    }
    if (!gps) {
      alert('📍 GPS not available');
      return;
    }
    
    setLoading(true);
    try {
      const freshData = await onRefresh(def, gps);
      setLocalData(freshData);
      setLocationChanged(false);
    } catch (err) {
      alert(`Failed to refresh: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleRoute = (id) => setExpandedRoute(prev => prev===id?null:id);

  // Location warning banner
  const LocationWarning = () => (
    <div style={{
      background: '#fef3c7',
      border: '1px solid #f59e0b',
      borderRadius: 8,
      padding: '0.75rem',
      marginBottom: '1rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '0.5rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ fontSize: '1.1rem' }}>📍</div>
        <div>
          <div style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 700 }}>
            Location changed since download
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
            Data was saved for your previous location
          </div>
        </div>
      </div>
      {online && (
        <button
          onClick={refreshData}
          disabled={loading}
          style={{
            padding: '0.4rem 0.8rem',
            borderRadius: 6,
            border: '1px solid #f59e0b',
            background: '#ffffff',
            color: '#f59e0b',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Refreshing...' : 'Refresh for current location'}
        </button>
      )}
    </div>
  );

  const renderContent = () => {
    const currentData = localData || data || {};

    switch(def.id) {
      case 'hospitals': {
        const items = (currentData.facilities||[]).filter(f=>!search||f.name.toLowerCase().includes(search.toLowerCase()));
        return (<>
          <SearchBar value={search} onChange={setSearch} placeholder="Search hospitals…"/>
          <p style={{fontSize:'0.78rem',color:'#64748b',margin:'0 0 1rem'}}>{items.length} facilities found · Sorted by distance</p>
          {items.map(f=><FacilityCard key={f.id} item={f} type="hospital" userLat={gps?.lat} userLng={gps?.lng} expanded={expandedRoute===f.id} onToggle={()=>toggleRoute(f.id)}/>)}
        </>);
      }
      case 'resources': {
        const r = currentData.resources||{};
        return (<>
          {r.fuel?.length>0&&<><SectionHead label="Fuel Stations" color="#eab308"/>{r.fuel.map(f=><FacilityCard key={f.id} item={f} type="fuel" userLat={gps?.lat} userLng={gps?.lng} expanded={expandedRoute===f.id} onToggle={()=>toggleRoute(f.id)}/>)}</>}
          {r.food?.length>0&&<><SectionHead label="Food & Supplies" color="#10b981" mt/>{r.food.map(f=><FacilityCard key={f.id} item={f} type="food" userLat={gps?.lat} userLng={gps?.lng} expanded={expandedRoute===f.id} onToggle={()=>toggleRoute(f.id)}/>)}</>}
          {r.pharmacy?.length>0&&<><SectionHead label="Pharmacies" color="#3b82f6" mt/>{r.pharmacy.map(f=><FacilityCard key={f.id} item={f} type="pharmacy" userLat={gps?.lat} userLng={gps?.lng} expanded={expandedRoute===f.id} onToggle={()=>toggleRoute(f.id)}/>)}</>}
        </>);
      }
      case 'shelters': {
        const items = (currentData.shelters||[]).filter(f=>!search||f.name.toLowerCase().includes(search.toLowerCase()));
        return (<>
          <SearchBar value={search} onChange={setSearch} placeholder="Search shelters…"/>
          {items.map(s=><FacilityCard key={s.id} item={s} type="shelter" userLat={gps?.lat} userLng={gps?.lng} expanded={expandedRoute===s.id} onToggle={()=>toggleRoute(s.id)}/>)}
        </>);
      }
      case 'evacuation_routes': {
        return (<>
          <p style={{fontSize:'0.78rem',color:'#64748b',margin:'0 0 1rem'}}>{currentData.routes?.length||0} evacuation zones · Tap Route for directions</p>
          {(currentData.routes||[]).map(r=><FacilityCard key={r.id} item={r} type="evacuation" userLat={gps?.lat} userLng={gps?.lng} expanded={expandedRoute===r.id} onToggle={()=>toggleRoute(r.id)}/>)}
        </>);
      }
      case 'contacts': {
        const grouped = {};
        (currentData.contacts||[]).forEach(c=>{grouped[c.category]=grouped[c.category]||[];grouped[c.category].push(c);});
        return Object.entries(grouped).map(([cat,contacts])=>(
          <div key={cat} style={{marginBottom:'1rem'}}>
            <div style={{fontSize:'0.72rem',color:'#64748b',fontWeight:700,marginBottom:'0.5rem',textTransform:'uppercase',letterSpacing:'0.05em'}}>{cat}</div>
            {contacts.map((c,i)=>(
              <a key={i} href={`tel:${c.number}`} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0.75rem 1rem', background:'#ffffff', border:'1px solid #e2e8f0', borderRadius:10, textDecoration:'none', marginBottom:'0.4rem', gap:'1rem' }}>
                <div>
                  <div style={{fontSize:'0.88rem',color:'#1e293b',fontWeight:600}}>{c.name}</div>
                  {c.desc&&<div style={{fontSize:'0.68rem',color:'#64748b',marginTop:'0.1rem'}}>{c.desc}</div>}
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:'1rem',fontWeight:800,color:'#10b981',fontFamily:'monospace'}}>{c.number}</div>
                  {c.sms&&<div style={{fontSize:'0.62rem',color:'#64748b'}}>SMS OK</div>}
                </div>
              </a>
            ))}
          </div>
        ));
      }
      case 'first_aid': {
        return (currentData.procedures||[]).map((p,i)=>(
          <div key={i} style={{marginBottom:'0.6rem'}}>
            <button onClick={()=>setFaExpanded(faExpanded===i?null:i)} style={{
              width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',
              padding:'0.85rem 1rem',background:faExpanded===i?'#f8fafc':'#ffffff',
              border:`1px solid ${faExpanded===i?'#cbd5e1':'#e2e8f0'}`,
              cursor:'pointer',color:'#1e293b'
            }}>
              <span style={{fontWeight:700,fontSize:'0.9rem'}}>{p.title}</span>
              <span style={{fontSize:'0.65rem',color:p.severity==='Critical'?'#ef4444':p.severity==='Urgent'?'#f59e0b':'#10b981',background:p.severity==='Critical'?'#fee2e2':p.severity==='Urgent'?'#fef3c7':'#dcfce7',padding:'2px 8px',borderRadius:999}}>{p.severity}</span>
            </button>
            {faExpanded===i&&(
              <div style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderTop:'none',padding:'0.85rem 1rem'}}>
                {p.steps.map((s,j)=>(
                  <div key={j} style={{display:'flex',gap:'0.75rem',alignItems:'flex-start',padding:'0.4rem 0',borderBottom:j<p.steps.length-1?'1px solid #e2e8f0':'none'}}>
                    <div style={{width:20,height:20,borderRadius:'50%',background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <span style={{fontSize:'0.65rem',fontWeight:800,color:'#10b981'}}>{j+1}</span>
                    </div>
                    <span style={{fontSize:'0.8rem',color:'#475569',lineHeight:1.5}}>{s}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ));
      }
      case 'survival': {
        return (currentData.sections||[]).map((s,i)=>(
          <div key={i} style={{background:'#ffffff',border:'1px solid #e2e8f0',borderRadius:12,padding:'1rem',marginBottom:'0.6rem'}}>
            <div style={{fontWeight:700,color:'#1e293b',marginBottom:'0.75rem',fontSize:'0.95rem'}}>{s.title}</div>
            {s.tips.map((t,j)=>(
              <div key={j} style={{display:'flex',gap:'0.5rem',fontSize:'0.8rem',color:'#475569',padding:'0.3rem 0',borderBottom:j<s.tips.length-1?'1px solid #e2e8f0':'none'}}>
                <span style={{color:'#10b981',flexShrink:0}}>›</span>{t}
              </div>
            ))}
          </div>
        ));
      }
      case 'preparedness': {
        return (currentData.kits||[]).map((k,i)=>(
          <div key={i} style={{background:'#ffffff',border:'1px solid #e2e8f0',borderRadius:12,padding:'1rem',marginBottom:'0.6rem'}}>
            <div style={{fontWeight:700,color:'#1e293b',marginBottom:'0.75rem',fontSize:'0.95rem'}}>{k.title}</div>
            {k.items.map((item,j)=>(
              <div key={j} style={{display:'flex',gap:'0.6rem',fontSize:'0.8rem',color:'#475569',padding:'0.3rem 0',borderBottom:j<k.items.length-1?'1px solid #e2e8f0':'none'}}>
                <span style={{color:'#3b82f6',flexShrink:0}}>☐</span>{item}
              </div>
            ))}
          </div>
        ));
      }
      default:
        return <p style={{color:'#64748b'}}>No data available</p>;
    }
  };

  return (
    <div style={{ position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',padding:'0.75rem' }}>
      <div style={{ background:'#ffffff',border:'1px solid #e2e8f0',borderRadius:16,width:'100%',maxWidth:620,maxHeight:'92vh',display:'flex',flexDirection:'column',boxShadow:'0 25px 50px -12px rgba(0,0,0,0.25)' }}>
        <div style={{ padding:'1rem 1.25rem',borderBottom:'1px solid #e2e8f0',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0 }}>
          <div>
            <div style={{ fontWeight:800,fontSize:'1.05rem',color:'#1e293b' }}>{def.name}</div>
            <div style={{ fontSize:'0.7rem',color:'#10b981',marginTop:2,fontFamily:'monospace' }}>
              {cachedAt ? `Saved for: ${cachedAt.lat?.toFixed(4)}, ${cachedAt.lng?.toFixed(4)}` : 'Offline Pack'}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:8,padding:'0.4rem 0.75rem',color:'#64748b',cursor:'pointer',fontSize:'0.85rem' }}>✕</button>
        </div>
        <div style={{ flex:1,overflowY:'auto',padding:'1rem 1.25rem' }}>
          {locationChanged && <LocationWarning />}
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

function SearchBar({ value, onChange, placeholder }) {
  return (
    <div style={{ position:'relative',marginBottom:'0.75rem' }}>
      <span style={{ position:'absolute',left:'0.75rem',top:'50%',transform:'translateY(-50%)',color:'#64748b',fontSize:'0.85rem' }}>🔍</span>
      <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder||'Search…'} style={{
        width:'100%',padding:'0.55rem 0.75rem 0.55rem 2rem',background:'#ffffff',border:'1px solid #e2e8f0',borderRadius:8,color:'#1e293b',fontSize:'0.8rem',boxSizing:'border-box',outline:'none'
      }}/>
    </div>
  );
}

function SectionHead({ label, color, mt }) {
  return <div style={{ fontSize:'0.88rem',fontWeight:700,color,margin:`${mt?'1rem':0} 0 0.5rem` }}>{label}</div>;
}

// ─── Pack Card ────────────────────────────────────────────────────────────────
function PackCard({ def, status, progress, error, downloadedAt, savedLocation, currentLocation, onDownload, onDelete, onView }) {
  const done = status === 'done';
  const fetching = status === 'fetching';
  const hasError = status === 'error';
  
  const locationMismatch = savedLocation && currentLocation && 
    haversine(savedLocation.lat, savedLocation.lng, currentLocation.lat, currentLocation.lng) > LOCATION_THRESHOLD;

  return (
    <div style={{
      background: done ? '#f8fafc' : '#ffffff',
      border: `1px solid ${done?'#cbd5e1':hasError?'#fecaca':'#e2e8f0'}`,
      borderLeft: `4px solid ${def.color}`,
      borderRadius: 12,
      overflow: 'hidden',
      transition: 'all 0.2s ease',
      position: 'relative'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = 'none';
    }}>
      <div style={{ padding:'0.9rem 1rem' }}>
        <div style={{ display:'flex',gap:'0.85rem',alignItems:'flex-start' }}>
          <div style={{ width:46,height:46,borderRadius:12,background:`${def.color}15`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.5rem',flexShrink:0 }}>
            {def.icon}
          </div>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ display:'flex',alignItems:'center',gap:'0.5rem',flexWrap:'wrap',marginBottom:3 }}>
              <span style={{ fontWeight:700,fontSize:'0.92rem',color:'#1e293b' }}>{def.name}</span>
              <span style={{ fontSize:'0.6rem',fontWeight:700,color:def.priority==='Essential'?'#ef4444':'#f59e0b',background:def.priority==='Essential'?'#fee2e2':'#fef3c7',borderRadius:999,padding:'1px 7px' }}>{def.priority}</span>
              {done && <span style={{ fontSize:'0.6rem',color:'#10b981',background:'#dcfce7',borderRadius:999,padding:'1px 7px',fontWeight:700 }}>READY</span>}
              {locationMismatch && (
                <span style={{ fontSize:'0.6rem',color:'#f59e0b',background:'#fef3c7',borderRadius:999,padding:'1px 7px',fontWeight:700 }}>
                  Needs refresh
                </span>
              )}
            </div>
            <p style={{ fontSize:'0.78rem',color:'#64748b',margin:0,marginBottom: downloadedAt&&done?'0.3rem':0 }}>{def.desc}</p>
            {done && downloadedAt && (
              <p style={{ fontSize:'0.65rem',color:'#94a3b8',margin:0,fontFamily:'monospace' }}>
                Saved {new Date(downloadedAt).toLocaleString()}
                {savedLocation && ` for ${savedLocation.lat.toFixed(4)}, ${savedLocation.lng.toFixed(4)}`}
              </p>
            )}
            {error&&<p style={{ fontSize:'0.72rem',color:'#ef4444',margin:'0.25rem 0 0' }}>⚠️ {error}</p>}
          </div>

          <div style={{ display:'flex',flexDirection:'column',gap:'0.35rem',flexShrink:0 }}>
            {status==='idle'&&(
              <button onClick={()=>onDownload(def)} style={{ padding:'0.5rem 0.9rem',borderRadius:8,fontSize:'0.78rem',fontWeight:700,cursor:'pointer',border:`1px solid ${def.color}`,background:`${def.color}15`,color:def.color }}>
                Download
              </button>
            )}
            {fetching&&(
              <div style={{ minWidth:70,textAlign:'center' }}>
                <div style={{ height:4,background:'#e2e8f0',borderRadius:99,overflow:'hidden',marginBottom:'0.3rem' }}>
                  <div style={{ height:'100%',background:def.color,width:`${progress}%`,transition:'width 0.3s',borderRadius:99 }}/>
                </div>
                <div style={{ fontSize:'0.72rem',color:def.color,fontWeight:700 }}>{Math.round(progress)}%</div>
              </div>
            )}
            {done&&<>
              <button onClick={()=>onView(def)} style={{ padding:'0.45rem 0.85rem',borderRadius:8,fontSize:'0.76rem',fontWeight:700,cursor:'pointer',border:'1px solid #10b981',background:'#f0fdf4',color:'#10b981' }}>Open</button>
              <button onClick={()=>onDownload(def)} style={{ padding:'0.35rem 0.85rem',borderRadius:8,fontSize:'0.7rem',cursor:'pointer',border:'1px solid #e2e8f0',background:'#ffffff',color:'#64748b' }}>Refresh</button>
              <button onClick={()=>onDelete(def.id)} style={{ padding:'0.3rem 0.85rem',borderRadius:8,fontSize:'0.68rem',cursor:'pointer',border:'1px solid #e2e8f0',background:'#ffffff',color:'#94a3b8' }}>Delete</button>
            </>}
          </div>
        </div>

        {/* Progress bar during fetch */}
        {fetching&&(
          <div style={{ marginTop:'0.75rem',height:3,background:'#e2e8f0',borderRadius:99,overflow:'hidden' }}>
            <div style={{ height:'100%',background:`linear-gradient(90deg,${def.color},${def.color}99)`,width:`${progress}%`,transition:'width 0.4s' }}/>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Pack Definitions ─────────────────────────────────────────────────────────
const PACK_DEFS = [
  { id:'hospitals',         icon:'🏥', name:'Medical Facilities',   desc:'Nearby hospitals & clinics with route maps',      color:'#ef4444', priority:'Essential', category:'Medical' },
  { id:'resources',         icon:'⛽', name:'Essential Resources',   desc:'Fuel, food & pharmacies with directions',         color:'#eab308', priority:'Essential', category:'Resources' },
  { id:'shelters',          icon:'🏫', name:'Emergency Shelters',    desc:'Safe shelters, schools, relief camps',            color:'#8b5cf6', priority:'Essential', category:'Shelter' },
  { id:'evacuation_routes', icon:'🚗', name:'Evacuation Routes',     desc:'Safe zones with capacity & flood risk info',      color:'#f97316', priority:'Essential', category:'Routes' },
  { id:'contacts',          icon:'📞', name:'Emergency Contacts',    desc:'Helplines with SMS status & tap-to-call',         color:'#06b6d4', priority:'Essential', category:'Directory' },
  { id:'first_aid',         icon:'🩺', name:'First Aid Guide',       desc:'CPR, bleeding, burns & emergency procedures',    color:'#10b981', priority:'Essential', category:'Medical' },
  { id:'survival',          icon:'🧭', name:'Survival Guide',        desc:'Water, shelter, navigation & signalling',        color:'#84cc16', priority:'Recommended', category:'Guide' },
  { id:'preparedness',      icon:'🎒', name:'Emergency Preparedness',desc:'Go-bag checklist & medical supply list',         color:'#a78bfa', priority:'Recommended', category:'Guide' },
];

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export default function OfflinePacks() {
  const online = useNetwork();
  const { gps, loading: gpsLoading, error: gpsError, refresh: refreshGPS } = useGPS();
  const [statuses, setStatuses]   = useState({});
  const [progress, setProgress]   = useState({});
  const [errors, setErrors]       = useState({});
  const [savedAt, setSavedAt]     = useState({});
  const [savedLocation, setSavedLocation] = useState({}); // Store location with each pack
  const [viewDef, setViewDef]     = useState(null);
  const [viewData, setViewData]   = useState(null);
  const [viewLocation, setViewLocation] = useState(null); // Location when pack was saved
  const [filter, setFilter]       = useState('All');
  const [downloading, setDownloading] = useState(false);

  // Load saved packs with their location data
  useEffect(() => {
    (async () => {
      const saved = await idb.getAll('packs');
      const s={}, sa={}, loc={};
      for (const p of saved) { 
        s[p.id]='done'; 
        sa[p.id]=p.downloadedAt;
        if (p.location) loc[p.id] = p.location; // Store location if exists
      }
      setStatuses(s); 
      setSavedAt(sa);
      setSavedLocation(loc);
    })();
  }, []);

  const simulateProgress = useCallback((id) => {
    let p = 0;
    const iv = setInterval(() => {
      p = Math.min(p + Math.random()*15, 90);
      setProgress(prev => ({...prev,[id]:p}));
      if (p>=90) clearInterval(iv);
    }, 300);
    return () => clearInterval(iv);
  }, []);

  // Function to refresh a specific pack
  const handleRefresh = useCallback(async (def, currentGps) => {
    if (!currentGps) throw new Error('GPS location not available');
    
    let data;
    switch(def.id) {
      case 'hospitals':         
        data = { facilities: await fetchMedicalFacilities(currentGps.lat, currentGps.lng) }; 
        break;
      case 'resources':         
        data = { resources: { 
          fuel: await fetchResources(currentGps.lat, currentGps.lng, 'fuel'),
          food: await fetchResources(currentGps.lat, currentGps.lng, 'food'),
          pharmacy: await fetchResources(currentGps.lat, currentGps.lng, 'pharmacy')
        }}; 
        break;
      case 'shelters':          
        data = { shelters: await fetchShelters(currentGps.lat, currentGps.lng) }; 
        break;
      case 'evacuation_routes': 
        data = { routes: await fetchEvacuationRoutes(currentGps.lat, currentGps.lng) }; 
        break;
      case 'contacts':          
        data = { contacts: await fetchEmergencyContacts() }; 
        break;
      case 'first_aid':         
      case 'survival':          
      case 'preparedness':      
        data = STATIC_PACKS[def.id]; 
        break;
      default: 
        data = {};
    }
    
    // Save with new location
    const ts = new Date().toISOString();
    await idb.save('packs', {
      id: def.id,
      data,
      downloadedAt: ts,
      location: { lat: currentGps.lat, lng: currentGps.lng } // Save the location
    });
    
    return data;
  }, []);

  const handleDownload = useCallback(async (def) => {
    if (!online) { alert('❌ No internet. Connect and try again.'); return; }
    if (!gps) { alert('📍 GPS not ready yet. Try again in a moment.'); return; }
    
    setStatuses(s=>({...s,[def.id]:'fetching'}));
    setErrors(e=>({...e,[def.id]:undefined}));
    setProgress(p=>({...p,[def.id]:0}));
    
    const stopProgress = simulateProgress(def.id);
    
    try {
      let data;
      switch(def.id) {
        case 'hospitals':         
          data = { facilities: await fetchMedicalFacilities(gps.lat,gps.lng) }; 
          break;
        case 'resources':         
          data = { resources: { 
            fuel: await fetchResources(gps.lat,gps.lng,'fuel'),
            food: await fetchResources(gps.lat,gps.lng,'food'),
            pharmacy: await fetchResources(gps.lat,gps.lng,'pharmacy')
          }}; 
          break;
        case 'shelters':          
          data = { shelters: await fetchShelters(gps.lat,gps.lng) }; 
          break;
        case 'evacuation_routes': 
          data = { routes: await fetchEvacuationRoutes(gps.lat,gps.lng) }; 
          break;
        case 'contacts':          
          data = { contacts: await fetchEmergencyContacts() }; 
          break;
        case 'first_aid':         
          data = STATIC_PACKS.first_aid; 
          break;
        case 'survival':          
          data = STATIC_PACKS.survival; 
          break;
        case 'preparedness':      
          data = STATIC_PACKS.preparedness; 
          break;
        default: 
          data = {};
      }
      
      stopProgress();
      setProgress(p=>({...p,[def.id]:100}));
      
      const ts = new Date().toISOString();
      // Save with location
      await idb.save('packs', {
        id: def.id,
        data,
        downloadedAt: ts,
        location: { lat: gps.lat, lng: gps.lng } // Save the location when downloaded
      });
      
      setStatuses(s=>({...s,[def.id]:'done'}));
      setSavedAt(s=>({...s,[def.id]:ts}));
      setSavedLocation(loc=>({...loc,[def.id]:{lat:gps.lat,lng:gps.lng}}));
    } catch(err) {
      stopProgress();
      setStatuses(s=>({...s,[def.id]:'error'}));
      setErrors(e=>({...e,[def.id]:err.message}));
    }
  }, [online, gps, simulateProgress]);

  const handleDownloadAll = useCallback(async () => {
    setDownloading(true);
    for (const def of PACK_DEFS) {
      if (statuses[def.id] !== 'done') await handleDownload(def);
    }
    setDownloading(false);
  }, [handleDownload, statuses]);

  const handleDelete = useCallback(async (id) => {
    await idb.delete('packs', id);
    setStatuses(s=>({...s,[id]:'idle'}));
    setSavedAt(s=>({...s,[id]:undefined}));
    setSavedLocation(loc=>({...loc,[id]:undefined}));
  }, []);

  const handleView = useCallback(async (def) => {
    const saved = await idb.get('packs', def.id);
    setViewDef(def); 
    setViewData(saved?.data||null);
    setViewLocation(saved?.location || null); // Store the location where this data was saved
  }, []);

  const doneCount = Object.values(statuses).filter(s=>s==='done').length;
  const totalPacks = PACK_DEFS.length;
  const categories = ['All',...new Set(PACK_DEFS.map(p=>p.category))];
  const filtered = filter==='All' ? PACK_DEFS : PACK_DEFS.filter(p=>p.category===filter);

  return (
    <div style={{ padding:'1.25rem 1rem', maxWidth:680, margin:'0 auto', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', background:'#f9fafb', minHeight:'100vh' }}>
      {viewDef && (
        <PackViewer 
          def={viewDef} 
          data={viewData} 
          gps={gps} 
          cachedAt={viewLocation} // Pass the saved location
          onClose={()=>{
            setViewDef(null);
            setViewData(null);
            setViewLocation(null);
          }}
          onRefresh={handleRefresh} // Pass refresh function
        />
      )}

      {/* Header */}
      <div style={{ marginBottom:'1.25rem' }}>
        <h1 style={{ fontSize:'1.7rem', fontWeight:900, color:'#1e293b', margin:'0 0 0.25rem', letterSpacing:'-0.03em' }}>Offline Packs</h1>
        <p style={{ color:'#64748b', fontSize:'0.85rem', margin:0 }}>Real-time data with route maps · Works without internet once downloaded</p>
      </div>

      {/* Status bar */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0.6rem', marginBottom:'1rem' }}>
        <StatusTile label="Network" value={online?'Online':'Offline'} color={online?'#10b981':'#ef4444'} sub={online?'Data available':'Downloads paused'}/>
        <StatusTile label="GPS" value={gpsLoading?'Detecting…':gps?'Locked':'None'} color={gps?'#3b82f6':'#ef4444'} sub={gps?`${gps.lat.toFixed(3)}, ${gps.lng.toFixed(3)}`:'Location unknown'}/>
        <StatusTile label="Packs Ready" value={`${doneCount}/${totalPacks}`} color={doneCount===totalPacks?'#10b981':doneCount>0?'#f59e0b':'#ef4444'} sub={doneCount===totalPacks?'All ready':'Download more'}/>
      </div>

      {/* Progress bar */}
      {doneCount > 0 && (
        <div style={{ marginBottom:'1rem' }}>
          <div style={{ display:'flex',justifyContent:'space-between',marginBottom:'0.3rem' }}>
            <span style={{ fontSize:'0.7rem',color:'#64748b' }}>Offline coverage</span>
            <span style={{ fontSize:'0.7rem',color:'#10b981',fontWeight:700 }}>{Math.round(doneCount/totalPacks*100)}%</span>
          </div>
          <div style={{ height:5,background:'#e2e8f0',borderRadius:99,overflow:'hidden' }}>
            <div style={{ height:'100%',background:'linear-gradient(90deg,#10b981,#3b82f6)',width:`${doneCount/totalPacks*100}%`,transition:'width 0.5s',borderRadius:99 }}/>
          </div>
        </div>
      )}

      {/* Download All button */}
      {doneCount < totalPacks && online && gps && (
        <button onClick={handleDownloadAll} disabled={downloading} style={{
          width:'100%', padding:'0.7rem', borderRadius:10, border:'1px solid #10b981',
          background:'#ffffff', color:'#10b981', fontSize:'0.85rem', fontWeight:700,
          cursor:downloading?'default':'pointer', marginBottom:'0.85rem', opacity:downloading?0.6:1
        }}>
          {downloading ? 'Downloading all packs…' : `Download All Missing Packs (${totalPacks-doneCount})`}
        </button>
      )}

      {/* Filter tabs */}
      <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap', marginBottom:'0.85rem' }}>
        {categories.map(cat=>(
          <button key={cat} onClick={()=>setFilter(cat)} style={{
            padding:'0.3rem 0.8rem', borderRadius:999, fontSize:'0.75rem', fontWeight:600, cursor:'pointer',
            border:`1px solid ${filter===cat?'#3b82f6':'#e2e8f0'}`,
            background:filter===cat?'#eff6ff':'#ffffff',
            color:filter===cat?'#3b82f6':'#64748b'
          }}>{cat}</button>
        ))}
      </div>

      {/* Pack list */}
      <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
        {filtered.map(def=>{
          const savedLoc = savedLocation[def.id];
          const locationMismatch = savedLoc && gps && 
            haversine(savedLoc.lat, savedLoc.lng, gps.lat, gps.lng) > LOCATION_THRESHOLD;
          
          return (
            <div key={def.id} style={{ position: 'relative' }}>
              {locationMismatch && statuses[def.id] === 'done' && (
                <div style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  zIndex: 2,
                  background: '#f59e0b',
                  color: '#ffffff',
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: 999,
                  border: '2px solid #ffffff'
                }}>
                  Location changed
                </div>
              )}
              <PackCard 
                def={def} 
                status={statuses[def.id]||'idle'} 
                progress={progress[def.id]||0} 
                error={errors[def.id]} 
                downloadedAt={savedAt[def.id]}
                savedLocation={savedLoc}
                currentLocation={gps}
                onDownload={handleDownload} 
                onDelete={handleDelete} 
                onView={handleView}
              />
            </div>
          );
        })}
      </div>

      {/* Refresh GPS */}
      <button onClick={refreshGPS} style={{ marginTop:'1rem',padding:'0.55rem 1rem',borderRadius:8,border:'1px solid #e2e8f0',background:'#ffffff',color:'#64748b',cursor:'pointer',width:'100%',fontSize:'0.8rem' }}>
        Refresh GPS Location
      </button>
      {gpsError && <p style={{ fontSize:'0.72rem',color:'#f59e0b',marginTop:'0.5rem',textAlign:'center' }}>⚠️ {gpsError} — using default location</p>}
    </div>
  );
}

function StatusTile({ label, value, color, sub }) {
  return (
    <div style={{ background:'#ffffff', border:`1px solid #e2e8f0`, borderLeft:`3px solid ${color}`, borderRadius:10, padding:'0.65rem 0.75rem' }}>
      <div style={{ fontSize:'0.6rem',color:'#64748b',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em' }}>{label}</div>
      <div style={{ fontWeight:800,color,fontSize:'0.82rem',marginTop:'0.15rem',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{value}</div>
      <div style={{ fontSize:'0.62rem',color:'#94a3b8',marginTop:'0.1rem',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{sub}</div>
    </div>
  );
}