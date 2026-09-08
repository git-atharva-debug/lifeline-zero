// BuildingViewer3D.jsx — Reusable 3D building renderer
// Used by both PhantomMap (user) and IncidentControl (command)

import { useRef, Suspense, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';

const WORLD = 60;
const WALL_H = 5;

// ─── Lights ───
function Lights() {
    return (
        <>
            <ambientLight intensity={0.55} color="#c8d8ff" />
            <directionalLight
                position={[35, 55, 35]} intensity={1.8} castShadow
                shadow-mapSize={[4096, 4096]}
                shadow-camera-left={-50} shadow-camera-right={50}
                shadow-camera-top={50} shadow-camera-bottom={-50}
                shadow-camera-far={300} shadow-bias={-0.0005}
            />
            <directionalLight position={[-25, 20, -25]} intensity={0.35} color="#3355aa" />
            <hemisphereLight skyColor="#2a3a5a" groundColor="#1a1a2e" intensity={0.6} />
        </>
    );
}

function Floor() {
    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[WORLD + 40, WORLD + 40]} />
            <meshStandardMaterial color="#0b1120" roughness={1} />
        </mesh>
    );
}

function InteriorFloor({ bounds }) {
    if (!bounds) return null;
    const { minX, maxX, minZ, maxZ } = bounds;
    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow
            position={[(minX + maxX) / 2, 0.03, (minZ + maxZ) / 2]}>
            <planeGeometry args={[maxX - minX, maxZ - minZ]} />
            <meshStandardMaterial color="#16213e" roughness={0.85} metalness={0.05} />
        </mesh>
    );
}

function WallSeg({ x1, z1, x2, z2, thickness, color }) {
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.1) return null;
    const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    const angle = Math.atan2(dz, dx);
    return (
        <mesh position={[cx, WALL_H / 2, cz]} rotation={[0, -angle, 0]} castShadow receiveShadow>
            <boxGeometry args={[len, WALL_H, thickness]} />
            <meshStandardMaterial color={color} roughness={0.5} metalness={0.1} />
        </mesh>
    );
}

function DoorFrame({ x, z, width, angle }) {
    const frameH = WALL_H * 0.75;
    const frameW = 0.15;
    return (
        <group position={[x, 0, z]} rotation={[0, -angle, 0]}>
            <mesh position={[-width / 2 - frameW / 2, frameH / 2, 0]} castShadow>
                <boxGeometry args={[frameW, frameH, 0.4]} />
                <meshStandardMaterial color="#8B7355" roughness={0.6} />
            </mesh>
            <mesh position={[width / 2 + frameW / 2, frameH / 2, 0]} castShadow>
                <boxGeometry args={[frameW, frameH, 0.4]} />
                <meshStandardMaterial color="#8B7355" roughness={0.6} />
            </mesh>
            <mesh position={[0, frameH + 0.1, 0]} castShadow>
                <boxGeometry args={[width + frameW * 2, 0.2, 0.4]} />
                <meshStandardMaterial color="#8B7355" roughness={0.6} />
            </mesh>
            <mesh position={[-width / 2 + 0.05, frameH / 2, width / 2]} rotation={[0, Math.PI / 4, 0]} castShadow>
                <boxGeometry args={[width, frameH - 0.1, 0.08]} />
                <meshStandardMaterial color="#6B5B3E" roughness={0.7} metalness={0.05} />
            </mesh>
        </group>
    );
}

function WindowFrame({ x, z, width, angle }) {
    const sillH = WALL_H * 0.28;
    const glassH = WALL_H * 0.42;
    return (
        <group position={[x, 0, z]} rotation={[0, -angle, 0]}>
            <mesh position={[0, sillH, 0]}>
                <boxGeometry args={[width, 0.12, 0.5]} />
                <meshStandardMaterial color="#a0a8b0" roughness={0.4} metalness={0.3} />
            </mesh>
            <mesh position={[0, sillH + glassH / 2 + 0.06, 0]}>
                <boxGeometry args={[width - 0.1, glassH, 0.08]} />
                <meshStandardMaterial color="#88aacc" transparent opacity={0.35} metalness={0.5} roughness={0.1} />
            </mesh>
            <mesh position={[0, sillH + glassH + 0.12, 0]}>
                <boxGeometry args={[width, 0.12, 0.5]} />
                <meshStandardMaterial color="#a0a8b0" roughness={0.4} metalness={0.3} />
            </mesh>
            {[-1, 1].map(s => (
                <mesh key={s} position={[s * (width / 2 - 0.05), sillH + glassH / 2 + 0.06, 0]}>
                    <boxGeometry args={[0.1, glassH, 0.5]} />
                    <meshStandardMaterial color="#a0a8b0" roughness={0.4} metalness={0.3} />
                </mesh>
            ))}
        </group>
    );
}

function Marker({ position, type }) {
    const sphRef = useRef();
    const ringRef = useRef();
    useFrame(({ clock }) => {
        const t = clock.elapsedTime;
        if (sphRef.current) sphRef.current.position.y = 1.2 + Math.sin(t * 2.5) * 0.35;
        if (ringRef.current) {
            ringRef.current.scale.setScalar(1 + Math.sin(t * 2) * 0.18);
            ringRef.current.material.opacity = 0.35 + Math.sin(t * 2) * 0.25;
        }
    });
    const cfg = {
        sos: { color: '#ef4444', emissive: '#7f1d1d' },
        exit: { color: '#22c55e', emissive: '#14532d' },
        medical: { color: '#3b82f6', emissive: '#1e3a8a' },
        hazard: { color: '#f97316', emissive: '#7c2d12' },
    }[type] || { color: '#fff', emissive: '#000' };

    return (
        <group position={[position[0], 0, position[2]]}>
            <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
                <ringGeometry args={[0.7, 1.1, 32]} />
                <meshBasicMaterial color={cfg.color} transparent opacity={0.4} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 1.3, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 2.6, 8]} />
                <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.3} />
            </mesh>
            <mesh position={[0, 2.8, 0.05]}>
                <boxGeometry args={[1.6, 0.7, 0.08]} />
                <meshStandardMaterial color={cfg.color} emissive={cfg.emissive} emissiveIntensity={0.6} />
            </mesh>
            <mesh ref={sphRef} castShadow>
                <sphereGeometry args={[0.45, 24, 24]} />
                <meshStandardMaterial color={cfg.color} emissive={cfg.emissive} emissiveIntensity={1} roughness={0.15} metalness={0.5} />
            </mesh>
            <pointLight color={cfg.color} intensity={0.8} distance={5} position={[0, 1.5, 0]} />
        </group>
    );
}

// ─── Compute bounds ──
function getBounds(walls) {
    if (!walls || !walls.length) return null;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const s of walls) {
        minX = Math.min(minX, s.x1, s.x2); maxX = Math.max(maxX, s.x1, s.x2);
        minZ = Math.min(minZ, s.z1, s.z2); maxZ = Math.max(maxZ, s.z1, s.z2);
    }
    return { minX, maxX, minZ, maxZ };
}

// ─── Scene ──
function Scene({ walls, doors, windows, markers, showGrid, bounds }) {
    return (
        <>
            <Lights />
            <Floor />
            <InteriorFloor bounds={bounds} />
            {showGrid && (
                <Grid args={[WORLD + 20, WORLD + 20]} cellSize={2} cellThickness={0.3}
                    cellColor="#1a3050" sectionSize={8} sectionThickness={0.8}
                    sectionColor="#1e4080" fadeDistance={140} position={[0, 0.01, 0]} />
            )}
            {walls.map((s, i) => (
                <WallSeg key={`w${i}`}
                    x1={s.x1} z1={s.z1} x2={s.x2} z2={s.z2}
                    thickness={s.thickness || 0.6}
                    color={s.dir === 'h' ? '#7c6b5a' : '#6b5a4a'}
                />
            ))}
            {(doors || []).map((d, i) => (
                <DoorFrame key={`d${i}`} x={d.x} z={d.z} width={d.width} angle={d.angle} />
            ))}
            {(windows || []).map((win, i) => (
                <WindowFrame key={`win${i}`} x={win.x} z={win.z} width={win.width} angle={win.angle} />
            ))}
            {(markers || []).map((m, i) => (
                <Marker key={`m${i}`} position={m.position} type={m.type} />
            ))}
        </>
    );
}

/**
 * BuildingViewer3D — Renders a 3D building from stored map data.
 *
 * Props:
 *   walls    — array of wall segments
 *   doors    — array of doors
 *   windows  — array of windows
 *   markers  — array of markers
 *   height   — canvas height (default 450)
 *   showGrid — show debug grid
 */
export default function BuildingViewer3D({
    walls = [],
    doors = [],
    windows = [],
    markers = [],
    height = 450,
    showGrid = false,
}) {
    const bounds = useMemo(() => getBounds(walls), [walls]);

    if (!walls.length) {
        return (
            <div style={{
                height, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#060d1a', borderRadius: 12, border: '1px solid #1e2d45',
                color: '#475569', fontSize: '0.85rem',
            }}>
                No building data available
            </div>
        );
    }

    return (
        <div style={{ height, borderRadius: 12, overflow: 'hidden', border: '1px solid #1e2d45', background: '#060d1a' }}>
            <Canvas shadows camera={{ position: [40, 34, 40], fov: 48, near: 0.5, far: 700 }} gl={{ antialias: true }}>
                <Suspense fallback={null}>
                    <Scene walls={walls} doors={doors} windows={windows}
                        markers={markers} showGrid={showGrid} bounds={bounds} />
                    <OrbitControls makeDefault enableDamping dampingFactor={0.06}
                        maxPolarAngle={Math.PI / 2.05} minDistance={5} maxDistance={180}
                        target={[0, 2, 0]} />
                </Suspense>
            </Canvas>
        </div>
    );
}
