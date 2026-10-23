import React, { useState, useEffect } from 'react';
import { getApiUrl } from './apiConfig';

const DEFAULT_SYSTEMS = [
  { id: 'generator', name: 'Generator',        icon: '⚡', deps: [], edge_device: 'ESP32-GEN-01',
    sensors: [{ id: 'gen-vibration' }, { id: 'gen-current' }, { id: 'gen-rpm' }, { id: 'gen-temp' }] },
  { id: 'power',     name: 'Power Grid',       icon: '🔌', deps: ['generator'], edge_device: 'ESP32-PWR-01',
    sensors: [{ id: 'pwr-voltage' }, { id: 'pwr-frequency' }, { id: 'pwr-load' }] },
  { id: 'heating',   name: 'Heating System',   icon: '🔥', deps: ['power'], edge_device: 'ESP32-HT-01',
    sensors: [{ id: 'ht-temp-in' }, { id: 'ht-temp-out' }, { id: 'ht-flow' }] },
  { id: 'fuel',      name: 'Fuel System',      icon: '⛽', deps: ['power', 'heating'], edge_device: 'ESP32-FUEL-01',
    sensors: [{ id: 'fuel-temp' }, { id: 'fuel-level' }, { id: 'fuel-press' }] },
  { id: 'comms',     name: 'Communications',   icon: '📡', deps: ['power'], edge_device: 'ESP32-COMMS-01',
    sensors: [{ id: 'comms-rssi' }, { id: 'comms-lat' }, { id: 'comms-loss' }] },
  { id: 'life',      name: 'Life Support',     icon: '🫁', deps: ['power', 'heating'], edge_device: 'ESP32-LIFE-01',
    sensors: [{ id: 'life-o2' }, { id: 'life-co2' }] },
  { id: 'personnel', name: 'Personnel Safety', icon: '👥', deps: ['heating', 'life', 'comms'], edge_device: 'ESP32-SAFETY-01',
    sensors: [{ id: 'safe-ambient' }, { id: 'safe-wind' }] },
];

// Grid layout in a 900x520 viewBox
const NODE_POSITIONS = {
  generator: { x: 100, y: 260 },
  power:     { x: 280, y: 260 },
  heating:   { x: 480, y: 130 },
  fuel:      { x: 480, y: 260 },
  comms:     { x: 480, y: 390 },
  life:      { x: 700, y: 130 },
  personnel: { x: 800, y: 260 },
};

const EDGES = [
  ['generator', 'power'],
  ['power', 'heating'],
  ['power', 'fuel'],
  ['power', 'comms'],
  ['heating', 'fuel'],
  ['heating', 'life'],
  ['heating', 'personnel'],
  ['life', 'personnel'],
  ['comms', 'personnel'],
];

function localSimulate(failedIds, hours) {
  const states = {};
  DEFAULT_SYSTEMS.forEach((s) => { states[s.id] = 'healthy'; });
  failedIds.forEach((f) => { states[f] = 'failed'; });

  const log = [];
  const current = new Set(failedIds);
  const thresholds = { power: 4, heating: 6, fuel: 3, comms: 8, life: 5, personnel: 10 };

  for (let step = 1; step <= hours; step++) {
    const newly = [];
    DEFAULT_SYSTEMS.forEach((sys) => {
      if (current.has(sys.id)) return;
      const failedDeps = sys.deps.filter((d) => current.has(d));
      if (failedDeps.length > 0 && step > 2 && step >= (thresholds[sys.id] || 8)) newly.push(sys.id);
    });
    newly.forEach((nf) => {
      current.add(nf);
      const sys = DEFAULT_SYSTEMS.find((s) => s.id === nf);
      log.push({
        hour: step, system: nf, system_icon: sys.icon,
        edge_device: sys.edge_device,
        reason: `Lost IoT dependency: ${sys.deps.filter((d) => current.has(d)).join(', ')}`,
        sensors_failed: sys.sensors.map((s) => s.id),
      });
    });
  }

  const finalStates = {};
  DEFAULT_SYSTEMS.forEach((s) => { finalStates[s.id] = current.has(s.id) ? 'failed' : 'healthy'; });

  const riskAt = (h) => {
    const c = new Set(failedIds);
    for (let step = 1; step <= h; step++) {
      DEFAULT_SYSTEMS.forEach((sys) => {
        if (c.has(sys.id)) return;
        const fd = sys.deps.filter((d) => c.has(d));
        if (fd.length > 0 && step > 2 && step >= (thresholds[sys.id] || 8)) c.add(sys.id);
      });
    }
    return Math.round((c.size / DEFAULT_SYSTEMS.length) * 1000) / 10;
  };

  const recs = [];
  if (current.has('generator')) recs.push('🔴 URGENT: Restart generator — every subsystem depends on it');
  if (current.has('power')) recs.push('🟠 Activate backup generator within 4 hours');
  if (current.has('heating') && current.has('life')) recs.push('🔴 CRITICAL: Personnel evacuation protocol recommended');
  if (current.has('fuel')) recs.push('🟠 Preheat fuel tank before pump restart');

  return {
    states: finalStates, log,
    predictions: { '12h': riskAt(12), '24h': riskAt(24), '48h': riskAt(48) },
    failed_count: current.size,
    total_systems: DEFAULT_SYSTEMS.length,
    recommendations: recs,
    total_sensors: 20,
  };
}

export default function CascadeSim() {
  const [systems, setSystems] = useState(DEFAULT_SYSTEMS);
  const [failed, setFailed] = useState([]);
  const [result, setResult] = useState(null);
  const [hours, setHours] = useState(24);
  const [selectedSystem, setSelectedSystem] = useState(null);
  const [mqttOpen, setMqttOpen] = useState(false);

  useEffect(() => {
    fetch(getApiUrl('/api/simulate/systems'))
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.systems) && d.systems.length > 0) setSystems(d.systems);
      })
      .catch(() => setSystems(DEFAULT_SYSTEMS));
  }, []);

  useEffect(() => {
    if (failed.length === 0) { setResult(null); return; }
    fetch(getApiUrl('/api/simulate/cascade'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ failed, hours }),
    })
      .then((r) => r.json())
      .then((d) => { if (d && d.states) setResult(d); else setResult(localSimulate(failed, hours)); })
      .catch(() => setResult(localSimulate(failed, hours)));
  }, [failed, hours]);

  const toggleFail = (id) => {
    setFailed((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    setSelectedSystem(id);
  };

  const reset = () => { setFailed([]); setResult(null); setSelectedSystem(null); };

  const getState = (id) => (result?.states && result.states[id]) || (failed.includes(id) ? 'failed' : 'healthy');
  const stateColor = (s) => s === 'failed' ? '#ff2965' : '#00ff88';

  const safeSystems = Array.isArray(systems) ? systems : DEFAULT_SYSTEMS;
  const safeRecs = Array.isArray(result?.recommendations) ? result.recommendations : [];
  const safeLog = Array.isArray(result?.log) ? result.log : [];
  const safeMqttLog = Array.isArray(result?.mqtt_log) ? result.mqtt_log : [];
  const safePredictions = result?.predictions || { '12h': 0, '24h': 0, '48h': 0 };

  const activeSystem = selectedSystem ? safeSystems.find((s) => s.id === selectedSystem) : null;
  const totalSensors = 20;
  

  return (
    <div style={{ padding: 6 }}>

      {/* ═══ HEADER ═══ */}
      <div className="dsv-card" style={{ marginBottom: 16 }}>
        <div className="dsv-card-head">
          <div className="dsv-card-label">🧠 IoT CASCADE FAILURE SIMULATOR</div>
          <div className="dsv-section-meta">{totalSensors} SENSORS · {safeSystems.length} SYSTEMS</div>
        </div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 0, lineHeight: 1.6 }}>
          Sensor-level failure propagation across the IoT mesh. Click any system to simulate a failure
          and watch the cascade propagate through dependent subsystems.
        </p>
      </div>

      {/* ═══ KPI ROW ═══ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 10,
        marginBottom: 16,
      }}>
        <div className="dsv-kpi">
          <div className="dsv-kpi-label">🖥️ SYSTEMS</div>
          <div className="dsv-kpi-value accent">{safeSystems.length}</div>
        </div>
        <div className="dsv-kpi">
          <div className="dsv-kpi-label">📡 SENSORS</div>
          <div className="dsv-kpi-value accent">{totalSensors}</div>
        </div>
        <div className="dsv-kpi">
          <div className="dsv-kpi-label">🔴 TRIGGERED</div>
          <div className={`dsv-kpi-value ${failed.length > 0 ? 'red' : ''}`}>{failed.length}</div>
        </div>
        <div className="dsv-kpi">
          <div className="dsv-kpi-label">⚠️ AFFECTED</div>
          <div className={`dsv-kpi-value ${result?.failed_count > 0 ? 'amber' : ''}`}>{result?.failed_count || 0}</div>
        </div>
      </div>

      {/* ═══ CONTROLS BAR ═══ */}
      <div style={{
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        marginBottom: 16,
        padding: '10px 14px',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 10,
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 10, color: 'var(--text-lo)', letterSpacing: 1.4, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
          HORIZON:
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {[12, 24, 48].map((h) => (
            <button
              key={h}
              onClick={() => setHours(h)}
              style={{
                padding: '6px 14px', borderRadius: 7,
                border: `1px solid ${hours === h ? 'var(--accent)' : 'var(--border-subtle)'}`,
                background: hours === h ? 'var(--accent-dim)' : 'transparent',
                color: hours === h ? 'var(--accent)' : 'var(--text-lo)',
                fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800,
                cursor: 'pointer', letterSpacing: 0.6,
              }}
            >
              {h}h
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            onClick={reset}
            style={{
              padding: '6px 16px', borderRadius: 7,
              border: '1px solid var(--border-subtle)',
              background: 'transparent',
              color: 'var(--text-md)',
              fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800,
              cursor: 'pointer', letterSpacing: 0.6,
            }}
          >
            ⟲ RESET ALL
          </button>
        </div>
      </div>

      {/* ═══ GRAPH ═══ */}
      <div className="dsv-card" style={{ marginBottom: 16, padding: 20 }}>
        <div className="dsv-card-head" style={{ marginBottom: 16 }}>
          <div className="dsv-card-label">🔗 IOT DEPENDENCY GRAPH</div>
          <div className="dsv-section-meta">CLICK ANY NODE TO TRIGGER FAILURE</div>
        </div>

        <div style={{ position: 'relative', width: '100%', paddingBottom: '58%' }}>
          <svg
            viewBox="0 0 900 520"
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
            }}
          >
            {/* Background grid */}
            <defs>
              <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(0,217,255,0.04)" strokeWidth="1" />
              </pattern>
              <linearGradient id="edgeGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#00d9ff" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#00d9ff" stopOpacity="0.15" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            <rect width="900" height="520" fill="url(#grid)" />

            {/* Edges */}
            {EDGES.map(([from, to], i) => {
              const f = NODE_POSITIONS[from];
              const t = NODE_POSITIONS[to];
              if (!f || !t) return null;
              const fromState = getState(from);
              const toState = getState(to);
              const isFailed = fromState === 'failed' && toState === 'failed';
              const isDegrading = fromState === 'failed';

              return (
                <line
                  key={i}
                  x1={f.x} y1={f.y} x2={t.x} y2={t.y}
                  stroke={isFailed ? '#ff2965' : isDegrading ? '#ffab00' : 'url(#edgeGrad)'}
                  strokeWidth={isFailed ? 3 : 2}
                  strokeDasharray={isDegrading ? '8 6' : '0'}
                  filter={isFailed ? 'url(#glow)' : 'none'}
                  style={{ transition: 'all 0.4s' }}
                >
                  {isDegrading && (
                    <animate
                      attributeName="stroke-dashoffset"
                      from="0" to="-28" dur="1s" repeatCount="indefinite"
                    />
                  )}
                </line>
              );
            })}

            {/* Nodes */}
            {safeSystems.map((sys) => {
              const pos = NODE_POSITIONS[sys.id];
              if (!pos) return null;
              const state = getState(sys.id);
              const isDirectlyFailed = failed.includes(sys.id);
              const color = stateColor(state);

              return (
                <g
                  key={sys.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => toggleFail(sys.id)}
                >
                  {/* Pulsing outer ring for failed */}
                  {state === 'failed' && (
                    <circle cx={pos.x} cy={pos.y} r={42} fill="none" stroke={color} strokeWidth={2} opacity={0.5}>
                      <animate attributeName="r" from="42" to="60" dur="1.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" from="0.5" to="0" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                  )}

                  {/* Main node circle */}
                  <circle
                    cx={pos.x} cy={pos.y} r={38}
                    fill={state === 'failed' ? 'rgba(255,41,101,0.15)' : 'rgba(0,255,136,0.08)'}
                    stroke={color}
                    strokeWidth={state === 'failed' ? 3 : 2}
                    filter={state === 'failed' ? 'url(#glow)' : 'none'}
                    style={{ transition: 'all 0.3s' }}
                  />

                  {/* Inner accent */}
                  <circle
                    cx={pos.x} cy={pos.y} r={30}
                    fill={state === 'failed' ? 'rgba(255,41,101,0.1)' : 'rgba(0,255,136,0.04)'}
                    style={{ transition: 'all 0.3s' }}
                  />

                  {/* Icon */}
                  <text
                    x={pos.x} y={pos.y - 3}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize="22"
                  >
                    {sys.icon}
                  </text>

                  {/* Name */}
                  <text
                    x={pos.x} y={pos.y + 18}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize="9" fontWeight="800"
                    fill="#fff"
                    style={{ letterSpacing: '0.5px', pointerEvents: 'none' }}
                  >
                    {sys.name.length > 12 ? sys.name.substring(0, 11) + '…' : sys.name}
                  </text>

                  {/* Sensor count */}
                  <text
                    x={pos.x} y={pos.y + 30}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize="7" fontWeight="700"
                    fill={color}
                    style={{ fontFamily: 'JetBrains Mono', pointerEvents: 'none' }}
                  >
                    {sys.sensors?.length || 0} SEN
                  </text>

                  {/* Failed badge */}
                  {isDirectlyFailed && (
                    <g>
                      <rect
                        x={pos.x - 24} y={pos.y - 58}
                        width={48} height={14} rx={7}
                        fill="#ff2965"
                      />
                      <text
                        x={pos.x} y={pos.y - 51}
                        textAnchor="middle" dominantBaseline="middle"
                        fontSize="7" fontWeight="900" fill="#fff"
                        style={{ letterSpacing: '0.5px', pointerEvents: 'none' }}
                      >
                        TRIGGERED
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        <div style={{
          display: 'flex', gap: 20, marginTop: 16,
          paddingTop: 14, borderTop: '1px solid var(--border-subtle)',
          fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-lo)',
          flexWrap: 'wrap',
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'rgba(0,255,136,0.2)', border: '2px solid #00ff88' }} />
            HEALTHY
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'rgba(255,41,101,0.2)', border: '2px solid #ff2965' }} />
            FAILED / AFFECTED
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 20, height: 3, background: '#00ff88', borderRadius: 2, opacity: 0.6 }} />
            DEPENDENCY
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 20, height: 3, background: '#ff2965', borderRadius: 2 }} />
            CASCADE PATH
          </span>
        </div>
      </div>

      {/* ═══ SELECTED SYSTEM INFO ═══ */}
      {activeSystem && (
        <div className="dsv-card accent" style={{ marginBottom: 16 }}>
          <div className="dsv-card-head">
            <div className="dsv-card-label">
              {activeSystem.icon} {activeSystem.name} · EDGE DEVICE
            </div>
            <div className="dsv-section-meta">{activeSystem.edge_device}</div>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-lo)', marginBottom: 12 }}>
            📡 polar/station/maitri/sensor/{activeSystem.id}
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 8,
          }}>
            {activeSystem.sensors?.map((s) => (
              <div key={s.id} style={{
                padding: '8px 10px', borderRadius: 6,
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--border-subtle)',
              }}>
                <div style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: 0.6, fontFamily: 'var(--font-mono)' }}>
                  {s.id.toUpperCase()}
                </div>
                <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 800, fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                  {s.type || 'sensor'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ PREDICTIONS ═══ */}
      {result && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
            marginBottom: 16,
          }}>
            {[['12h', safePredictions['12h'] || 0], ['24h', safePredictions['24h'] || 0], ['48h', safePredictions['48h'] || 0]].map(([label, risk]) => {
              const isHigh = risk > 70;
              const isMid = risk > 40;
              const color = isHigh ? '#ff2965' : isMid ? '#ffab00' : '#00ff88';
              return (
                <div key={label} style={{
                  padding: 20, borderRadius: 12,
                  background: `linear-gradient(180deg, ${color}15, transparent)`,
                  border: `1px solid ${color}40`,
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                    background: color,
                  }} />
                  <div style={{
                    fontSize: 10, color: 'var(--text-lo)',
                    letterSpacing: 1.6, fontWeight: 800,
                    fontFamily: 'var(--font-mono)',
                    marginBottom: 8,
                  }}>
                    ⏱ {label} PREDICTION
                  </div>
                  <div style={{
                    fontSize: 42, fontWeight: 900,
                    fontFamily: 'var(--font-mono)',
                    color, letterSpacing: -1, lineHeight: 1,
                    textShadow: `0 0 20px ${color}80`,
                  }}>
                    {risk}%
                  </div>
                  <div style={{
                    fontSize: 10, color: 'var(--text-lo)',
                    letterSpacing: 1.4, marginTop: 8,
                    fontFamily: 'var(--font-mono)',
                  }}>
                    FAILURE RISK
                  </div>
                </div>
              );
            })}
          </div>

          {safeRecs.length > 0 && (
            <div className="dsv-card warn" style={{ marginBottom: 16 }}>
              <div className="dsv-card-head">
                <div className="dsv-card-label">⚠️ RECOVERY RECOMMENDATIONS</div>
                <div className="dsv-section-meta">{safeRecs.length} ACTIONS</div>
              </div>
              {safeRecs.map((rec, i) => (
                <div key={i} style={{
                  padding: '10px 12px', marginBottom: 6,
                  background: 'rgba(255,171,0,0.06)',
                  borderLeft: '3px solid var(--amber)',
                  borderRadius: 6,
                  fontSize: 12.5,
                  color: 'rgba(255,255,255,0.9)',
                  fontWeight: 600,
                }}>
                  {rec}
                </div>
              ))}
            </div>
          )}

          {/* MQTT Log */}
          {safeMqttLog.length > 0 && (
            <div className="dsv-card" style={{ marginBottom: 16 }}>
              <div className="dsv-card-head" onClick={() => setMqttOpen(!mqttOpen)} style={{ cursor: 'pointer' }}>
                <div className="dsv-card-label">📡 MQTT CASCADE MESSAGE LOG</div>
                <div className="dsv-section-meta">{safeMqttLog.length} MESSAGES · {mqttOpen ? 'HIDE' : 'VIEW'}</div>
              </div>
              {mqttOpen && safeMqttLog.map((msg, i) => (
                <div key={i} style={{
                  padding: 12, marginBottom: 8, borderRadius: 8,
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,41,101,0.2)',
                  fontFamily: 'var(--font-mono)', fontSize: 10.5,
                }}>
                  <div style={{ color: 'var(--accent)', fontWeight: 700 }}>
                    📤 {msg.device} → {msg.topic}
                  </div>
                  <div style={{ color: 'var(--text-lo)', marginTop: 6, fontSize: 10 }}>
                    {JSON.stringify(msg.payload, null, 2)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Cascade Timeline */}
          <div className="dsv-card">
            <div className="dsv-card-head">
              <div className="dsv-card-label">⏱️ CASCADE TIMELINE</div>
              <div className="dsv-section-meta">{safeLog.length} EVENTS</div>
            </div>
            {safeLog.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-lo)', textAlign: 'center', padding: 20 }}>
                No cascade yet — click more systems to trigger propagation.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {safeLog.map((ev, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 12px', borderRadius: 8,
                    background: 'rgba(255,41,101,0.06)',
                    borderLeft: '3px solid var(--red)',
                  }}>
                    <div style={{
                      minWidth: 50, fontSize: 11, fontWeight: 900,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--red)',
                      letterSpacing: 0.6,
                    }}>
                      T+{ev.hour}h
                    </div>
                    <div style={{ fontSize: 16 }}>{ev.system_icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: '#fff' }}>
                        {ev.system.toUpperCase()}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-lo)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                        {ev.reason} · {ev.sensors_failed?.length || 0} sensors failed
                      </div>
                    </div>
                    <div style={{
                      fontSize: 9, color: 'var(--text-dim)',
                      fontFamily: 'var(--font-mono)', letterSpacing: 0.6,
                    }}>
                      {ev.edge_device}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ EMPTY STATE ═══ */}
      {!result && failed.length === 0 && (
        <div className="dsv-card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.5 }}>🧠</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-hi)', marginBottom: 8, letterSpacing: 0.5 }}>
            READY TO SIMULATE
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-lo)', maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
            Click any node in the dependency graph above to trigger a failure.
            The cascade will propagate through dependent subsystems automatically.
          </div>
          <div style={{
            display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap',
          }}>
            {['generator', 'power', 'heating', 'fuel'].map((id) => (
              <button
                key={id}
                onClick={() => toggleFail(id)}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  border: '1px solid var(--border-subtle)',
                  background: 'rgba(255,255,255,0.03)',
                  color: 'var(--text-md)', fontSize: 11,
                  fontFamily: 'var(--font-mono)', fontWeight: 800,
                  cursor: 'pointer', letterSpacing: 0.5,
                }}
              >
                TRY: {id.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}