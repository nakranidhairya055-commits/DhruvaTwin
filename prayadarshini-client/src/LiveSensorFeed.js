import React, { useEffect, useState } from 'react';
import { getApiUrl, getWsUrl } from './apiConfig';

export default function LiveSensorFeed({ station }) {
  const [readings, setReadings] = useState([]);
  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState({ total: 0, critical: 0, lastUpdate: null });

  useEffect(() => {
    setReadings([]);
    setStats({ total: 0, critical: 0, lastUpdate: null });

    fetch(getApiUrl('/api/iot/live'))
      .then((r) => r.json())
      .then((data) => {
        const filtered = (data.readings || []).filter(
          (r) => r.station && r.station.toLowerCase() === station.toLowerCase()
        );
        setReadings(filtered);
        setStats({
          total: filtered.length,
          critical: filtered.filter((r) => r.value < -50).length,
          lastUpdate: filtered[0]?.timestamp || null,
        });
      })
      .catch(console.error);

    const ws = new WebSocket(getWsUrl('/ws/sensors'));
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (event) => {
      try {
        const reading = JSON.parse(event.data);
        if (reading.station && reading.station.toLowerCase() === station.toLowerCase()) {
          setReadings((prev) => [reading, ...prev].slice(0, 40));
          setStats((prev) => ({
            total: prev.total + 1,
            critical: prev.critical + (reading.value < -50 ? 1 : 0),
            lastUpdate: reading.timestamp,
          }));
        }
      } catch (err) {
        console.error(err);
      }
    };
    return () => ws.close();
  }, [station]);

  const tempColor = (t) => {
    if (t < -50) return '#ff0040';
    if (t < -30) return '#ffaa00';
    return '#00ff88';
  };

  const tempGlow = (t) => {
    if (t < -50) return '0 0 12px rgba(255,0,64,0.8)';
    if (t < -30) return '0 0 10px rgba(255,170,0,0.6)';
    return '0 0 10px rgba(0,255,136,0.5)';
  };

  const label = station === 'maitri' ? '🏔️ Maitri' : '🏗️ Bharati';

  return (
    <div style={{
      background: '#000000',
      border: '2px solid #00ff88',
      borderRadius: '14px',
      padding: '16px',
      color: '#ffffff',
      boxShadow: '0 0 40px rgba(0,255,136,0.25), inset 0 0 40px rgba(0,255,136,0.05)',
      fontFamily: 'JetBrains Mono, monospace',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        paddingBottom: 14,
        borderBottom: '2px solid #00ff88',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div>
          <h3 style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 900,
            letterSpacing: 2,
            color: '#00ff88',
            textTransform: 'uppercase',
            textShadow: '0 0 12px rgba(0,255,136,0.8)',
          }}>
            ▶ {label} · LIVE MQTT STREAM
          </h3>
          <div style={{
            marginTop: 6,
            fontSize: 11,
            color: '#00ff88',
            letterSpacing: 1,
            opacity: 0.7,
          }}>
            $ tail -f polar/station/{station}/sensor/#
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{
            padding: '7px 14px',
            borderRadius: 6,
            background: connected ? '#001a0a' : '#1a0005',
            border: `2px solid ${connected ? '#00ff88' : '#ff0040'}`,
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 1.5,
            color: connected ? '#00ff88' : '#ff0040',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: connected
              ? '0 0 20px rgba(0,255,136,0.4)'
              : '0 0 20px rgba(255,0,64,0.4)',
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: connected ? '#00ff88' : '#ff0040',
              boxShadow: `0 0 12px ${connected ? '#00ff88' : '#ff0040'}`,
              animation: 'pulse 1.5s infinite',
            }} />
            {connected ? '● STREAMING' : '● DISCONNECTED'}
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 10,
        marginBottom: 14,
      }}>
        <div style={{
          padding: '12px 14px',
          borderRadius: 8,
          background: '#001a0a',
          border: '2px solid #00ff88',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 22,
            fontWeight: 900,
            color: '#00ff88',
            textShadow: '0 0 12px rgba(0,255,136,0.6)',
            lineHeight: 1,
          }}>{stats.total}</div>
          <div style={{
            fontSize: 9,
            color: 'rgba(0,255,136,0.6)',
            letterSpacing: 1.5,
            marginTop: 4,
            fontWeight: 800,
          }}>TOTAL MSGS</div>
        </div>

        <div style={{
          padding: '12px 14px',
          borderRadius: 8,
          background: stats.critical > 0 ? '#1a0005' : '#0a0a0a',
          border: `2px solid ${stats.critical > 0 ? '#ff0040' : '#333'}`,
          textAlign: 'center',
          boxShadow: stats.critical > 0 ? '0 0 20px rgba(255,0,64,0.5)' : 'none',
        }}>
          <div style={{
            fontSize: 22,
            fontWeight: 900,
            color: stats.critical > 0 ? '#ff0040' : '#444',
            textShadow: stats.critical > 0 ? '0 0 12px rgba(255,0,64,0.8)' : 'none',
            lineHeight: 1,
          }}>{stats.critical}</div>
          <div style={{
            fontSize: 9,
            color: stats.critical > 0 ? 'rgba(255,0,64,0.7)' : '#444',
            letterSpacing: 1.5,
            marginTop: 4,
            fontWeight: 800,
          }}>CRITICAL</div>
        </div>

        <div style={{
          padding: '12px 14px',
          borderRadius: 8,
          background: '#000a1a',
          border: '2px solid #00aaff',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 14,
            fontWeight: 900,
            color: '#00aaff',
            textShadow: '0 0 10px rgba(0,170,255,0.6)',
            lineHeight: 1.2,
            fontFamily: 'JetBrains Mono, monospace',
          }}>{stats.lastUpdate || '--:--:--'}</div>
          <div style={{
            fontSize: 9,
            color: 'rgba(0,170,255,0.6)',
            letterSpacing: 1.5,
            marginTop: 4,
            fontWeight: 800,
          }}>LAST UPDATE</div>
        </div>
      </div>

      {readings.length === 0 ? (
        <div style={{
          padding: '50px 20px',
          textAlign: 'center',
          background: '#0a0a0a',
          borderRadius: 10,
          border: '2px dashed #333',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>📡</div>
          <div style={{
            fontSize: 14,
            color: '#00ff88',
            letterSpacing: 2,
            fontWeight: 800,
            textShadow: '0 0 10px rgba(0,255,136,0.6)',
          }}>
            AWAITING MQTT MESSAGES<span style={{ animation: 'pulse 1s infinite' }}>_</span>
          </div>
          <div style={{
            fontSize: 11,
            color: '#666',
            marginTop: 12,
          }}>
            $ python mqtt_sensor_simulator{station === 'bharati' ? '_bharati' : ''}.py
          </div>
        </div>
      ) : (
        <div
          style={{
            maxHeight: '520px',
            overflowY: 'auto',
            borderRadius: 10,
            background: '#000000',
            border: '2px solid #1a3a1a',
          }}
          className="custom-scroll"
        >
          <div style={{
            display: 'grid',
            gridTemplateColumns: '90px 1fr 90px 130px',
            padding: '10px 14px',
            background: '#0a1a0a',
            borderBottom: '2px solid #00ff88',
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: 1.8,
            color: '#00ff88',
            position: 'sticky',
            top: 0,
            zIndex: 2,
            textShadow: '0 0 8px rgba(0,255,136,0.6)',
          }}>
            <div>TIME</div>
            <div>SENSOR ID</div>
            <div>TYPE</div>
            <div style={{ textAlign: 'right' }}>VALUE</div>
          </div>

          {readings.map((r, i) => {
            const color = tempColor(r.value);
            const glow = tempGlow(r.value);
            const isCritical = r.value < -50;
            return (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '90px 1fr 90px 130px',
                  padding: '10px 14px',
                  borderBottom: '1px solid #0a1a0a',
                  background: isCritical ? 'rgba(255,0,64,0.08)' : 'transparent',
                  transition: 'background 0.2s',
                  animation: i === 0 ? 'msgIn 0.4s' : 'none',
                  alignItems: 'center',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,255,136,0.08)'}
                onMouseLeave={(e) => e.currentTarget.style.background = isCritical ? 'rgba(255,0,64,0.08)' : 'transparent'}
              >
                <div style={{
                  fontSize: 11,
                  color: '#00aaff',
                  letterSpacing: 0.5,
                  fontWeight: 700,
                  textShadow: '0 0 6px rgba(0,170,255,0.4)',
                }}>
                  {r.timestamp}
                </div>
                <div style={{
                  fontSize: 12,
                  color: '#ffffff',
                  fontWeight: 800,
                  letterSpacing: 0.2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {r.sensor_id}
                </div>
                <div style={{
                  fontSize: 11,
                  color: '#888',
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  fontWeight: 700,
                }}>
                  {r.type}
                </div>
                <div style={{
                  textAlign: 'right',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: 6,
                }}>
                  {isCritical && (
                    <span style={{
                      fontSize: 14,
                      animation: 'pulse 1s infinite',
                    }}>🚨</span>
                  )}
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: '#000',
                    border: `2px solid ${color}`,
                    fontSize: 13,
                    fontWeight: 900,
                    color: color,
                    letterSpacing: -0.3,
                    textShadow: glow,
                    boxShadow: glow,
                  }}>
                    {r.value}<span style={{ fontSize: 10, opacity: 0.7, marginLeft: 2 }}>{r.unit}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{
        marginTop: 14,
        padding: '10px 14px',
        borderRadius: 8,
        background: '#0a0a0a',
        border: '2px solid #1a3a1a',
        fontSize: 11,
        color: '#00ff88',
        display: 'flex',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
        letterSpacing: 1,
        fontWeight: 700,
      }}>
        <span>▸ SHOWING <b style={{ color: '#fff' }}>{readings.length}</b> READING(S)</span>
        <span>▸ TRUNCATED TO LAST <b style={{ color: '#fff' }}>40</b></span>
      </div>
    </div>
  );
}