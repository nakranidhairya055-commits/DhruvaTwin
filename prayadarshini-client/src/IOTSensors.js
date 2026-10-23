import React, { useEffect, useState } from 'react';
import { getApiUrl } from './apiConfig';

const statusColor = (status) => {
  if (['Critical', 'Detected', 'Abnormal', 'Leak Detected'].includes(status)) return '#ff3b3b';
  if (['Warning', 'Minor'].includes(status)) return '#ffb020';
  if (['Normal', 'Clear', 'Dry', 'Full', 'Tracked'].includes(status)) return '#00ff88';
  if (['Charging', 'Standby', 'Recent', 'Known'].includes(status)) return '#4a9fd4';
  return '#6c757d';
};

const statusBg = (status) => {
  if (['Critical', 'Detected', 'Abnormal', 'Leak Detected'].includes(status)) return 'rgba(255,59,59,0.15)';
  if (['Warning', 'Minor'].includes(status)) return 'rgba(255,176,32,0.15)';
  if (['Normal', 'Clear', 'Dry', 'Full', 'Tracked'].includes(status)) return 'rgba(0,255,136,0.12)';
  if (['Charging', 'Standby', 'Recent', 'Known'].includes(status)) return 'rgba(74,159,212,0.15)';
  return 'rgba(108,117,125,0.15)';
};

function CategoryPanel({ category, icon, sensors, accentColor }) {
  if (!category || !Array.isArray(sensors)) return null;

  const criticalCount = sensors.filter((s) =>
    ['Critical', 'Detected', 'Abnormal', 'Leak Detected'].includes(s.status)
  ).length;
  const warningCount = sensors.filter((s) =>
    ['Warning', 'Minor'].includes(s.status)
  ).length;

  return (
    <div style={{
      border: `1px solid ${accentColor}44`,
      borderRadius: '12px',
      background: 'rgba(5,11,24,0.85)',
      marginBottom: '12px',
      overflow: 'hidden',
      boxShadow: `0 4px 20px ${accentColor}22, inset 0 1px 0 rgba(255,255,255,0.05)`,
      transition: 'all 0.3s',
    }}>
      <div style={{
        background: `linear-gradient(90deg, ${accentColor}33, ${accentColor}11, transparent)`,
        borderBottom: `1px solid ${accentColor}33`,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `linear-gradient(135deg, ${accentColor}, ${accentColor}aa)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
            boxShadow: `0 4px 12px ${accentColor}66`,
          }}>{icon}</div>
          <div>
            <div style={{
              fontSize: 12, fontWeight: 900, letterSpacing: 1.4,
              color: '#fff', textTransform: 'uppercase',
            }}>{category}</div>
            <div style={{
              fontSize: 9.5, color: 'rgba(255,255,255,0.4)',
              fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: 0.6, marginTop: 1,
            }}>
              {sensors.length} SENSORS ACTIVE
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {criticalCount > 0 && (
            <div style={{
              padding: '3px 10px', borderRadius: 999,
              background: 'rgba(255,59,59,0.2)',
              border: '1px solid rgba(255,59,59,0.5)',
              fontSize: 10, fontWeight: 800, color: '#ff6b6b',
              letterSpacing: 0.6, animation: 'pulse 1.4s infinite',
            }}>● {criticalCount} CRITICAL</div>
          )}
          {warningCount > 0 && criticalCount === 0 && (
            <div style={{
              padding: '3px 10px', borderRadius: 999,
              background: 'rgba(255,176,32,0.2)',
              border: '1px solid rgba(255,176,32,0.5)',
              fontSize: 10, fontWeight: 800, color: '#ffb020',
              letterSpacing: 0.6,
            }}>● {warningCount} WARN</div>
          )}
          {criticalCount === 0 && warningCount === 0 && (
            <div style={{
              padding: '3px 10px', borderRadius: 999,
              background: 'rgba(0,255,136,0.15)',
              border: '1px solid rgba(0,255,136,0.4)',
              fontSize: 10, fontWeight: 800, color: '#00ff88',
              letterSpacing: 0.6,
            }}>✓ ALL NOMINAL</div>
          )}
        </div>
      </div>

      <div style={{ padding: '4px 0' }}>
        {sensors.map((s, i) => {
          const color = statusColor(s.status);
          const bg = statusBg(s.status);
          return (
            <div
              key={i}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px',
                borderBottom: i < sensors.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(74,159,212,0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: color, boxShadow: `0 0 8px ${color}`,
                  flexShrink: 0,
                }} />
                <span style={{
                  fontSize: 12.5, color: 'rgba(255,255,255,0.85)',
                  fontWeight: 600, letterSpacing: 0.2,
                }}>{s.name}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: -0.3,
                }}>
                  {s.value}<span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginLeft: 3 }}>{s.unit}</span>
                </span>
                <span style={{
                  fontSize: 9.5, padding: '3px 9px', borderRadius: 5,
                  background: bg, color: color, fontWeight: 900,
                  letterSpacing: 0.8, border: `1px solid ${color}40`,
                  fontFamily: 'JetBrains Mono, monospace',
                  minWidth: 70, textAlign: 'center',
                }}>{s.status.toUpperCase()}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function IoTSensors({ station }) {
  const [env, setEnv] = useState(null);
  const [energy, setEnergy] = useState(null);
  const [equip, setEquip] = useState(null);
  const [safety, setSafety] = useState(null);
  const [asset, setAsset] = useState(null);
  const [fuel, setFuel] = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [e, en, eq, s, a, f] = await Promise.all([
          fetch(getApiUrl(`/api/iot/environment/${station}`)).then((r) => r.json()),
          fetch(getApiUrl(`/api/iot/energy/${station}`)).then((r) => r.json()),
          fetch(getApiUrl(`/api/iot/equipment/${station}`)).then((r) => r.json()),
          fetch(getApiUrl(`/api/iot/safety/${station}`)).then((r) => r.json()),
          fetch(getApiUrl(`/api/iot/asset/${station}`)).then((r) => r.json()),
          fetch(getApiUrl(`/api/iot/fuel/${station}`)).then((r) => r.json()),
        ]);
        setEnv(e); setEnergy(en); setEquip(eq); setSafety(s); setAsset(a); setFuel(f);
      } catch (err) {
        console.error('IoT fetch failed:', err);
      }
    };
    fetchAll();
    const interval = setInterval(fetchAll, 4000);
    return () => clearInterval(interval);
  }, [station]);

  const totalSensors = [
    env?.sensors?.length, energy?.sensors?.length, equip?.sensors?.length,
    safety?.sensors?.length, asset?.sensors?.length, fuel?.sensors?.length,
  ].reduce((a, b) => a + (b || 0), 0);

  const allSensors = [
    ...(env?.sensors || []),
    ...(energy?.sensors || []),
    ...(equip?.sensors || []),
    ...(safety?.sensors || []),
    ...(asset?.sensors || []),
    ...(fuel?.sensors || []),
  ];
  const criticalCount = allSensors.filter((s) =>
    ['Critical', 'Detected', 'Abnormal', 'Leak Detected'].includes(s.status)
  ).length;

  return (
    <div style={{
      border: '1px solid rgba(74,159,212,0.2)',
      borderRadius: '16px',
      background: 'linear-gradient(180deg, rgba(5,11,24,0.95), rgba(10,24,48,0.9))',
      padding: '16px',
      color: '#fff',
      boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, paddingBottom: 12,
        borderBottom: '1px solid rgba(74,159,212,0.15)',
      }}>
        <div>
          <h3 style={{
            margin: 0, fontSize: 15, fontWeight: 900,
            letterSpacing: 1.6, color: '#fff', textTransform: 'uppercase',
          }}>📡 IoT Sensor Network</h3>
          <p style={{
            margin: '4px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.4)',
            fontFamily: 'JetBrains Mono, monospace', letterSpacing: 0.5,
          }}>LIVE STREAM · UPDATES EVERY 4s</p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{
            padding: '6px 14px', borderRadius: 10,
            background: 'rgba(74,159,212,0.15)',
            border: '1px solid rgba(74,159,212,0.4)',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: 18, fontWeight: 900,
              fontFamily: 'JetBrains Mono, monospace',
              color: '#7ec8ff', lineHeight: 1,
            }}>{totalSensors}</div>
            <div style={{
              fontSize: 9, color: 'rgba(255,255,255,0.5)',
              letterSpacing: 1, marginTop: 3, fontWeight: 700,
            }}>SENSORS</div>
          </div>
          {criticalCount > 0 && (
            <div style={{
              padding: '6px 14px', borderRadius: 10,
              background: 'rgba(255,59,59,0.15)',
              border: '1px solid rgba(255,59,59,0.5)',
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: 18, fontWeight: 900,
                fontFamily: 'JetBrains Mono, monospace',
                color: '#ff6b6b', lineHeight: 1,
              }}>{criticalCount}</div>
              <div style={{
                fontSize: 9, color: 'rgba(255,255,255,0.5)',
                letterSpacing: 1, marginTop: 3, fontWeight: 700,
              }}>CRITICAL</div>
            </div>
          )}
        </div>
      </div>

      {env && <CategoryPanel {...env} accentColor="#0288d1" />}
      {fuel && <CategoryPanel {...fuel} accentColor="#e8b529" />}
      {energy && <CategoryPanel {...energy} accentColor="#f57c00" />}
      {equip && <CategoryPanel {...equip} accentColor="#7b1fa2" />}
      {safety && <CategoryPanel {...safety} accentColor="#c62828" />}
      {asset && <CategoryPanel {...asset} accentColor="#388e3c" />}
    </div>
  );
}