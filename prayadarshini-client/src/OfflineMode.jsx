import React, { useState, useEffect, useRef } from 'react';
import { getApiUrl } from './apiConfig';

const STATUS_COLORS = {
  online: { primary: '#00ff88', bg: 'rgba(0,255,136,0.08)', border: 'rgba(0,255,136,0.4)', label: 'ONLINE', icon: '🟢' },
  offline: { primary: '#ff2965', bg: 'rgba(255,41,101,0.08)', border: 'rgba(255,41,101,0.4)', label: 'OFFLINE', icon: '🔴' },
  syncing: { primary: '#ffab00', bg: 'rgba(255,171,0,0.08)', border: 'rgba(255,171,0,0.4)', label: 'SYNCING', icon: '🟡' },
};

export default function OfflineMode() {
  const [status, setStatus] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [qosLevel, setQosLevel] = useState(1);
  const [bufferHistory, setBufferHistory] = useState([]);
  const [eventLog, setEventLog] = useState([]);
  const [offlineElapsed, setOfflineElapsed] = useState(0);
  const [syncProgress, setSyncProgress] = useState(0);
  const logRef = useRef(null);

  // ─── DERIVE DISPLAY STATE ───
  const getDisplayState = () => {
    if (loading) return 'syncing';
    if (!status) return 'online';
    if (status.mode === 'offline') return 'offline';
    return 'online';
  };

  const displayState = getDisplayState();
  const colors = STATUS_COLORS[displayState];
  const isOffline = status?.mode === 'offline';
  const buffer = status?.buffer || { capacity: 10000, used: 0, bytes: 0 };


  // ─── LOG EVENT ───
  const addLog = (message, type = 'info') => {
    setEventLog((prev) => [
      { id: Date.now() + Math.random(), time: new Date().toLocaleTimeString(), message, type },
      ...prev,
    ].slice(0, 15));
  };

  // ─── FETCH STATUS ───
  const fetchStatus = async () => {
    try {
      const r = await fetch(getApiUrl('/api/offline/status'));
      const data = await r.json();
      setStatus(data);
      // Append to buffer history for graph
      setBufferHistory((prev) => [
        ...prev.slice(-29),
        { t: Date.now(), value: data.queue_length || 0, bytes: data.buffer?.bytes || 0 },
      ]);
    } catch (e) {
      console.error(e);
      addLog('❌ Failed to reach backend', 'error');
    }
  };

  useEffect(() => {
    fetchStatus();
    const i = setInterval(fetchStatus, 2000);
    return () => clearInterval(i);
  }, []);// eslint-disable-line react-hooks/exhaustive-deps


  // ─── OFFLINE TIMER ───
  useEffect(() => {
    if (!isOffline) {
      setOfflineElapsed(0);
      return;
    }
    const i = setInterval(() => setOfflineElapsed((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, [isOffline]);

  // ─── AUTO-QUEUE MESSAGES WHILE OFFLINE ───
  useEffect(() => {
    if (!isOffline) return;
    const types = ['temperature', 'voltage', 'vibration', 'humidity'];
    const i = setInterval(async () => {
      try {
        const type = types[Math.floor(Math.random() * types.length)];
        const value =
          type === 'temperature' ? parseFloat((Math.random() * -40 - 15).toFixed(1)) :
          type === 'voltage'     ? parseFloat((210 + Math.random() * 15).toFixed(1)) :
          type === 'vibration'   ? parseFloat((Math.random() * 4).toFixed(2)) :
                                   parseFloat((40 + Math.random() * 30).toFixed(0));

        const r = await fetch(getApiUrl('/api/offline/queue'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sensor_id: 'ESP32-MAITRI-01',
            type,
            value,
            qos: qosLevel,
          }),
        });
        const data = await r.json();
        addLog(`📥 Queued ${type} = ${value} · ${data.priority.toUpperCase()} · QoS ${qosLevel}`, 'queue');
        fetchStatus();
      } catch (e) { /* silent */ }
    }, 2500);
    return () => clearInterval(i);
  }, [isOffline, qosLevel]); //eslint-disable-line react-hooks/exhaustive-deps

  // ─── TOGGLE ONLINE/OFFLINE ───
  const toggleMode = async () => {
    if (!status) return;
    setLoading(true);
    const newMode = status.mode === 'online' ? 'offline' : 'online';

    if (newMode === 'offline') {
      addLog('📴 SATELLITE UPLINK CUT — blackout mode activated', 'error');
    } else {
      addLog('🔄 RECONNECTING — syncing buffered messages...', 'warning');
      // Animate sync progress
      setSyncProgress(0);
      const prog = setInterval(() => {
        setSyncProgress((p) => Math.min(p + 10, 100));
      }, 100);
      setTimeout(() => clearInterval(prog), 1200);
    }

    try {
      const r = await fetch(getApiUrl('/api/offline/toggle'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode }),
      });
      const data = await r.json();

      if (newMode === 'online' && data.synced_count !== undefined) {
        setSyncResult(data);
        addLog(`✅ SYNC COMPLETE — ${data.synced_count} messages restored`, 'success');
        setTimeout(() => setSyncResult(null), 8000);
      }
      await fetchStatus();
    } catch (e) {
      addLog('❌ Toggle failed — backend unreachable', 'error');
    }
    setLoading(false);
  };

  // ─── MANUAL TEST MESSAGE ───
  const queueTestMessage = async () => {
    try {
      await fetch(getApiUrl('/api/offline/queue'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sensor_id: 'MANUAL-TEST',
          type: 'temperature',
          value: -48.5,
          qos: qosLevel,
        }),
      });
      addLog('🧪 Manual test message queued', 'success');
      fetchStatus();
    } catch (e) { /* silent */ }
  };

  const formatElapsed = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div style={{ padding: 6, fontFamily: 'Inter, sans-serif' }}>

      {/* ═══════════════════════════════════════════
          MASSIVE STATUS BANNER
          ═══════════════════════════════════════════ */}
      <div style={{
        padding: '24px 28px',
        borderRadius: 16,
        background: colors.bg,
        border: `2px solid ${colors.border}`,
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.4s',
      }}>
        {/* Animated background pulse for offline */}
        {isOffline && (
          <div style={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(circle at 20% 50%, ${colors.primary}15, transparent 70%)`,
            animation: 'pulse 2s infinite',
            pointerEvents: 'none',
          }} />
        )}

        <div style={{
          fontSize: 52,
          filter: `drop-shadow(0 0 20px ${colors.primary})`,
          animation: isOffline ? 'pulse 1.5s infinite' : 'none',
        }}>
          {colors.icon}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 28,
            fontWeight: 900,
            letterSpacing: 4,
            color: colors.primary,
            fontFamily: 'JetBrains Mono, monospace',
            textShadow: `0 0 20px ${colors.primary}80`,
            lineHeight: 1,
          }}>
            {loading ? 'RECONNECTING...' : colors.label}
          </div>
          <div style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.6)',
            marginTop: 8,
            fontFamily: 'JetBrains Mono, monospace',
            letterSpacing: 0.5,
          }}>
            {displayState === 'online' && '✓ Satellite uplink established · streaming to NCPOR'}
            {displayState === 'offline' && `✗ Link severed · buffering locally · ${formatElapsed(offlineElapsed)} elapsed`}
            {displayState === 'syncing' && '⟳ Pushing buffered messages to cloud...'}
          </div>
        </div>

        {/* Live counter */}
        {isOffline && (
          <div style={{
            textAlign: 'center',
            padding: '12px 24px',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: 12,
            border: `1px solid ${colors.border}`,
          }}>
            <div style={{
              fontSize: 36,
              fontWeight: 900,
              color: colors.primary,
              fontFamily: 'JetBrains Mono, monospace',
              lineHeight: 1,
              textShadow: `0 0 16px ${colors.primary}`,
            }}>
              {buffer.used}
            </div>
            <div style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.5)',
              letterSpacing: 1.5,
              marginTop: 4,
              fontWeight: 800,
            }}>
              MESSAGES QUEUED
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════
          SYNC PROGRESS BAR (during sync)
          ═══════════════════════════════════════════ */}
      {loading && (
        <div style={{
          padding: 16,
          borderRadius: 12,
          background: 'rgba(255,171,0,0.08)',
          border: '1px solid rgba(255,171,0,0.4)',
          marginBottom: 16,
        }}>
          <div style={{
            fontSize: 12,
            color: '#ffab00',
            fontWeight: 800,
            marginBottom: 10,
            letterSpacing: 1.5,
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            ⏳ RECONNECTING — {syncProgress}%
          </div>
          <div style={{
            height: 8,
            borderRadius: 4,
            background: 'rgba(0,0,0,0.3)',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${syncProgress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #ffab00, #ff2965)',
              transition: 'width 0.15s',
              boxShadow: '0 0 12px #ffab00',
            }} />
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          CONTROL PANEL
          ═══════════════════════════════════════════ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1fr',
        gap: 12,
        marginBottom: 16,
      }}>
        {/* Big toggle */}
        <button
          onClick={toggleMode}
          disabled={loading}
          style={{
            padding: '18px 24px',
            borderRadius: 12,
            border: `2px solid ${colors.border}`,
            background: colors.bg,
            color: colors.primary,
            fontSize: 15,
            fontWeight: 900,
            letterSpacing: 2,
            cursor: loading ? 'wait' : 'pointer',
            fontFamily: 'JetBrains Mono, monospace',
            transition: 'all 0.3s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 22 }}>{isOffline ? '📡' : '📴'}</span>
          {loading ? 'SYNCING...' : isOffline ? 'RESTORE SATELLITE UPLINK' : 'SIMULATE BLACKOUT'}
        </button>

        {/* Test button */}
        <button
          onClick={queueTestMessage}
          disabled={!isOffline}
          style={{
            padding: '18px 20px',
            borderRadius: 12,
            border: `1px solid ${isOffline ? 'rgba(0,217,255,0.4)' : 'rgba(255,255,255,0.1)'}`,
            background: isOffline ? 'rgba(0,217,255,0.08)' : 'rgba(255,255,255,0.02)',
            color: isOffline ? '#00d9ff' : 'rgba(255,255,255,0.3)',
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: 1,
            cursor: isOffline ? 'pointer' : 'not-allowed',
            fontFamily: 'JetBrains Mono, monospace',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          🧪 PUSH TEST MSG
        </button>

        {/* QoS selector */}
        <div style={{
          padding: '12px 16px',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(255,255,255,0.02)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}>
          <div style={{
            fontSize: 9,
            color: 'rgba(255,255,255,0.4)',
            letterSpacing: 1.5,
            fontWeight: 800,
            marginBottom: 6,
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            MQTT QoS
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[0, 1, 2].map((q) => (
              <button
                key={q}
                onClick={() => setQosLevel(q)}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  borderRadius: 6,
                  border: `1px solid ${qosLevel === q ? '#00d9ff' : 'rgba(255,255,255,0.1)'}`,
                  background: qosLevel === q ? 'rgba(0,217,255,0.15)' : 'transparent',
                  color: qosLevel === q ? '#00d9ff' : 'rgba(255,255,255,0.4)',
                  fontSize: 11,
                  fontWeight: 900,
                  fontFamily: 'JetBrains Mono, monospace',
                  cursor: 'pointer',
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          BUFFER GROWTH GRAPH
          ═══════════════════════════════════════════ */}
      <div style={{
        padding: 18,
        borderRadius: 12,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.08)',
        marginBottom: 16,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
        }}>
          <div style={{
            fontSize: 10,
            color: '#00d9ff',
            letterSpacing: 1.8,
            fontWeight: 900,
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            📈 BUFFER GROWTH (live)
          </div>
          <div style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.5)',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            {buffer.bytes} bytes buffered
          </div>
        </div>

        {/* Bar chart */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 2,
          height: 80,
          padding: '0 4px',
        }}>
          {bufferHistory.slice(-40).map((point, i) => {
            const maxVal = Math.max(...bufferHistory.map((p) => p.value), 1);
            const height = (point.value / maxVal) * 100;
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${Math.max(height, 3)}%`,
                  background: point.value > 20
                    ? 'linear-gradient(180deg, #ff2965, #ff296580)'
                    : point.value > 5
                    ? 'linear-gradient(180deg, #ffab00, #ffab0080)'
                    : 'linear-gradient(180deg, #00ff88, #00ff8880)',
                  borderRadius: '2px 2px 0 0',
                  transition: 'height 0.4s',
                  minWidth: 3,
                }}
                title={`${point.value} messages`}
              />
            );
          })}
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 10,
          fontSize: 9,
          color: 'rgba(255,255,255,0.3)',
          fontFamily: 'JetBrains Mono, monospace',
          letterSpacing: 1,
        }}>
          <span>← Older</span>
          <span>LIVE</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          STATS ROW
          ═══════════════════════════════════════════ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
        marginBottom: 16,
      }}>
        {[
          { label: 'BUFFER USED', value: buffer.used, unit: 'msgs', color: '#00d9ff' },
          { label: 'BUFFER SIZE', value: buffer.bytes, unit: 'bytes', color: '#00d9ff' },
          { label: 'TOTAL SYNCED', value: status?.total_synced || 0, unit: 'msgs', color: '#00ff88' },
          { label: 'DEDUP DROPPED', value: status?.duplicates_dropped || 0, unit: 'msgs', color: '#ffab00' },
        ].map((stat, i) => (
          <div key={i} style={{
            padding: '14px 16px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderTop: `2px solid ${stat.color}`,
          }}>
            <div style={{
              fontSize: 9,
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: 1.4,
              fontWeight: 800,
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              {stat.label}
            </div>
            <div style={{
              fontSize: 24,
              fontWeight: 900,
              color: stat.color,
              fontFamily: 'JetBrains Mono, monospace',
              marginTop: 6,
              lineHeight: 1,
              textShadow: `0 0 12px ${stat.color}60`,
            }}>
              {stat.value}
            </div>
            <div style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.35)',
              marginTop: 4,
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              {stat.unit}
            </div>
          </div>
        ))}
      </div>

      {/* ═══════════════════════════════════════════
          PRIORITY BREAKDOWN
          ═══════════════════════════════════════════ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
        marginBottom: 16,
      }}>
        {[
          { key: 'critical', label: 'CRITICAL', icon: '🚨', color: '#ff2965' },
          { key: 'warning', label: 'WARNING', icon: '⚠️', color: '#ffab00' },
          { key: 'info', label: 'INFO', icon: 'ℹ️', color: '#00ff88' },
        ].map((p) => (
          <div key={p.key} style={{
            padding: 16,
            borderRadius: 10,
            background: `${p.color}11`,
            border: `1px solid ${p.color}40`,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}>
            <div style={{ fontSize: 26 }}>{p.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 10,
                fontWeight: 800,
                color: p.color,
                letterSpacing: 1.4,
                fontFamily: 'JetBrains Mono, monospace',
              }}>
                {p.label}
              </div>
              <div style={{
                fontSize: 24,
                fontWeight: 900,
                color: p.color,
                fontFamily: 'JetBrains Mono, monospace',
                lineHeight: 1,
                marginTop: 4,
              }}>
                {status?.priority_stats?.[p.key] || 0}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ═══════════════════════════════════════════
          LIVE EVENT LOG — "What Just Happened"
          ═══════════════════════════════════════════ */}
      <div style={{
        padding: 18,
        borderRadius: 12,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.08)',
        marginBottom: 16,
      }}>
        <div style={{
          fontSize: 11,
          color: '#00d9ff',
          letterSpacing: 2,
          fontWeight: 900,
          fontFamily: 'JetBrains Mono, monospace',
          marginBottom: 14,
        }}>
          🔍 LIVE EVENT LOG
        </div>

        <div
          ref={logRef}
          style={{
            maxHeight: 220,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {eventLog.length === 0 ? (
            <div style={{
              padding: 20,
              textAlign: 'center',
              color: 'rgba(255,255,255,0.3)',
              fontSize: 12,
              fontStyle: 'italic',
            }}>
              Waiting for events... Click "Simulate Blackout" to begin.
            </div>
          ) : (
            eventLog.map((log) => (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  gap: 12,
                  padding: '8px 12px',
                  borderRadius: 6,
                  background:
                    log.type === 'error' ? 'rgba(255,41,101,0.08)' :
                    log.type === 'success' ? 'rgba(0,255,136,0.08)' :
                    log.type === 'warning' ? 'rgba(255,171,0,0.08)' :
                    log.type === 'queue' ? 'rgba(0,217,255,0.06)' :
                    'rgba(255,255,255,0.03)',
                  borderLeft: `3px solid ${
                    log.type === 'error' ? '#ff2965' :
                    log.type === 'success' ? '#00ff88' :
                    log.type === 'warning' ? '#ffab00' :
                    log.type === 'queue' ? '#00d9ff' :
                    'rgba(255,255,255,0.2)'
                  }`,
                  fontSize: 11.5,
                  fontFamily: 'JetBrains Mono, monospace',
                  alignItems: 'center',
                }}
              >
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>{log.time}</span>
                <span style={{ color: 'rgba(255,255,255,0.9)' }}>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          SUCCESS BANNER (after sync)
          ═══════════════════════════════════════════ */}
      {syncResult && (
        <div style={{
          padding: 20,
          borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(0,255,136,0.15), rgba(0,217,255,0.08))',
          border: '2px solid rgba(0,255,136,0.5)',
          animation: 'fadeIn 0.4s',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 40 }}>✅</div>
            <div>
              <div style={{
                fontSize: 18,
                fontWeight: 900,
                color: '#00ff88',
                letterSpacing: 1.5,
                fontFamily: 'JetBrains Mono, monospace',
              }}>
                SATELLITE UPLINK RESTORED
              </div>
              <div style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.7)',
                marginTop: 4,
              }}>
                All buffered messages synced to NCPOR · Blockchain verified
              </div>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
          }}>
            {[
              { label: 'SYNCED', value: syncResult.synced_count, color: '#00ff88' },
              { label: 'DEDUP DROPPED', value: syncResult.duplicates_dropped, color: '#ffab00' },
              { label: 'CRITICAL MSGS', value: syncResult.priority_stats?.critical || 0, color: '#ff2965' },
              { label: 'DATA SIZE', value: `${syncResult.buffer_bytes}B`, color: '#00d9ff' },
            ].map((s, i) => (
              <div key={i} style={{
                padding: 12,
                borderRadius: 8,
                background: 'rgba(0,0,0,0.2)',
                textAlign: 'center',
              }}>
                <div style={{
                  fontSize: 9,
                  color: 'rgba(255,255,255,0.5)',
                  letterSpacing: 1.2,
                  fontWeight: 800,
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  {s.label}
                </div>
                <div style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: s.color,
                  fontFamily: 'JetBrains Mono, monospace',
                  marginTop: 6,
                }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inline keyframes */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}