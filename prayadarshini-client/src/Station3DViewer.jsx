import React, { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';

/* ══════════════════════════════════════════════
   COMPONENT REGISTRY
   ══════════════════════════════════════════════ */
const MAITRI_PARTS = [
  { id: 'main_building', name: 'Main Building', icon: '🏠', position: [0, 0.55, 0], size: [3.2, 0.55, 0.7], color: '#c1272d', metric: 'ambient_temp', unit: '°C', status: 'Online' },
  { id: 'generator', name: 'Generator', icon: '⚡', position: [2.4, 0.3, 0.6], size: [0.9, 0.6, 0.6], color: '#d4a017', metric: 'power_output', unit: '%', status: 'Online' },
  { id: 'fuel_tank', name: 'Fuel Tank', icon: '⛽', position: [-3.2, 0.5, 0.5], size: [0.7, 1.0, 0.7], color: '#e8b529', metric: 'fuel_temp', unit: '°C', status: 'Critical' },
  { id: 'water_system', name: 'Water System', icon: '💧', position: [-2.4, 0.4, -1.5], size: [0.56, 0.8, 0.56], color: '#3b82c9', metric: 'humidity', unit: '%', status: 'Online' },
  { id: 'comms', name: 'Communications', icon: '📡', position: [2.5, 0.6, -1.0], size: [0.5, 0.5, 0.5], color: '#6f42c1', metric: 'satellite_link', unit: '', status: 'Intermittent' },
  { id: 'lab', name: 'Scientific Labs', icon: '🔬', position: [-3.5, 0.35, -1.8], size: [1.1, 0.7, 0.8], color: '#4a90a4', metric: 'radiation', unit: 'µSv/h', status: 'Online' },
  { id: 'shelter', name: 'Emergency Shelter', icon: '🏥', position: [-1.0, 0.4, 2.2], size: [0.6, 0.5, 0.5], color: '#c1272d', metric: 'wind_speed', unit: 'km/h', status: 'Online' },
  { id: 'storage', name: 'Storage', icon: '📦', position: [2.0, 0.35, 1.8], size: [1.5, 0.7, 0.6], color: '#e86a17', metric: 'pressure', unit: 'hPa', status: 'Online' },
];

const BHARATI_PARTS = [
  { id: 'main_building', name: 'Main Building', icon: '🏢', position: [0, 2.0, 0], size: [5.5, 1.0, 2.2], color: '#2d3748', metric: 'ambient_temp', unit: '°C', status: 'Online' },
  { id: 'generator', name: 'Generator', icon: '⚡', position: [-4.5, 0.3, 1.5], size: [0.9, 0.6, 0.6], color: '#d4a017', metric: 'power_output', unit: '%', status: 'Online' },
  { id: 'fuel_tank', name: 'Fuel Tank', icon: '⛽', position: [-5.8, 0.5, -0.5], size: [0.7, 1.0, 0.7], color: '#e8b529', metric: 'fuel_temp', unit: '°C', status: 'Warning' },
  { id: 'water_system', name: 'Water System', icon: '💧', position: [-5.0, 0.4, -2.0], size: [0.56, 0.8, 0.56], color: '#3b82c9', metric: 'humidity', unit: '%', status: 'Online' },
  { id: 'radome', name: 'Radome', icon: '📡', position: [3.5, 2.5, -3.5], size: [1.4, 1.4, 1.4], color: '#e0e0e0', metric: 'satellite_link', unit: '', status: 'Online' },
  { id: 'lab', name: 'Scientific Labs', icon: '🔬', position: [3.5, 0.35, 1.5], size: [1.1, 0.7, 0.8], color: '#4a90a4', metric: 'radiation', unit: 'µSv/h', status: 'Online' },
  { id: 'shelter', name: 'Emergency Shelter', icon: '🏥', position: [-3.0, 0.4, 2.5], size: [0.6, 0.5, 0.5], color: '#c1272d', metric: 'wind_speed', unit: 'km/h', status: 'Online' },
  { id: 'storage', name: 'Storage', icon: '📦', position: [5.5, 0.35, 0], size: [1.5, 0.7, 0.6], color: '#e86a17', metric: 'pressure', unit: 'hPa', status: 'Online' },
];

/* ══════════════════════════════════════════════
   STATUS COLORS
   ══════════════════════════════════════════════ */
function statusColor(s) {
  if (s === 'Critical') return '#ff3b3b';
  if (s === 'Warning') return '#ffb020';
  if (s === 'Intermittent') return '#f59e0b';
  return '#00ff88';
}

/* ══════════════════════════════════════════════
   INTERACTIVE PART
   ══════════════════════════════════════════════ */
function InteractivePart({ part, onSelect, isSelected, telemetry }) {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef();

  useFrame((state) => {
    if (meshRef.current && part.status === 'Critical') {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.05;
      meshRef.current.scale.setScalar(scale);
    }
  });

  const rawValue = telemetry?.[part.metric];
  const displayValue =
    rawValue !== undefined && rawValue !== null
      ? typeof rawValue === 'number'
        ? rawValue.toFixed(1)
        : rawValue
      : '—';

  const statusCol = statusColor(part.status);

  return (
    <group position={part.position}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(part.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          
        }}
        onPointerOut={() => {
          setHovered(false);
          
        }}
        castShadow
      >
        <boxGeometry args={part.size} />
        <meshStandardMaterial
          color={isSelected ? '#00ff88' : hovered ? '#7ec8ff' : part.color}
          emissive={
            isSelected
              ? '#00ff88'
              : hovered
              ? '#4a9fd4'
              : part.status === 'Critical'
              ? '#ff0000'
              : '#000000'
          }
          emissiveIntensity={
            isSelected ? 0.7 : hovered ? 0.4 : part.status === 'Critical' ? 0.5 : 0
          }
          transparent
          opacity={0.95}
          metalness={0.3}
          roughness={0.6}
        />
      </mesh>

      {isSelected && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -part.size[1] / 2 - 0.02, 0]}
        >
          <ringGeometry
            args={[
              Math.max(part.size[0], part.size[2]) * 0.8,
              Math.max(part.size[0], part.size[2]) * 0.95,
              32,
            ]}
          />
          <meshBasicMaterial
            color="#00ff88"
            transparent
            opacity={0.7}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      <Html position={[0, part.size[1] / 2 + 0.4, 0]} center distanceFactor={14}>
        <div
          onClick={(e) => {
            e.stopPropagation();
            onSelect(part.id);
          }}
          style={{
            background: isSelected ? 'rgba(0,255,136,0.95)' : 'rgba(0,0,0,0.85)',
            color: isSelected ? '#000' : '#fff',
            padding: '5px 10px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 800,
            fontFamily: 'JetBrains Mono, monospace',
            whiteSpace: 'nowrap',
            border: `2px solid ${isSelected ? '#00ff88' : statusCol}`,
            boxShadow: isSelected
              ? `0 0 20px rgba(0,255,136,0.6)`
              : `0 0 12px ${statusCol}40`,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ fontSize: 12 }}>{part.icon}</span>
          <span style={{ color: isSelected ? '#000' : statusCol, fontWeight: 900 }}>
            {displayValue}
            {part.unit}
          </span>
        </div>
      </Html>
    </group>
  );
}

/* ══════════════════════════════════════════════
   ENVIRONMENT
   ══════════════════════════════════════════════ */
function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
      <planeGeometry args={[60, 60]} />
      <meshStandardMaterial color="#0a1c3a" />
    </mesh>
  );
}

function GridLines() {
  return <gridHelper args={[60, 40, '#1a3a5c', '#0f2340']} position={[0, -0.01, 0]} />;
}

/* ══════════════════════════════════════════════
   MAIN COMPONENT (inline default export)
   ══════════════════════════════════════════════ */
export default function Station3DViewer({ station, telemetry }) {
  const [selectedPart, setSelectedPart] = useState(null);
  const [showPanel, setShowPanel] = useState(false);

  const parts = station === 'maitri' ? MAITRI_PARTS : BHARATI_PARTS;
  const selected = parts.find((p) => p.id === selectedPart);

  const handleSelect = (partId) => {
    setSelectedPart(partId);
    setShowPanel(true);
  };

  const closePanel = () => setShowPanel(false);

  const rawValue = selected ? telemetry?.[selected.metric] : null;
  const displayValue =
    rawValue !== undefined && rawValue !== null
      ? typeof rawValue === 'number'
        ? rawValue.toFixed(2)
        : rawValue
      : '—';

  return (
    <div
      style={{
        position: 'relative',
        height: '620px',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid rgba(74,159,212,0.3)',
        background: '#050b18',
      }}
    >
      <Canvas
        shadows
        camera={{ position: [14, 10, 14], fov: 45 }}
        onPointerMissed={() => setSelectedPart(null)}
      >
        <color attach="background" args={['#050b18']} />
        <fog attach="fog" args={['#050b18', 35, 70]} />

        <ambientLight intensity={0.5} />
        <directionalLight position={[12, 20, 10]} intensity={1.4} castShadow />
        <hemisphereLight args={['#4a9fd4', '#0a1c3a', 0.6]} />

        <Ground />
        <GridLines />

        {parts.map((part) => (
          <InteractivePart
            key={part.id}
            part={part}
            onSelect={handleSelect}
            isSelected={selectedPart === part.id}
            telemetry={telemetry}
          />
        ))}

        <OrbitControls
          enableZoom
          enablePan
          minDistance={8}
          maxDistance={40}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.2}
          target={[0, 1, 0]}
        />
      </Canvas>

      {/* TOP LEFT HUD */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          padding: '10px 14px',
          borderRadius: 10,
          background: 'rgba(0,0,0,0.75)',
          border: '1px solid rgba(0,255,136,0.4)',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          color: '#00ff88',
          letterSpacing: 1,
          fontWeight: 800,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#00ff88',
              boxShadow: '0 0 12px #00ff88',
              animation: 'pulse 1.5s infinite',
            }}
          />
          DIGITAL TWIN · {station.toUpperCase()}
        </div>
        <div style={{ fontSize: 9, color: 'rgba(0,255,136,0.6)', marginTop: 4 }}>
          {parts.length} CLICKABLE COMPONENTS
        </div>
      </div>

      {/* TOP RIGHT HUD — STATS */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: showPanel ? 400 : 16,
          padding: '10px 14px',
          borderRadius: 10,
          background: 'rgba(0,0,0,0.75)',
          border: '1px solid rgba(74,159,212,0.4)',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10.5,
          color: '#7ec8ff',
          letterSpacing: 0.8,
          transition: 'right 0.3s',
        }}
      >
        <div>
          🌡️ FUEL: <b style={{ color: '#fff' }}>{telemetry?.fuel_temp ?? '—'}°C</b>
        </div>
        <div>
          ⚡ POWER: <b style={{ color: '#00ff88' }}>{telemetry?.power_output ?? '—'}%</b>
        </div>
        <div>
          👥 CREW: <b style={{ color: '#fff' }}>{telemetry?.personnel ?? '—'}</b>
        </div>
      </div>

      {/* DRILL-DOWN PANEL */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: showPanel && selected ? 0 : -420,
          width: '400px',
          height: '100%',
          background:
            'linear-gradient(180deg, rgba(5,11,24,0.98), rgba(10,24,48,0.98))',
          borderLeft: '2px solid #00ff88',
          backdropFilter: 'blur(20px)',
          transition: 'right 0.35s cubic-bezier(.2,.8,.2,1)',
          padding: '24px',
          overflowY: 'auto',
          zIndex: 10,
          fontFamily: 'JetBrains Mono, monospace',
          boxShadow: '-20px 0 40px rgba(0,0,0,0.5)',
        }}
      >
        {selected && (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 20,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: '#00ff88',
                    letterSpacing: 2,
                    fontWeight: 800,
                    marginBottom: 6,
                  }}
                >
                  ◆ COMPONENT INSPECTION
                </div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 20,
                    fontWeight: 900,
                    color: '#fff',
                    letterSpacing: 0.5,
                  }}
                >
                  {selected.icon} {selected.name}
                </h2>
                <div
                  style={{
                    fontSize: 10,
                    color: 'rgba(255,255,255,0.4)',
                    marginTop: 4,
                    letterSpacing: 1,
                  }}
                >
                  ID: {selected.id.toUpperCase()}
                </div>
              </div>
              <button
                onClick={closePanel}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff',
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 800,
                  fontFamily: 'inherit',
                }}
              >
                ✕
              </button>
            </div>

            {/* Status badge */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 10,
                background: `${statusColor(selected.status)}15`,
                border: `2px solid ${statusColor(selected.status)}50`,
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 9,
                    color: 'rgba(255,255,255,0.5)',
                    letterSpacing: 1.4,
                  }}
                >
                  CURRENT STATUS
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 900,
                    color: statusColor(selected.status),
                    marginTop: 4,
                    letterSpacing: 0.5,
                  }}
                >
                  {selected.status.toUpperCase()}
                </div>
              </div>
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: statusColor(selected.status),
                  boxShadow: `0 0 16px ${statusColor(selected.status)}`,
                  animation: selected.status === 'Critical' ? 'pulse 1s infinite' : 'none',
                }}
              />
            </div>

            {/* Live metric */}
            <div
              style={{
                padding: '18px',
                borderRadius: 12,
                background: 'rgba(0,255,136,0.06)',
                border: '1px solid rgba(0,255,136,0.3)',
                marginBottom: 20,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  color: 'rgba(0,255,136,0.7)',
                  letterSpacing: 1.6,
                  marginBottom: 8,
                }}
              >
                LIVE SENSOR READING
              </div>
              <div
                style={{
                  fontSize: 38,
                  fontWeight: 900,
                  color: '#00ff88',
                  textShadow: '0 0 20px rgba(0,255,136,0.5)',
                  lineHeight: 1,
                }}
              >
                {displayValue}
                <span style={{ fontSize: 14, opacity: 0.7, marginLeft: 4 }}>
                  {selected.unit}
                </span>
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.4)',
                  marginTop: 8,
                  letterSpacing: 0.5,
                }}
              >
                metric: {selected.metric}
              </div>
            </div>

            {/* Details table */}
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 10,
                  color: '#7ec8ff',
                  letterSpacing: 1.6,
                  fontWeight: 800,
                  marginBottom: 12,
                }}
              >
                ◆ TELEMETRY DETAILS
              </div>
              {[
                {
                  label: 'Station',
                  value: station === 'maitri' ? 'Maitri' : 'Bharati',
                },
                {
                  label: 'Status',
                  value: selected.status,
                  color: statusColor(selected.status),
                },
                { label: 'Metric', value: selected.metric },
                { label: 'Unit', value: selected.unit || 'n/a' },
                {
                  label: 'Position',
                  value: `[${selected.position.join(', ')}]`,
                },
                { label: 'Updated', value: new Date().toLocaleTimeString() },
              ].map((row, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {row.label}
                  </span>
                  <span style={{ color: row.color || '#fff', fontWeight: 800 }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div
                style={{
                  fontSize: 10,
                  color: '#7ec8ff',
                  letterSpacing: 1.6,
                  fontWeight: 800,
                  marginBottom: 4,
                }}
              >
                ◆ ACTIONS
              </div>
              <button
                style={{
                  padding: '12px',
                  borderRadius: 8,
                  border: '2px solid #00ff88',
                  background: 'rgba(0,255,136,0.1)',
                  color: '#00ff88',
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 11,
                  letterSpacing: 1,
                  textAlign: 'left',
                }}
              >
                ⟳ REFRESH DATA
              </button>
              <button
                style={{
                  padding: '12px',
                  borderRadius: 8,
                  border: '2px solid #ffb020',
                  background: 'rgba(255,176,32,0.1)',
                  color: '#ffb020',
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 11,
                  letterSpacing: 1,
                  textAlign: 'left',
                }}
              >
                🔧 SCHEDULE MAINTENANCE
              </button>
              <button
                style={{
                  padding: '12px',
                  borderRadius: 8,
                  border: '2px solid #7ec8ff',
                  background: 'rgba(126,200,255,0.1)',
                  color: '#7ec8ff',
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 11,
                  letterSpacing: 1,
                  textAlign: 'left',
                }}
              >
                📊 VIEW HISTORY
              </button>
            </div>
          </>
        )}
      </div>

      {/* BOTTOM HINT */}
      {!showPanel && (
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '10px 20px',
            borderRadius: 999,
            background: 'rgba(0,0,0,0.8)',
            border: '1px solid rgba(0,255,136,0.4)',
            color: '#00ff88',
            fontSize: 11,
            fontFamily: 'JetBrains Mono, monospace',
            letterSpacing: 1.4,
            fontWeight: 800,
            pointerEvents: 'none',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}
        >
          🖱️ CLICK ANY COMPONENT TO INSPECT
        </div>
      )}
    </div>
  );
}