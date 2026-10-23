import React, { useEffect, useRef, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';

const MAX_POINTS = 60;

const CHART_GROUPS = [
  {
    id: 'fuel',
    title: 'Fuel Temperature',
    icon: '🧊',
    sensors: [
      { id: 'ESP32-FUEL-01', label: 'Maitri Fuel',  color: '#00d9ff', station: 'maitri'  },
      { id: 'ESP32-FUEL-11', label: 'Bharati Fuel', color: '#a855f7', station: 'bharati' },
    ],
  },
  {
    id: 'power',
    title: 'Power Grid',
    icon: '⚡',
    sensors: [
      { id: 'ESP32-PWR-01', label: 'Voltage', color: '#ffab00', unit: 'V'  },
      { id: 'ESP32-PWR-02', label: 'Current', color: '#00ff88', unit: 'A'  },
      { id: 'ESP32-PWR-03', label: 'Load',    color: '#ff2965', unit: 'kW' },
    ],
  },
  {
    id: 'env',
    title: 'Environment',
    icon: '🌤️',
    sensors: [
      { id: 'ESP32-ENV-01', label: 'Temperature', color: '#00d9ff', unit: '°C'  },
      { id: 'ESP32-ENV-02', label: 'Humidity',    color: '#a855f7', unit: '%'   },
      { id: 'ESP32-ENV-03', label: 'Pressure',    color: '#ffab00', unit: 'hPa' },
    ],
  },
  {
    id: 'equipment',
    title: 'Equipment',
    icon: '🔧',
    sensors: [
      { id: 'ESP32-GEN-01', label: 'Vibration', color: '#ff2965', unit: 'mm/s' },
      { id: 'ESP32-GEN-03', label: 'Gen Temp',  color: '#ffab00', unit: '°C'   },
    ],
  },
  {
    id: 'life',
    title: 'Life Support',
    icon: '🫁',
    sensors: [
      { id: 'ESP32-LIFE-01', label: 'CO₂',    color: '#ffab00', unit: 'ppm' },
      { id: 'ESP32-LIFE-02', label: 'Oxygen', color: '#00ff88', unit: '%'   },
    ],
  },
];

export default function LiveChart({ station = 'maitri' }) {
  const [buffer, setBuffer] = useState([]);
  const [connected, setConnected] = useState(false);
  const [sampleCount, setSampleCount] = useState(0);
  const wsRef = useRef(null);

  useEffect(() => {
    setBuffer([]);
    setSampleCount(0);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws/sensors`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      console.log('[LiveChart] WebSocket connected →', url);
    };

    ws.onmessage = (event) => {
      try {
        const reading = JSON.parse(event.data);
        const key = reading.sensor_id;
        const value = Number(reading.value);
        if (!key || Number.isNaN(value)) return;

        setBuffer((prev) => {
          const now = new Date();
          const timeLabel = now.toLocaleTimeString([], {
            hour: '2-digit', minute: '2-digit', second: '2-digit',
          });
          const last = prev[prev.length - 1];
          const lastMs = last ? new Date(last.ts).getTime() : 0;
          const nowMs = now.getTime();

          let next;
          if (last && nowMs - lastMs < 200) {
            next = [...prev.slice(0, -1), { ...last, [key]: value }];
          } else {
            next = [...prev, { ts: nowMs, time: timeLabel, [key]: value }];
          }
          return next.slice(-MAX_POINTS);
        });

        setSampleCount((c) => c + 1);
      } catch (err) {
        console.error('[LiveChart] parse error:', err);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      console.log('[LiveChart] WebSocket closed');
    };
    ws.onerror = (err) => console.error('[LiveChart] error:', err);

    return () => {
      try { ws.close(); } catch {}
    };
  }, [station]);

  if (buffer.length === 0) {
    return (
      <div className="dsv-card">
        <div className="dsv-card-head">
          <div className="dsv-card-label">📈 LIVE CHARTS</div>
          <div className="dsv-section-meta">
            {connected ? '● CONNECTED' : '○ CONNECTING'}
          </div>
        </div>
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-lo)', fontFamily: 'var(--font-mono)' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📡</div>
          <div style={{ letterSpacing: 2, fontWeight: 800 }}>AWAITING SENSOR DATA</div>
          <div style={{ fontSize: 11, marginTop: 8 }}>
            {connected ? 'Waiting for first MQTT message...' : 'Connecting to WebSocket...'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 6 }}>
      <div className="dsv-card" style={{ marginBottom: 14 }}>
        <div className="dsv-card-head">
          <div className="dsv-card-label">📈 LIVE SENSOR CHARTS · {station.toUpperCase()}</div>
          <div className="dsv-section-meta">
            <span style={{ color: connected ? '#00ff88' : '#ff2965' }}>
              {connected ? '● LIVE' : '○ DISCONNECTED'}
            </span>
            {' · '}{sampleCount} samples · {buffer.length} points
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
        gap: 14,
      }}>
        {CHART_GROUPS.map((group) => (
          <ChartCard key={group.id} group={group} buffer={buffer} station={station} />
        ))}
      </div>
    </div>
  );
}

function ChartCard({ group, buffer, station }) {
  const sensors = group.sensors.filter((s) => !s.station || s.station === station);
  if (sensors.length === 0) return null;

  const latest = buffer[buffer.length - 1] || {};

  return (
    <div className="dsv-card" style={{ minHeight: 260 }}>
      <div className="dsv-card-head">
        <div className="dsv-card-label">{group.icon} {group.title.toUpperCase()}</div>
        <div className="dsv-section-meta">{buffer.length} SAMPLES</div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        {sensors.map((s) => {
          const v = latest[s.id];
          return (
            <div key={s.id} style={{
              padding: '4px 10px', borderRadius: 6,
              background: `${s.color}15`,
              border: `1px solid ${s.color}55`,
              fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 800,
              color: s.color,
            }}>
              {s.label}: {v !== undefined ? v.toFixed(2) : '—'}{s.unit || ''}
            </div>
          );
        })}
      </div>

      <div style={{ height: 180, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={buffer} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="time" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }} interval="preserveStartEnd" minTickGap={50} />
            <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }} domain={['auto', 'auto']} />
            <Tooltip contentStyle={{
              background: 'rgba(5,11,24,0.95)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8, fontSize: 11, color: '#fff',
            }} labelStyle={{ color: '#7ec8ff', fontWeight: 800 }} />
            <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} iconType="circle" />
            {sensors.map((s) => (
              <Line key={s.id} type="monotone" dataKey={s.id}
                name={`${s.label}${s.unit ? ` (${s.unit})` : ''}`}
                stroke={s.color} strokeWidth={2} dot={false}
                isAnimationActive={false} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}