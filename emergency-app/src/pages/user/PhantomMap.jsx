import { useRef, useState, useEffect, Suspense, useMemo, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Text } from '@react-three/drei';
import * as THREE from 'three';
import { phantomAPI } from '../../services/api';

// ─── Constants ────────────────────────────────────────────────────────────────
const WORLD = 60;
const WALL_H = 5;

// ─── Enhanced Lights ─────────────────────────────────────────────────────────
function Lights() {
  return (
    <>
      <ambientLight intensity={0.7} color="#ffffff" />
      <directionalLight
        position={[35, 55, 35]} 
        intensity={1.2} 
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-50} 
        shadow-camera-right={50}
        shadow-camera-top={50} 
        shadow-camera-bottom={-50}
        shadow-camera-far={300} 
        shadow-bias={-0.0005}
      />
      <directionalLight position={[-25, 20, -25]} intensity={0.3} color="#88aaff" />
      <hemisphereLight 
        skyColor="#87CEEB" 
        groundColor="#8B7355" 
        intensity={0.5} 
      />
      <pointLight position={[0, 10, 0]} intensity={0.2} color="#ffeedd" />
    </>
  );
}

// ─── Wooden Floor ────────────────────────────────────────────────────────────
function WoodenFloor({ bounds }) {
  if (!bounds) return null;
  const { minX, maxX, minZ, maxZ } = bounds;
  const width = maxX - minX;
  const depth = maxZ - minZ;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;

  // Create wooden plank pattern
  const planks = [];
  const plankWidth = 0.2;
  const plankGap = 0.02;
  const numPlanks = Math.floor(width / (plankWidth + plankGap));
  
  for (let i = 0; i < numPlanks; i++) {
    const x = centerX - width/2 + i * (plankWidth + plankGap) + plankWidth/2;
    planks.push(
      <mesh 
        key={i}
        position={[x, 0.02, centerZ]} 
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[plankWidth, depth]} />
        <meshStandardMaterial 
          color="#8B7355" 
          roughness={0.7} 
          metalness={0.1}
          emissive="#4a3a2a"
          emissiveIntensity={0.1}
        />
      </mesh>
    );
  }

  return (
    <group>
      {/* Base floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[centerX, 0, centerZ]}>
        <planeGeometry args={[width + 2, depth + 2]} />
        <meshStandardMaterial color="#2a1e12" roughness={1} />
      </mesh>
      
      {/* Wooden planks */}
      {planks}
      
      {/* Floor reflection/gloss */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[centerX, 0.03, centerZ]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial 
          color="#8B7355" 
          roughness={0.4} 
          metalness={0.2}
          emissive="#332211"
          emissiveIntensity={0.2}
          transparent
          opacity={0.3}
        />
      </mesh>
    </group>
  );
}

// ─── Enhanced Floor (outside) ─────────────────────────────────────────────────
function OuterFloor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[WORLD + 40, WORLD + 40]} />
      <meshStandardMaterial color="#e5e7eb" roughness={0.9} />
    </mesh>
  );
}

// ─── Enhanced Wall with trim ──────────────────────────────────────────────────
function EnhancedWallSeg({ x1, z1, x2, z2, thickness, color, isInterior = true }) {
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len < 0.1) return null;
  const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
  const angle = Math.atan2(dz, dx);
  
  // Wall colors based on orientation and location
  const wallColor = isInterior ? '#d4c4b4' : '#b8a898';
  const trimColor = '#f0e0d0';
  
  return (
    <group position={[cx, WALL_H / 2, cz]} rotation={[0, -angle, 0]}>
      {/* Main wall */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[len, WALL_H, thickness]} />
        <meshStandardMaterial 
          color={wallColor} 
          roughness={0.6} 
          metalness={0.1}
          emissive="#332211"
          emissiveIntensity={0.05}
        />
      </mesh>
      
      {/* Base trim */}
      <mesh position={[0, -WALL_H/2 + 0.15, thickness/2 + 0.05]} castShadow>
        <boxGeometry args={[len, 0.3, 0.15]} />
        <meshStandardMaterial color={trimColor} roughness={0.4} metalness={0.2} />
      </mesh>
      
      {/* Top trim */}
      <mesh position={[0, WALL_H/2 - 0.15, thickness/2 + 0.05]} castShadow>
        <boxGeometry args={[len, 0.3, 0.15]} />
        <meshStandardMaterial color={trimColor} roughness={0.4} metalness={0.2} />
      </mesh>
      
      {/* Corner trim (if wall is long enough) */}
      {len > 2 && (
        <>
          <mesh position={[-len/2 + 0.15, 0, thickness/2 + 0.05]} castShadow>
            <boxGeometry args={[0.3, WALL_H - 0.6, 0.15]} />
            <meshStandardMaterial color={trimColor} roughness={0.4} metalness={0.2} />
          </mesh>
          <mesh position={[len/2 - 0.15, 0, thickness/2 + 0.05]} castShadow>
            <boxGeometry args={[0.3, WALL_H - 0.6, 0.15]} />
            <meshStandardMaterial color={trimColor} roughness={0.4} metalness={0.2} />
          </mesh>
        </>
      )}
    </group>
  );
}

// ─── Enhanced Door Frame ─────────────────────────────────────────────────────
function EnhancedDoorFrame({ x, z, width, angle, isOpen = true }) {
  const frameH = WALL_H * 0.75;
  const frameW = 0.2;
  const doorColor = '#9b7b5d';
  const frameColor = '#b89b78';
  const handleColor = '#c0a060';
  
  return (
    <group position={[x, 0, z]} rotation={[0, -angle, 0]}>
      {/* Frame */}
      <mesh position={[-width/2 - frameW/2, frameH/2, 0]} castShadow>
        <boxGeometry args={[frameW, frameH, 0.5]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} metalness={0.2} />
      </mesh>
      <mesh position={[width/2 + frameW/2, frameH/2, 0]} castShadow>
        <boxGeometry args={[frameW, frameH, 0.5]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} metalness={0.2} />
      </mesh>
      <mesh position={[0, frameH + 0.1, 0]} castShadow>
        <boxGeometry args={[width + frameW * 2, 0.25, 0.5]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} metalness={0.2} />
      </mesh>
      
      {/* Door panel */}
      <mesh 
        position={[isOpen ? -width/2 + 0.1 : 0, frameH/2, isOpen ? width/2 : 0]} 
        rotation={[0, isOpen ? Math.PI/3 : 0, 0]} 
        castShadow
      >
        <boxGeometry args={[width - 0.1, frameH - 0.1, 0.1]} />
        <meshStandardMaterial 
          color={doorColor} 
          roughness={0.6} 
          metalness={0.2}
          emissive="#4a3a2a"
          emissiveIntensity={0.05}
        />
      </mesh>
      
      {/* Door handle */}
      <mesh 
        position={[isOpen ? -width/2 + 0.2 : width/4, frameH/2, isOpen ? width/2 : 0.1]} 
        castShadow
      >
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color={handleColor} roughness={0.3} metalness={0.6} />
      </mesh>
    </group>
  );
}

// ─── Enhanced Window Frame (for double-line detection) ────────────────────────
function EnhancedWindowFrame({ x, z, width, angle, isDoublePane = true, hasCurtains = true }) {
  const sillH = WALL_H * 0.25;
  const glassH = WALL_H * 0.5;
  const frameColor = '#d0c0b0';
  const glassColor = '#c0d8f0';
  const curtainColor = '#f0e8d8';
  
  // For double-pane windows (two thin lines in the floor plan)
  const paneCount = isDoublePane ? 2 : 1;
  const paneWidth = width / (paneCount + 0.5); // Leave space for mullion
  
  return (
    <group position={[x, 0, z]} rotation={[0, -angle, 0]}>
      {/* Window sill */}
      <mesh position={[0, sillH, 0]} receiveShadow>
        <boxGeometry args={[width, 0.15, 0.6]} />
        <meshStandardMaterial color={frameColor} roughness={0.4} metalness={0.2} />
      </mesh>
      
      {/* Main window frame */}
      <group position={[0, sillH + glassH/2 + 0.1, 0]}>
        {/* Outer frame - horizontal */}
        <mesh position={[0, -glassH/2 - 0.05, 0]} castShadow>
          <boxGeometry args={[width + 0.2, 0.1, 0.6]} />
          <meshStandardMaterial color={frameColor} roughness={0.4} metalness={0.2} />
        </mesh>
        <mesh position={[0, glassH/2 + 0.05, 0]} castShadow>
          <boxGeometry args={[width + 0.2, 0.1, 0.6]} />
          <meshStandardMaterial color={frameColor} roughness={0.4} metalness={0.2} />
        </mesh>
        
        {/* Outer frame - vertical */}
        <mesh position={[-width/2 - 0.1, 0, 0]} castShadow>
          <boxGeometry args={[0.1, glassH + 0.2, 0.6]} />
          <meshStandardMaterial color={frameColor} roughness={0.4} metalness={0.2} />
        </mesh>
        <mesh position={[width/2 + 0.1, 0, 0]} castShadow>
          <boxGeometry args={[0.1, glassH + 0.2, 0.6]} />
          <meshStandardMaterial color={frameColor} roughness={0.4} metalness={0.2} />
        </mesh>
        
        {/* Glass panes */}
        {isDoublePane ? (
          // Double-hung window with two panes
          <>
            {/* Top pane */}
            <mesh position={[-width/4, glassH/4, 0]} receiveShadow>
              <boxGeometry args={[width/2 - 0.15, glassH/2 - 0.1, 0.1]} />
              <meshStandardMaterial 
                color={glassColor} 
                transparent 
                opacity={0.35} 
                metalness={0.5} 
                roughness={0.1}
                emissive="#224466"
                emissiveIntensity={0.1}
              />
            </mesh>
            <mesh position={[width/4, glassH/4, 0]} receiveShadow>
              <boxGeometry args={[width/2 - 0.15, glassH/2 - 0.1, 0.1]} />
              <meshStandardMaterial 
                color={glassColor} 
                transparent 
                opacity={0.35} 
                metalness={0.5} 
                roughness={0.1}
                emissive="#224466"
                emissiveIntensity={0.1}
              />
            </mesh>
            
            {/* Bottom pane */}
            <mesh position={[-width/4, -glassH/4, 0]} receiveShadow>
              <boxGeometry args={[width/2 - 0.15, glassH/2 - 0.1, 0.1]} />
              <meshStandardMaterial 
                color={glassColor} 
                transparent 
                opacity={0.35} 
                metalness={0.5} 
                roughness={0.1}
                emissive="#224466"
                emissiveIntensity={0.1}
              />
            </mesh>
            <mesh position={[width/4, -glassH/4, 0]} receiveShadow>
              <boxGeometry args={[width/2 - 0.15, glassH/2 - 0.1, 0.1]} />
              <meshStandardMaterial 
                color={glassColor} 
                transparent 
                opacity={0.35} 
                metalness={0.5} 
                roughness={0.1}
                emissive="#224466"
                emissiveIntensity={0.1}
              />
            </mesh>
            
            {/* Window mullion (cross) */}
            <mesh position={[0, 0, 0]} castShadow>
              <boxGeometry args={[0.1, glassH - 0.2, 0.15]} />
              <meshStandardMaterial color={frameColor} roughness={0.4} metalness={0.2} />
            </mesh>
            <mesh position={[0, 0, 0]} castShadow>
              <boxGeometry args={[width - 0.2, 0.1, 0.15]} />
              <meshStandardMaterial color={frameColor} roughness={0.4} metalness={0.2} />
            </mesh>
          </>
        ) : (
          // Single pane window
          <mesh position={[0, 0, 0]} receiveShadow>
            <boxGeometry args={[width - 0.2, glassH - 0.2, 0.1]} />
            <meshStandardMaterial 
              color={glassColor} 
              transparent 
              opacity={0.35} 
              metalness={0.5} 
              roughness={0.1}
              emissive="#224466"
              emissiveIntensity={0.1}
            />
          </mesh>
        )}
      </group>
      
      {/* Top frame */}
      <mesh position={[0, sillH + glassH + 0.2, 0]} receiveShadow>
        <boxGeometry args={[width + 0.2, 0.15, 0.6]} />
        <meshStandardMaterial color={frameColor} roughness={0.4} metalness={0.2} />
      </mesh>
      
      {/* Curtains (optional) */}
      {hasCurtains && (
        <>
          <mesh position={[-width/3, sillH + glassH/2 + 0.1, 0.2]} castShadow>
            <boxGeometry args={[width/3, glassH, 0.05]} />
            <meshStandardMaterial color={curtainColor} roughness={0.8} transparent opacity={0.6} />
          </mesh>
          <mesh position={[width/3, sillH + glassH/2 + 0.1, 0.2]} castShadow>
            <boxGeometry args={[width/3, glassH, 0.05]} />
            <meshStandardMaterial color={curtainColor} roughness={0.8} transparent opacity={0.6} />
          </mesh>
        </>
      )}
    </group>
  );
}

// ─── Enhanced Marker with label ───────────────────────────────────────────────
function EnhancedMarker({ position, type, onRemove }) {
  const sphRef = useRef();
  const ringRef = useRef();
  const labelRef = useRef();
  
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (sphRef.current) {
      sphRef.current.position.y = 1.2 + Math.sin(t * 3) * 0.3;
    }
    if (ringRef.current) {
      ringRef.current.scale.setScalar(1 + Math.sin(t * 3) * 0.15);
      ringRef.current.material.opacity = 0.4 + Math.sin(t * 3) * 0.2;
    }
    if (labelRef.current) {
      labelRef.current.position.y = 2.8 + Math.sin(t * 3) * 0.1;
    }
  });
  
  const config = {
    sos: { color: '#ef4444', emissive: '#7f1d1d', label: 'SOS', icon: '🆘' },
    exit: { color: '#22c55e', emissive: '#14532d', label: 'EXIT', icon: '🚪' },
    medical: { color: '#3b82f6', emissive: '#1e3a8a', label: 'MEDICAL', icon: '🏥' },
    hazard: { color: '#f97316', emissive: '#7c2d12', label: 'HAZARD', icon: '⚠️' },
  }[type] || { color: '#ffffff', emissive: '#000000', label: 'POINT', icon: '📍' };

  return (
    <group position={[position[0], 0, position[2]]}>
      {/* Ground ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.8, 1.2, 32]} />
        <meshBasicMaterial color={config.color} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
      
      {/* Pole */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.08, 3, 8]} />
        <meshStandardMaterial color="#c0c0c0" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Base */}
      <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.3, 0.4, 0.2, 8]} />
        <meshStandardMaterial color="#808080" metalness={0.5} roughness={0.5} />
      </mesh>
      
      {/* Floating sphere */}
      <mesh ref={sphRef} position={[0, 1.5, 0]} castShadow>
        <sphereGeometry args={[0.4, 32, 32]} />
        <meshStandardMaterial 
          color={config.color} 
          emissive={config.emissive} 
          emissiveIntensity={1.2}
          roughness={0.2} 
          metalness={0.3}
        />
      </mesh>
      
      {/* Label sign */}
      <group ref={labelRef} position={[0, 2.8, 0]}>
        <mesh castShadow>
          <boxGeometry args={[1.4, 0.5, 0.1]} />
          <meshStandardMaterial color={config.color} emissive={config.emissive} emissiveIntensity={0.5} />
        </mesh>
        <Text
          position={[0, 0, 0.06]}
          fontSize={0.3}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {config.icon} {config.label}
        </Text>
      </group>
      
      {/* Light */}
      <pointLight color={config.color} intensity={1} distance={8} position={[0, 1.5, 0]} />
      
      {/* Remove button (invisible hit area) */}
      {onRemove && (
        <mesh
          position={[0, 2.8, 0.2]}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <boxGeometry args={[1.4, 0.5, 0.1]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}
    </group>
  );
}

// ─── Scene with all enhanced elements ─────────────────────────────────────────
function EnhancedScene({ walls, doors, windows, markers, showGrid, bounds, onRemoveMarker }) {
  return (
    <>
      <Lights />
      <OuterFloor />
      <WoodenFloor bounds={bounds} />
      
      {showGrid && (
        <Grid 
          args={[WORLD + 20, WORLD + 20]} 
          cellSize={2} 
          cellThickness={0.3}
          cellColor="#cbd5e1" 
          sectionSize={8} 
          sectionThickness={0.8}
          sectionColor="#94a3b8" 
          fadeDistance={140} 
          position={[0, 0.01, 0]} 
        />
      )}
      
      {/* Walls */}
      {walls.map((s, i) => (
        <EnhancedWallSeg 
          key={`w${i}`}
          x1={s.x1} 
          z1={s.z1} 
          x2={s.x2} 
          z2={s.z2}
          thickness={s.thickness || 0.6}
          color={s.dir === 'h' ? '#c0b0a0' : '#b0a090'}
          isInterior={true}
        />
      ))}
      
      {/* Doors */}
      {doors.map((d, i) => (
        <EnhancedDoorFrame 
          key={`d${i}`} 
          x={d.x} 
          z={d.z} 
          width={d.width} 
          angle={d.angle}
          isOpen={Math.random() > 0.5}
        />
      ))}
      
      {/* Windows - Enhanced to show double-pane for double-line detection */}
      {windows.map((win, i) => (
        <EnhancedWindowFrame 
          key={`win${i}`} 
          x={win.x} 
          z={win.z} 
          width={win.width} 
          angle={win.angle}
          isDoublePane={win.isDoublePane || true} // Default to double-pane for better visualization
          hasCurtains={Math.random() > 0.3}
        />
      ))}
      
      {/* Markers */}
      {markers.map((m, i) => (
        <EnhancedMarker 
          key={`m${i}`} 
          position={m.position} 
          type={m.type}
          onRemove={onRemoveMarker ? () => onRemoveMarker(i) : undefined}
        />
      ))}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ORIGINAL IMAGE PROCESSING FUNCTIONS (Copied from your code)
// ═══════════════════════════════════════════════════════════════════════════════

// Otsu threshold
function otsu(gray, n) {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < n; i++) hist[Math.round(gray[i])]++;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, maxV = 0, t = 128;
  for (let i = 0; i < 256; i++) {
    wB += hist[i]; if (!wB) continue;
    const wF = n - wB; if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const v = wB * wF * (mB - mF) ** 2;
    if (v > maxV) { maxV = v; t = i; }
  }
  return t;
}

function dilate(src, w, h, r) {
  const dst = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    outer: for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && src[ny * w + nx]) { dst[y * w + x] = 1; break outer; }
    }
  }
  return dst;
}

function erode(src, w, h, r) {
  const dst = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let all = 1;
    outer: for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h || !src[ny * w + nx]) { all = 0; break outer; }
    }
    dst[y * w + x] = all;
  }
  return dst;
}

// Zhang-Suen thinning
function thin(src, w, h) {
  let img = new Uint8Array(src);
  let changed = true;
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      const rem = [];
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        if (!img[y * w + x]) continue;
        const p = [
          img[(y - 1) * w + x], img[(y - 1) * w + (x + 1)], img[y * w + (x + 1)],
          img[(y + 1) * w + (x + 1)], img[(y + 1) * w + x], img[(y + 1) * w + (x - 1)],
          img[y * w + (x - 1)], img[(y - 1) * w + (x - 1)],
        ];
        const B = p.reduce((a, b) => a + b, 0);
        if (B < 2 || B > 6) continue;
        let A = 0; for (let i = 0; i < 8; i++) if (!p[i] && p[(i + 1) % 8]) A++;
        if (A !== 1) continue;
        if (pass === 0) { if (p[0] * p[2] * p[4]) continue; if (p[2] * p[4] * p[6]) continue; }
        else { if (p[0] * p[2] * p[6]) continue; if (p[0] * p[4] * p[6]) continue; }
        rem.push(y * w + x);
      }
      for (const i of rem) { img[i] = 0; changed = true; }
    }
  }
  return img;
}

// ─── Measure wall thickness at a point ───────────────────────────────────────
function measureThickness(binary, w, h, cx, cy, dir) {
  let t = 0;
  if (dir === 'h') {
    for (let dy = -8; dy <= 8; dy++) {
      const ny = cy + dy;
      if (ny >= 0 && ny < h && binary[ny * w + cx]) t++;
    }
  } else {
    for (let dx = -8; dx <= 8; dx++) {
      const nx = cx + dx;
      if (nx >= 0 && nx < w && binary[cy * w + nx]) t++;
    }
  }
  return t;
}

// ─── Snap endpoints to nearby endpoints ──────────────────────────────────────
function snapEndpoints(segs, snapDist = 1.2) {
  // collect all endpoints
  const pts = [];
  for (const s of segs) {
    pts.push({ x: s.x1, z: s.z1, seg: s, end: '1' });
    pts.push({ x: s.x2, z: s.z2, seg: s, end: '2' });
  }
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const dx = pts[i].x - pts[j].x, dz = pts[i].z - pts[j].z;
      if (Math.sqrt(dx * dx + dz * dz) < snapDist) {
        const mx = (pts[i].x + pts[j].x) / 2, mz = (pts[i].z + pts[j].z) / 2;
        if (pts[i].end === '1') { pts[i].seg.x1 = mx; pts[i].seg.z1 = mz; }
        else { pts[i].seg.x2 = mx; pts[i].seg.z2 = mz; }
        if (pts[j].end === '1') { pts[j].seg.x1 = mx; pts[j].seg.z1 = mz; }
        else { pts[j].seg.x2 = mx; pts[j].seg.z2 = mz; }
      }
    }
  }
  return segs;
}

// ─── Enhanced window detection for double-line patterns ───────────────────────
function detectWindows(binary, w, h, scaleX, scaleZ) {
  const windows = [];
  
  // Look for double-line pattern (two parallel thin lines = window)
  // Horizontal windows (double horizontal lines)
  for (let y = 3; y < h - 3; y++) {
    for (let gap = 2; gap <= 8; gap++) { // Allow larger gap for windows
      const y2 = y + gap;
      if (y2 >= h) continue;
      
      let matchLen = 0, startX = -1;
      let doubleLineDetected = false;
      
      for (let x = 0; x < w; x++) {
        const topLine = binary[y * w + x];
        const bottomLine = binary[y2 * w + x];
        const both = topLine && bottomLine;
        
        // Check if space between is clear (no wall pixels)
        let spaceClear = true;
        for (let gy = y + 1; gy < y2; gy++) {
          if (binary[gy * w + x]) { 
            spaceClear = false; 
            break; 
          }
        }
        
        if (both && spaceClear) {
          if (startX < 0) {
            startX = x;
            doubleLineDetected = true;
          }
          matchLen++;
        } else {
          if (matchLen >= w * 0.03 && matchLen <= w * 0.2 && startX >= 0 && doubleLineDetected) {
            // This is a window! Two parallel lines with clear space between
            windows.push({
              x: ((startX + startX + matchLen) / 2 - w / 2) * scaleX,
              z: (h / 2 - (y + y2) / 2) * scaleZ,
              width: matchLen * scaleX,
              angle: 0,
              isDoublePane: true, // Mark as double-pane window
              hasFrame: true
            });
          }
          matchLen = 0; 
          startX = -1;
          doubleLineDetected = false;
        }
      }
      
      // Check at the end of line
      if (matchLen >= w * 0.03 && matchLen <= w * 0.2 && startX >= 0 && doubleLineDetected) {
        windows.push({
          x: ((startX + startX + matchLen) / 2 - w / 2) * scaleX,
          z: (h / 2 - (y + y2) / 2) * scaleZ,
          width: matchLen * scaleX,
          angle: 0,
          isDoublePane: true,
          hasFrame: true
        });
      }
    }
  }

  // Vertical windows (double vertical lines)
  for (let x = 3; x < w - 3; x++) {
    for (let gap = 2; gap <= 8; gap++) {
      const x2 = x + gap;
      if (x2 >= w) continue;
      
      let matchLen = 0, startY = -1;
      let doubleLineDetected = false;
      
      for (let y = 0; y < h; y++) {
        const leftLine = binary[y * w + x];
        const rightLine = binary[y * w + x2];
        const both = leftLine && rightLine;
        
        // Check if space between is clear
        let spaceClear = true;
        for (let gx = x + 1; gx < x2; gx++) {
          if (binary[y * w + gx]) { 
            spaceClear = false; 
            break; 
          }
        }
        
        if (both && spaceClear) {
          if (startY < 0) {
            startY = y;
            doubleLineDetected = true;
          }
          matchLen++;
        } else {
          if (matchLen >= h * 0.03 && matchLen <= h * 0.2 && startY >= 0 && doubleLineDetected) {
            windows.push({
              x: (x - w / 2) * scaleX,
              z: (h / 2 - (startY + startY + matchLen) / 2) * scaleZ,
              width: matchLen * scaleZ,
              angle: Math.PI / 2,
              isDoublePane: true,
              hasFrame: true
            });
          }
          matchLen = 0; 
          startY = -1;
          doubleLineDetected = false;
        }
      }
      
      // Check at the end
      if (matchLen >= h * 0.03 && matchLen <= h * 0.2 && startY >= 0 && doubleLineDetected) {
        windows.push({
          x: (x - w / 2) * scaleX,
          z: (h / 2 - (startY + startY + matchLen) / 2) * scaleZ,
          width: matchLen * scaleZ,
          angle: Math.PI / 2,
          isDoublePane: true,
          hasFrame: true
        });
      }
    }
  }

  // Also look for single-line windows (original detection)
  for (let y = 3; y < h - 3; y++) {
    for (let gap = 2; gap <= 4; gap++) {
      const y2 = y + gap;
      if (y2 >= h) continue;
      
      let matchLen = 0, startX = -1;
      for (let x = 0; x < w; x++) {
        const both = binary[y * w + x] && binary[y2 * w + x];
        if (both) {
          if (startX < 0) startX = x;
          matchLen++;
        } else {
          if (matchLen >= w * 0.02 && matchLen <= w * 0.12 && startX >= 0) {
            // Check if this wasn't already detected as double-pane
            const alreadyExists = windows.some(w => 
              Math.abs(w.x - ((startX + startX + matchLen) / 2 - w / 2) * scaleX) < 1 &&
              Math.abs(w.z - (h / 2 - (y + y2) / 2) * scaleZ) < 1
            );
            
            if (!alreadyExists) {
              windows.push({
                x: ((startX + startX + matchLen) / 2 - w / 2) * scaleX,
                z: (h / 2 - (y + y2) / 2) * scaleZ,
                width: matchLen * scaleX,
                angle: 0,
                isDoublePane: false,
                hasFrame: true
              });
            }
          }
          matchLen = 0; startX = -1;
        }
      }
    }
  }

  // Vertical windows (original)
  for (let x = 3; x < w - 3; x++) {
    for (let gap = 2; gap <= 4; gap++) {
      const x2 = x + gap;
      if (x2 >= w) continue;
      
      let matchLen = 0, startY = -1;
      for (let y = 0; y < h; y++) {
        const both = binary[y * w + x] && binary[y * w + x2];
        if (both) {
          if (startY < 0) startY = y;
          matchLen++;
        } else {
          if (matchLen >= h * 0.02 && matchLen <= h * 0.12 && startY >= 0) {
            // Check if this wasn't already detected as double-pane
            const alreadyExists = windows.some(w => 
              Math.abs(w.x - (x - w / 2) * scaleX) < 1 &&
              Math.abs(w.z - (h / 2 - (startY + startY + matchLen) / 2) * scaleZ) < 1
            );
            
            if (!alreadyExists) {
              windows.push({
                x: (x - w / 2) * scaleX,
                z: (h / 2 - (startY + startY + matchLen) / 2) * scaleZ,
                width: matchLen * scaleZ,
                angle: Math.PI / 2,
                isDoublePane: false,
                hasFrame: true
              });
            }
          }
          matchLen = 0; startY = -1;
        }
      }
    }
  }

  return windows.slice(0, 40); // Allow more windows
}

// ─── Main wall extraction (original) ─────────────────────────────────────
function extractWalls(imageData, w, h) {
  const data = imageData.data;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++)
    gray[i] = data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;

  const t = otsu(gray, w * h);
  const binary = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) binary[i] = gray[i] < t ? 1 : 0;

  const closed = erode(dilate(binary, w, h, 2), w, h, 1);
  const skeleton = thin(closed, w, h);

  const scaleX = WORLD / w, scaleZ = WORLD / h;
  const segs = [];
  const MIN_H = w * 0.015, MIN_V = h * 0.015;

  // Horizontal passes
  for (let y = 0; y < h; y++) {
    let s = -1;
    for (let x = 0; x <= w; x++) {
      const on = x < w && skeleton[y * w + x];
      if (on && s < 0) s = x;
      else if (!on && s >= 0) {
        const len = x - s;
        if (len >= MIN_H) {
          const midX = Math.floor((s + x) / 2);
          let vert = 0;
          for (let dy = -4; dy <= 4; dy++) {
            const ny = y + dy;
            if (ny >= 0 && ny < h && skeleton[ny * w + midX]) vert++;
          }
          if (vert <= 6) {
            const thick = measureThickness(binary, w, h, midX, y, 'h');
            segs.push({
              x1: (s - w / 2) * scaleX, z1: (h / 2 - y) * scaleZ,
              x2: (x - w / 2) * scaleX, z2: (h / 2 - y) * scaleZ,
              dir: 'h',
              thickness: Math.max(0.4, Math.min(1.2, thick * scaleZ * 0.7)),
            });
          }
        }
        s = -1;
      }
    }
  }

  // Vertical passes
  for (let x = 0; x < w; x++) {
    let s = -1;
    for (let y = 0; y <= h; y++) {
      const on = y < h && skeleton[y * w + x];
      if (on && s < 0) s = y;
      else if (!on && s >= 0) {
        const len = y - s;
        if (len >= MIN_V) {
          const midY = Math.floor((s + y) / 2);
          let horiz = 0;
          for (let dx = -4; dx <= 4; dx++) {
            const nx = x + dx;
            if (nx >= 0 && nx < w && skeleton[midY * w + nx]) horiz++;
          }
          if (horiz <= 6) {
            const thick = measureThickness(binary, w, h, x, midY, 'v');
            segs.push({
              x1: (x - w / 2) * scaleX, z1: (h / 2 - s) * scaleZ,
              x2: (x - w / 2) * scaleX, z2: (h / 2 - y) * scaleZ,
              dir: 'v',
              thickness: Math.max(0.4, Math.min(1.2, thick * scaleX * 0.7)),
            });
          }
        }
        s = -1;
      }
    }
  }

  // Merge collinear
  const merged = mergeSegs(segs);
  // Snap corners
  const snapped = snapEndpoints(merged, 1.5);

  const doors = detectDoorArcs(gray, binary, w, h, scaleX, scaleZ);
  const windows = detectWindows(binary, w, h, scaleX, scaleZ); // Use enhanced window detection

  return { walls: snapped, doors, windows, binary, gray };
}

// ─── Merge collinear segments ─────────────────────────────────────────────────
function mergeSegs(segs) {
  const CLOSE = 1.2, used = new Uint8Array(segs.length), out = [];
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    let s = { ...segs[i] }; used[i] = 1;
    for (let j = i + 1; j < segs.length; j++) {
      if (used[j] || segs[j].dir !== s.dir) continue;
      const o = segs[j];
      if (s.dir === 'h' && Math.abs(s.z1 - o.z1) < CLOSE) {
        if (Math.min(s.x2, o.x2) >= Math.max(s.x1, o.x1) - CLOSE) {
          s.x1 = Math.min(s.x1, o.x1); s.x2 = Math.max(s.x2, o.x2); used[j] = 1;
        }
      } else if (s.dir === 'v' && Math.abs(s.x1 - o.x1) < CLOSE) {
        if (Math.min(s.z2, o.z2) >= Math.max(s.z1, o.z1) - CLOSE) {
          s.z1 = Math.min(s.z1, o.z1); s.z2 = Math.max(s.z2, o.z2); used[j] = 1;
        }
      }
    }
    out.push(s);
  }
  return out;
}

function getBounds(walls) {
  if (!walls.length) return null;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const s of walls) {
    minX = Math.min(minX, s.x1, s.x2); maxX = Math.max(maxX, s.x1, s.x2);
    minZ = Math.min(minZ, s.z1, s.z2); maxZ = Math.max(maxZ, s.z1, s.z2);
  }
  return { minX, maxX, minZ, maxZ };
}

// ─── Exit detection ───────────────────────────────────────────────────────────
function findExits(gray, w, h, scaleX, scaleZ) {
  const exits = [], thresh = 160;
  const MIN = Math.floor(w * 0.02), MAX = Math.floor(w * 0.10);
  for (let y = 3; y < h - 3; y++) {
    let dc1 = 0; for (let x = 0; x < w; x++) if (gray[(y - 2) * w + x] <= thresh) dc1++;
    let dc2 = 0; for (let x = 0; x < w; x++) if (gray[(y + 2) * w + x] <= thresh) dc2++;
    if (dc1 < w * 0.04 || dc2 < w * 0.04) continue;
    let gs = -1;
    for (let x = 1; x < w - 1; x++) {
      const bright = gray[y * w + x] > thresh, prev = gray[y * w + (x - 1)] <= thresh;
      if (bright && prev && gs < 0) gs = x;
      if (!bright && gs >= 0) {
        const gl = x - gs;
        if (gl >= MIN && gl <= MAX)
          exits.push({ position: [((gs + x) / 2 - w / 2) * scaleX, 0, (h / 2 - y) * scaleZ], type: 'exit' });
        gs = -1;
      }
    }
  }
  return exits.slice(0, 8);
}

// ─── Detect door arcs (quarter-circle patterns) ───────────────────────────────
function detectDoorArcs(gray, binary, w, h, scaleX, scaleZ) {
  const doors = [];
  const THRESH = 160;
  // Scan for arc-like patterns: a gap in a wall row/col with nearby arc pixels
  // Strategy: find gaps in binary walls, then check if nearby pixels form an arc

  // Horizontal wall gaps
  const wallRows = new Set();
  for (let y = 2; y < h - 2; y++) {
    let darkCount = 0;
    for (let x = 0; x < w; x++) if (binary[y * w + x]) darkCount++;
    if (darkCount > w * 0.06) wallRows.add(y);
  }

  for (const y of wallRows) {
    let gapStart = -1;
    for (let x = 1; x < w - 1; x++) {
      const onWall = binary[y * w + x];
      const wasOn = binary[y * w + (x - 1)];
      if (wasOn && !onWall) gapStart = x;
      if (!wasOn && onWall && gapStart >= 0) {
        const gapW = x - gapStart;
        const MIN = Math.floor(w * 0.015);
        const MAX = Math.floor(w * 0.08);
        if (gapW >= MIN && gapW <= MAX) {
          // Check for arc in gap area (curved pixels below or above)
          const cx = (gapStart + x) / 2;
          let arcPixels = 0;
          const r = gapW;
          for (let ay = y - r; ay <= y + r; ay++) {
            for (let ax = gapStart; ax <= x; ax++) {
              if (ay < 0 || ay >= h) continue;
              const dist = Math.sqrt((ax - gapStart) ** 2 + (ay - y) ** 2);
              if (Math.abs(dist - r / 2) < 3 && binary[ay * w + Math.floor(ax)]) arcPixels++;
            }
          }

          const angle = 0; // horizontal wall → door perpendicular to Z
          doors.push({
            x: (cx - w / 2) * scaleX,
            z: (h / 2 - y) * scaleZ,
            width: gapW * scaleX,
            angle: 0,
            hasArc: arcPixels > 2,
          });
        }
        gapStart = -1;
      }
    }
  }

  // Vertical wall gaps
  const wallCols = new Set();
  for (let x = 2; x < w - 2; x++) {
    let darkCount = 0;
    for (let y = 0; y < h; y++) if (binary[y * w + x]) darkCount++;
    if (darkCount > h * 0.06) wallCols.add(x);
  }

  for (const x of wallCols) {
    let gapStart = -1;
    for (let y = 1; y < h - 1; y++) {
      const onWall = binary[y * w + x];
      const wasOn = binary[(y - 1) * w + x];
      if (wasOn && !onWall) gapStart = y;
      if (!wasOn && onWall && gapStart >= 0) {
        const gapH = y - gapStart;
        const MIN = Math.floor(h * 0.015);
        const MAX = Math.floor(h * 0.08);
        if (gapH >= MIN && gapH <= MAX) {
          const cy = (gapStart + y) / 2;
          doors.push({
            x: (x - w / 2) * scaleX,
            z: (h / 2 - cy) * scaleZ,
            width: gapH * scaleZ,
            angle: Math.PI / 2,
            hasArc: false,
          });
        }
        gapStart = -1;
      }
    }
  }

  return doors.slice(0, 20);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  FIXED IMAGE PROCESSING (Fixed mirroring issue)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Fixed wall extraction with correct orientation ───────────────────────────
function extractWallsFixed(imageData, w, h) {
  // First get walls normally
  const result = extractWalls(imageData, w, h);
  
  // Fix Z-axis mirroring by flipping Z coordinates
  const scaleX = WORLD / w;
  const scaleZ = WORLD / h;
  
  // Flip Z coordinates for all elements
  result.walls = result.walls.map(wall => ({
    ...wall,
    z1: -wall.z1,
    z2: -wall.z2
  }));
  
  result.doors = result.doors.map(door => ({
    ...door,
    z: -door.z
  }));
  
  result.windows = result.windows.map(win => ({
    ...win,
    z: -win.z
  }));
  
  // Fix exits as well
  if (result.exits) {
    result.exits = result.exits.map(exit => ({
      ...exit,
      position: [exit.position[0], exit.position[1], -exit.position[2]]
    }));
  }
  
  return result;
}

// ─── Improved marker placement with snap to walls ─────────────────────────────
function snapToNearestWall(position, walls, maxDistance = 3) {
  let bestDist = Infinity;
  let bestPos = position;
  
  for (const wall of walls) {
    // Calculate distance from point to line segment
    const { x1, z1, x2, z2 } = wall;
    
    const A = position[0] - x1;
    const B = position[2] - z1;
    const C = x2 - x1;
    const D = z2 - z1;
    
    const dot = A * C + B * D;
    const len_sq = C * C + D * D;
    let param = len_sq === 0 ? 0 : dot / len_sq;
    
    let xx, zz;
    if (param < 0) {
      xx = x1;
      zz = z1;
    } else if (param > 1) {
      xx = x2;
      zz = z2;
    } else {
      xx = x1 + param * C;
      zz = z1 + param * D;
    }
    
    const dx = position[0] - xx;
    const dz = position[2] - zz;
    const dist = Math.sqrt(dx * dx + dz * dz);
    
    if (dist < bestDist && dist < maxDistance) {
      bestDist = dist;
      bestPos = [xx, 0, zz];
    }
  }
  
  return bestPos;
}

// ─── Demo data ─────────────────────────────────────────────────────────────────
function buildDemo() {
  const walls = [
    { x1: -25, z1: -20, x2: 25, z2: -20, dir: 'h', thickness: 0.7 },
    { x1: -25, z1: 20, x2: 25, z2: 20, dir: 'h', thickness: 0.7 },
    { x1: -25, z1: -20, x2: -25, z2: 20, dir: 'v', thickness: 0.7 },
    { x1: 25, z1: -20, x2: 25, z2: 20, dir: 'v', thickness: 0.7 },
    { x1: 0, z1: -20, x2: 0, z2: 8, dir: 'v', thickness: 0.6 },
    { x1: -25, z1: 5, x2: 0, z2: 5, dir: 'h', thickness: 0.6 },
    { x1: 0, z1: 5, x2: 25, z2: 5, dir: 'h', thickness: 0.6 },
    { x1: -25, z1: -8, x2: 0, z2: -8, dir: 'h', thickness: 0.6 },
    { x1: 0, z1: -8, x2: 25, z2: -8, dir: 'h', thickness: 0.6 },
    { x1: -12, z1: -8, x2: -12, z2: 5, dir: 'v', thickness: 0.6 },
    { x1: 12, z1: -8, x2: 12, z2: 5, dir: 'v', thickness: 0.6 },
    { x1: -25, z1: 13, x2: 25, z2: 13, dir: 'h', thickness: 0.6 },
    { x1: -8, z1: 13, x2: -8, z2: 20, dir: 'v', thickness: 0.6 },
    { x1: 8, z1: 13, x2: 8, z2: 20, dir: 'v', thickness: 0.6 },
  ];
  const doors = [
    { x: -12, z: 0, width: 2.5, angle: Math.PI / 2, hasArc: true },
    { x: 12, z: 0, width: 2.5, angle: Math.PI / 2, hasArc: true },
    { x: -6, z: -8, width: 2.5, angle: 0, hasArc: true },
    { x: 6, z: -8, width: 2.5, angle: 0, hasArc: true },
    { x: 0, z: 20, width: 3, angle: 0, hasArc: true },
  ];
  const windows = [
    { x: -19, z: -20, width: 4, angle: 0, isDoublePane: true },
    { x: 19, z: -20, width: 4, angle: 0, isDoublePane: true },
    { x: -19, z: 20, width: 4, angle: 0, isDoublePane: true },
    { x: 19, z: 20, width: 4, angle: 0, isDoublePane: true },
    { x: -25, z: -3, width: 4, angle: Math.PI / 2, isDoublePane: true },
    { x: 25, z: -3, width: 4, angle: Math.PI / 2, isDoublePane: true },
    { x: -8, z: 5, width: 3, angle: 0, isDoublePane: false },
    { x: 8, z: 5, width: 3, angle: 0, isDoublePane: false },
  ];
  return { walls, doors, windows };
}

const DEMO_MARKERS = [
  { position: [-20, 0, 18], type: 'exit' },
  { position: [20, 0, 18], type: 'exit' },
  { position: [0, 0, 0], type: 'medical' },
  { position: [-8, 0, -14], type: 'sos' },
  { position: [14, 0, 10], type: 'hazard' },
];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PhantomMap() {
  const demo = buildDemo();
  const [walls, setWalls] = useState(demo.walls);
  const [doors, setDoors] = useState(demo.doors);
  const [windows, setWindows] = useState(demo.windows);
  const [markers, setMarkers] = useState(DEMO_MARKERS);
  const [showGrid, setShowGrid] = useState(true);
  const [mode, setMode] = useState('demo');
  const [info, setInfo] = useState('Demo building — upload a 2D floor plan');
  const [preview, setPreview] = useState(null);
  const [bounds, setBounds] = useState(getBounds(demo.walls));
  const fileRef = useRef();
  const [selectedMarkerType, setSelectedMarkerType] = useState(null);

  // ── Save state ──
  const [floorplanFile, setFloorplanFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveError, setSaveError] = useState('');
  const [activeMapId, setActiveMapId] = useState(null);

  // ── Load existing active map on mount ──
  useEffect(() => {
    const loadActive = async () => {
      try {
        const res = await phantomAPI.getActive();
        if (res.data) {
          setActiveMapId(res.data._id);
          console.log('[PhantomMap] Active map loaded:', res.data._id);
        }
      } catch {
        // No active map yet — that's fine
      }
    };
    loadActive();
  }, []);

  // ── Save to backend ──
  const saveToBackend = useCallback(async (file, wallsData, markersData, doorsData, windowsData) => {
    if (!file) return;
    setSaving(true);
    setSaveMsg('');
    setSaveError('');

    try {
      const formData = new FormData();
      formData.append('floorplan', file);
      formData.append('walls', JSON.stringify(wallsData));
      formData.append('markers', JSON.stringify(markersData));
      formData.append('doors', JSON.stringify(doorsData));
      formData.append('windows', JSON.stringify(windowsData));

      const res = await phantomAPI.upload(formData);
      setActiveMapId(res.data._id);
      setSaveMsg('✅ House layout saved successfully!');
      console.log('[PhantomMap] Saved map:', res.data._id);
    } catch (err) {
      console.error('[PhantomMap] Save failed:', err);
      setSaveError(err.message || 'Failed to save layout.');
    } finally {
      setSaving(false);
    }
  }, []);

  const handleUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    setFloorplanFile(file);
    setMode('processing');
    setInfo('Running wall + door + window detection...');
    const url = URL.createObjectURL(file);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(url);
    setSaveMsg(''); setSaveError('');

    const img = new Image();
    img.onload = () => {
      const MAX = 700;
      const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
      const w = Math.floor(img.width * ratio), h = Math.floor(img.height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.filter = 'grayscale(100%) contrast(220%) brightness(115%)';
      ctx.drawImage(img, 0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h);

      // Use fixed extraction to avoid mirroring
      const { walls: detectedWalls, doors: detectedDoors, windows: detectedWins, gray } =
        extractWallsFixed(imgData, w, h);

      const exits = findExits(gray, w, h, WORLD / w, WORLD / h).map(exit => ({
        ...exit,
        position: [exit.position[0], exit.position[1], -exit.position[2]] // Fix Z for exits too
      }));

      if (detectedWalls.length >= 4) {
        setWalls(detectedWalls);
        setDoors(detectedDoors);
        setWindows(detectedWins);
        setBounds(getBounds(detectedWalls));
        const newMarkers = [...exits, { position: [0, 0, 0], type: 'medical' }];
        setMarkers(newMarkers);
        setMode('uploaded');
        setInfo(
          `✅ ${detectedWalls.length} walls · ${detectedDoors.length} doors · ` +
          `${detectedWins.length} windows · ${exits.length} exits`
        );

        // Auto-save to backend
        saveToBackend(file, detectedWalls, newMarkers, detectedDoors, detectedWins);
      } else {
        setWalls(demo.walls); setDoors(demo.doors);
        setWindows(demo.windows); setMarkers(DEMO_MARKERS);
        setBounds(getBounds(demo.walls));
        setMode('demo');
        setInfo('⚠️ Detection unclear — use a high-contrast 2D black-on-white plan');
      }
    };
    img.src = url;
  };

  // ── Manual re-save ──
  const handleManualSave = () => {
    if (!floorplanFile) { setSaveError('Upload a floor plan first.'); return; }
    if (mode !== 'uploaded') { setSaveError('Process a floor plan before saving.'); return; }
    saveToBackend(floorplanFile, walls, markers, doors, windows);
  };

  // ── Improved marker placement with snap to walls ──
  const addMarker = (type) => {
    if (!bounds) return;
    
    // Try to place marker near walls for better visibility
    let attempts = 0;
    let bestPos = null;
    
    while (attempts < 20 && !bestPos) {
      const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
      const z = bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ);
      const pos = [x, 0, z];
      const snapped = snapToNearestWall(pos, walls, 2.5);
      
      // Check if snapped position is different from original (meaning it's near a wall)
      if (snapped[0] !== pos[0] || snapped[2] !== pos[2]) {
        bestPos = snapped;
      }
      attempts++;
    }
    
    // If no wall found, place in center of a random room
    if (!bestPos) {
      bestPos = [
        bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
        0,
        bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ)
      ];
    }
    
    setMarkers(p => [...p, { position: bestPos, type }]);
  };

  const removeMarker = (index) => {
    setMarkers(p => p.filter((_, i) => i !== index));
  };

  const resetDemo = () => {
    const d = buildDemo();
    setWalls(d.walls); setDoors(d.doors); setWindows(d.windows);
    setMarkers(DEMO_MARKERS); setBounds(getBounds(d.walls));
    setMode('demo'); setInfo('Demo building loaded'); setPreview(null);
    setFloorplanFile(null); setSaveMsg(''); setSaveError('');
  };

  return (
    <div style={{ padding: '2rem', background: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ 
            fontSize: '2rem', 
            marginBottom: '0.5rem', 
            color: '#1e293b',
            fontWeight: 700,
            letterSpacing: '-0.02em'
          }}>
            Phantom Map
          </h1>
          <p style={{ color: '#64748b', fontSize: '1rem' }}>Upload a 2D floor plan — walls, doors and windows auto-detected with improved accuracy.</p>
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <button 
            onClick={() => fileRef.current.click()} 
            style={{
              padding: '0.6rem 1.2rem',
              borderRadius: '8px',
              background: '#3b82f6',
              color: '#ffffff',
              border: 'none',
              fontSize: '0.9rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#2563eb'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#3b82f6'}
          >
            Upload Floor Plan
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />
          
          <button 
            onClick={resetDemo}
            style={{
              padding: '0.6rem 1.2rem',
              borderRadius: '8px',
              background: '#ffffff',
              color: '#64748b',
              border: '1px solid #e2e8f0',
              fontSize: '0.9rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f8fafc';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#ffffff';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
          >
            Demo
          </button>
          
          <button 
            onClick={() => setShowGrid(g => !g)}
            style={{
              padding: '0.6rem 1.2rem',
              borderRadius: '8px',
              background: '#ffffff',
              color: '#64748b',
              border: '1px solid #e2e8f0',
              fontSize: '0.9rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f8fafc';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#ffffff';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
          >
            {showGrid ? 'Hide Grid' : 'Show Grid'}
          </button>
          
          <button 
            onClick={() => setMarkers([])}
            style={{
              padding: '0.6rem 1.2rem',
              borderRadius: '8px',
              background: '#ffffff',
              color: '#64748b',
              border: '1px solid #e2e8f0',
              fontSize: '0.9rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f8fafc';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#ffffff';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
          >
            Clear Markers
          </button>
          
          {mode === 'uploaded' && floorplanFile && (
            <button
              style={{
                padding: '0.6rem 1.2rem',
                borderRadius: '8px',
                background: saving ? '#94a3b8' : '#10b981',
                color: '#ffffff',
                border: 'none',
                fontSize: '0.9rem',
                fontWeight: 500,
                cursor: saving ? 'default' : 'pointer',
                opacity: saving ? 0.6 : 1,
                transition: 'all 0.2s'
              }}
              onClick={handleManualSave}
              disabled={saving}
              onMouseEnter={(e) => {
                if (!saving) e.currentTarget.style.background = '#059669';
              }}
              onMouseLeave={(e) => {
                if (!saving) e.currentTarget.style.background = '#10b981';
              }}
            >
              {saving ? 'Saving...' : 'Save Layout'}
            </button>
          )}
        </div>

        {/* Marker adder */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center' }}>
          <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>Add Marker:</span>
          {[
            { type: 'sos', label: 'SOS', color: '#ef4444' },
            { type: 'exit', label: 'Exit', color: '#22c55e' },
            { type: 'medical', label: 'Aid', color: '#3b82f6' },
            { type: 'hazard', label: 'Hazard', color: '#f97316' },
          ].map(m => (
            <button 
              key={m.type} 
              onClick={() => {
                setSelectedMarkerType(m.type);
                addMarker(m.type);
              }}
              style={{
                padding: '0.4rem 1rem',
                borderRadius: '999px',
                border: `1px solid ${m.color}`,
                background: selectedMarkerType === m.type ? m.color : '#ffffff',
                color: selectedMarkerType === m.type ? '#ffffff' : m.color,
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (selectedMarkerType !== m.type) {
                  e.currentTarget.style.background = `${m.color}15`;
                }
              }}
              onMouseLeave={(e) => {
                if (selectedMarkerType !== m.type) {
                  e.currentTarget.style.background = '#ffffff';
                }
              }}
            >{m.label}</button>
          ))}
          <span style={{ color: '#94a3b8', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
            Markers snap to walls
          </span>
        </div>

        {/* Status info */}
        <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem', padding: '0.5rem 0' }}>
          {mode === 'processing' ? '⏳ Detecting walls, doors, windows...' : info}
          {mode !== 'processing' && ` · ${walls.length} walls · ${doors.length} doors · ${windows.length} windows`}
        </div>

        {/* Main layout */}
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          {/* 3D Canvas */}
          <div style={{ 
            flex: 1, 
            height: 600, 
            borderRadius: 16, 
            overflow: 'hidden', 
            border: '1px solid #e2e8f0',
            background: '#1e293b',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)'
          }}>
            {mode === 'processing' ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: '#f1f5f9' }}>
                <div style={{ fontSize: '2.5rem' }}>⚙️</div>
                <div>Running enhanced detection...</div>
                <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>May take a few seconds for large images</div>
              </div>
            ) : (
              <Canvas shadows camera={{ position: [40, 34, 40], fov: 48, near: 0.5, far: 700 }} gl={{ antialias: true, alpha: false }}>
                <color attach="background" args={['#1e293b']} />
                <Suspense fallback={null}>
                  <EnhancedScene 
                    walls={walls} 
                    doors={doors} 
                    windows={windows}
                    markers={markers} 
                    showGrid={showGrid} 
                    bounds={bounds}
                    onRemoveMarker={removeMarker}
                  />
                  <OrbitControls 
                    makeDefault 
                    enableDamping 
                    dampingFactor={0.06}
                    maxPolarAngle={Math.PI / 2.1} 
                    minDistance={5} 
                    maxDistance={180}
                    target={[0, 2, 0]} 
                  />
                </Suspense>
              </Canvas>
            )}
          </div>

          {/* Side panel */}
          <div style={{ width: 260, display: 'flex', flexDirection: 'column', gap: '1rem', flexShrink: 0 }}>
            
            {/* Preview card */}
            {preview && (
              <div style={{ 
                background: '#ffffff', 
                border: '1px solid #e2e8f0', 
                borderRadius: 16, 
                padding: '1rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Uploaded Plan</p>
                <img src={preview} alt="floor plan" style={{ width: '100%', borderRadius: 8, border: '1px solid #e2e8f0' }} />
              </div>
            )}

            {/* Save Status */}
            {(saving || saveMsg || saveError) && (
              <div style={{ 
                background: '#ffffff', 
                border: '1px solid #e2e8f0', 
                borderRadius: 16, 
                padding: '1rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                borderTop: `3px solid ${saveError ? '#ef4444' : '#10b981'}`
              }}>
                <p style={{ fontSize: '0.75rem', color: saveError ? '#ef4444' : '#10b981', marginBottom: '0.5rem', fontWeight: 700 }}>
                  {saving ? 'Saving...' : saveError ? 'Save Error' : 'Saved'}
                </p>
                {saving && (
                  <p style={{ fontSize: '0.75rem', color: '#64748b' }}>Uploading to cloud...</p>
                )}
                {saveMsg && <p style={{ fontSize: '0.75rem', color: '#10b981' }}>{saveMsg}</p>}
                {saveError && <p style={{ fontSize: '0.75rem', color: '#ef4444' }}>{saveError}</p>}
                {activeMapId && !saving && (
                  <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                    Active Map: #{activeMapId.slice(-6).toUpperCase()}
                  </p>
                )}
              </div>
            )}

            {/* Legend */}
            <div style={{ 
              background: '#ffffff', 
              border: '1px solid #e2e8f0', 
              borderRadius: 16, 
              padding: '1.25rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '1rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Legend</p>
              {[
                { color: '#ef4444', label: 'SOS Point' },
                { color: '#22c55e', label: 'Exit Route' },
                { color: '#3b82f6', label: 'Aid Station' },
                { color: '#f97316', label: 'Hazard' },
                { color: '#d4c4b4', label: 'Walls' },
                { color: '#9b7b5d', label: 'Doors' },
                { color: '#c0d8f0', label: 'Windows' },
                { color: '#8B7355', label: 'Wooden Floor' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: '0.8rem' }}>
                  <div style={{ width: 14, height: 14, borderRadius: 4, background: l.color, flexShrink: 0 }} />
                  <span style={{ color: '#334155' }}>{l.label}</span>
                </div>
              ))}
            </div>
            
            {/* Controls */}
            <div style={{ 
              background: '#ffffff', 
              border: '1px solid #e2e8f0', 
              borderRadius: 16, 
              padding: '1.25rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Controls</p>
              <div style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.8 }}>
                <p>🖱️ Left drag — rotate</p>
                <p>🖱️ Scroll — zoom</p>
                <p>🖱️ Right drag — pan</p>
                <p>🖱️ Click marker — remove</p>
              </div>
            </div>
            
            {/* Window Features */}
            <div style={{ 
              background: '#ffffff', 
              border: '1px solid #e2e8f0', 
              borderRadius: 16, 
              padding: '1.25rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Window Features</p>
              <div style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.8 }}>
                <p>✓ Double-pane windows</p>
                <p>✓ Glass with reflection</p>
                <p>✓ Window frames & sills</p>
                <p>✓ Optional curtains</p>
                <p>✓ Cross mullions</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}