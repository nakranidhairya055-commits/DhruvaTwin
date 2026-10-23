// ═══════════════════════════════════════════════════════════════════════════
//  DHRUVATWIN DASHBOARD — ROBUST WEBSOCKET + AI CHAT
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from 'react';
import { ToastContainer, DetailModal, playAlertSound } from './Interactive';
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid,
  XAxis, YAxis, Tooltip,
} from 'recharts';

import StationMap from './StationMap';
import IoTSensors from './IOTSensors';
import LiveSensorFeed from './LiveSensorFeed';
import CascadeSim from './CascadeSim';
import OfflineMode from './OfflineMode';
import Logistics from './Logistics';
import StationTwin from './StationTwin';
import { getApiUrl, getWsUrl } from './apiConfig';

const NAV_SECTIONS = [
  {
    label: 'OPERATIONS',
    items: [
      { id: 'overview', label: 'Sensor Dashboard' },
      { id: 'sensors',  label: 'Alert Triage' },
      { id: 'live',     label: 'Live Feed' },
      { id: 'map',      label: 'Geospatial Map' },
    ],
  },
  {
    label: 'DIGITAL TWIN',
    items: [
      { id: '3d',      label: 'Digital Twin 3D' },
      { id: 'cascade', label: 'Cascade Simulation' },
      { id: 'offline', label: 'Blackout Mode' },
    ],
  },
  {
    label: 'GOVERNANCE',
    items: [
      { id: 'ledger',    label: 'Blockchain Ledger' },
      { id: 'logistics', label: 'Logistics' },
    ],
  },
];

/* ═══ TELEMETRY CHART ═══ */
function TelemetryChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)', fontSize: 12, fontFamily: 'var(--mono)' }}>
        AWAITING TELEMETRY
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis 
          dataKey="time" 
          tick={{ fontSize: 10, fill: 'rgba(230,237,243,0.35)', fontFamily: 'JetBrains Mono' }} 
          axisLine={false} 
          tickLine={false} 
        />
        <YAxis 
          tick={{ fontSize: 10, fill: 'rgba(230,237,243,0.35)', fontFamily: 'JetBrains Mono' }} 
          axisLine={false} 
          tickLine={false} 
          domain={[-60, -20]} 
        />
        <Tooltip 
          contentStyle={{ 
            borderRadius: 6, 
            border: '1px solid rgba(255,255,255,0.08)', 
            background: '#0f141d', 
            color: '#e6edf3', 
            fontSize: 11, 
            fontFamily: 'JetBrains Mono',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
          }} 
          itemStyle={{ color: '#58a6ff' }}
        />
        <Line type="monotone" dataKey="fuel_temp" stroke="#58a6ff" strokeWidth={1.8} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="ambient_temp" stroke="#8b5cf6" strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ═══ KPI CARD ═══ */
function KpiCard({ label, value, unit, tone = 'default', sub, onClick }) {
  const toneColors = {
    default: '#e6edf3',
    accent: '#58a6ff',
    success: '#3fb950',
    warning: '#d29922',
    danger: '#f85149',
  };

  return (
    <div
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '18px 20px',
        transition: 'border-color 0.15s ease',
        position: 'relative',
      }}
      onMouseEnter={(e) => { if (onClick) e.currentTarget.style.borderColor = 'rgba(88,166,255,0.3)'; }}
      onMouseLeave={(e) => { if (onClick) e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      <div style={{
        fontSize: 10.5,
        color: 'var(--text-dim)',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 14,
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <div style={{
          fontSize: 26,
          fontWeight: 600,
          fontFamily: 'var(--mono)',
          color: toneColors[tone],
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}>
          {value ?? '—'}
        </div>
        {unit && (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
            {unit}
          </div>
        )}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 10, lineHeight: 1.4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

/* ═══ MAIN ═══ */
function Dashboard({ profile = 'commander' }) {
  const safeProfile = typeof profile === 'string' && profile.trim() ? profile.toLowerCase() : 'commander';

  const [activeDashboard, setActiveDashboard] = useState('maitri');
  const [activeTab, setActiveTab] = useState('overview');
  const [telemetry, setTelemetry] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [stationInfo, setStationInfo] = useState(null);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertLevel, setAlertLevel] = useState('normal');
  const [history, setHistory] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [modal, setModal] = useState(null);
  const [clock, setClock] = useState(new Date());
  
  // Chat state
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [botTyping, setBotTyping] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [wsStatus, setWsStatus] = useState('connecting');  // 'connecting' | 'open' | 'closed' | 'error'

  const ws = useRef(null);
  const reconnectTimer = useRef(null);
  const wsAlive = useRef(true);
  const chatEndRef = useRef(null);
  const lastCritical = useRef(false);

  const pushToast = (t) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4500);
  };

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* ═══════════════════════════════════════════════════════════
     WEBSOCKET — with auto-reconnect and visible status
     ═══════════════════════════════════════════════════════════ */
  useEffect(() => {
    wsAlive.current = true;

    const connect = () => {
      if (!wsAlive.current) return;

      try {
        const chatWsUrl = getWsUrl('/ws/chat');
        console.log('[WS] Connecting to ' + chatWsUrl + ' ...');
        setWsStatus('connecting');
        ws.current = new WebSocket(chatWsUrl);

        ws.current.onopen = () => {
          console.log('[WS] ✅ Connected');
          setWsStatus('open');
        };

        ws.current.onmessage = (event) => {
          setBotTyping(false);
          setMessages((prev) => [
            ...prev,
            {
              text: event.data,
              sender: 'bot',
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
        };

        ws.current.onclose = (e) => {
          console.warn(`[WS] ❌ Closed (code=${e.code}) — retrying in 3s`);
          setWsStatus('closed');
          if (wsAlive.current) {
            reconnectTimer.current = setTimeout(connect, 3000);
          }
        };

        ws.current.onerror = (e) => {
          console.error('[WS] Error:', e);
          setWsStatus('error');
        };
      } catch (e) {
        console.error('[WS] Failed to create WebSocket:', e);
        setWsStatus('error');
        if (wsAlive.current) {
          reconnectTimer.current = setTimeout(connect, 3000);
        }
      }
    };

    connect();

    return () => {
      wsAlive.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (ws.current) {
        try { ws.current.close(); } catch (e) { /* silent */ }
      }
    };
  }, []);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, botTyping, isChatOpen]);

  /* ═══════════════════════════════════════════════════════════
     SEND MESSAGE — uses WS if open, else mock fallback
     ═══════════════════════════════════════════════════════════ */
  const sendMessage = () => {
    if (input.trim() === '') return;

    const userMsg = input;

    setMessages((prev) => [
      ...prev,
      {
        text: userMsg,
        sender: 'user',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    // If WebSocket is OPEN → real AI
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      console.log('[CHAT] → WS send:', userMsg);
      setBotTyping(true);
      ws.current.send(`${activeDashboard}:${userMsg}`);
    } else {
      // Fallback: mock response (only used when WS is truly unavailable)
      console.warn(`[CHAT] ⚠️ WebSocket not open (state=${ws.current?.readyState}). Using mock.`);
      setBotTyping(true);
      setTimeout(() => {
        setBotTyping(false);
        let response = `[OFFLINE] "${userMsg}" — backend not reachable.`;
        const lc = userMsg.toLowerCase();
        if (lc.includes('status')) response = `[OFFLINE] All systems nominal.`;
        else if (lc.includes('fuel')) response = `[OFFLINE] Fuel temp: ${telemetry?.fuel_temp ?? '-45'}°C.`;
        else if (lc.includes('weather')) response = `[OFFLINE] Ambient: ${telemetry?.ambient_temp ?? '-20'}°C.`;
        else if (lc.includes('help')) response = `[OFFLINE] Start main.py to enable AI.`;

        setMessages((prev) => [
          ...prev,
          {
            text: response,
            sender: 'bot',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }, 800);
    }
    setInput('');
  };

  /* ═══════════════════════════════════════════════════════════
     TELEMETRY POLL
     ═══════════════════════════════════════════════════════════ */
  useEffect(() => {
    setTelemetry(null);
    setAlertMessage('');
    setAlertLevel('normal');

    const now = Date.now();
    const seed = Array.from({ length: 12 }, (_, i) => ({
      time: new Date(now - (12 - i) * 15000).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }),
      fuel_temp: parseFloat((-35 + (Math.random() * 8 - 4)).toFixed(1)),
      ambient_temp: parseFloat((-25 + (Math.random() * 6 - 3)).toFixed(1)),
      wind_speed: Math.round(45 + (Math.random() * 10 - 5)),
      ice_thickness: parseFloat((1.5 + (Math.random() * 0.4 - 0.2)).toFixed(2)),
    }));
    setHistory(seed);
    lastCritical.current = false;

    const f = async () => {
      try {
        const r = await fetch(getApiUrl(`/api/telemetry/${activeDashboard}`));
        if (!r.ok) throw new Error();
        const d = await r.json();
        setTelemetry(d);
        setHistory((prev) => [...prev, {
          time: new Date().toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }),
          fuel_temp: d.fuel_temp,
          ambient_temp: d.ambient_temp,
          wind_speed: d.wind_speed,
          ice_thickness: d.ice_thickness,
        }].slice(-40));

        if (d.fuel_temp < -50) {
          setAlertMessage(`Critical: ${d.station} fuel freezing at ${d.fuel_temp}°C`);
          setAlertLevel('critical');
          if (!lastCritical.current) {
            lastCritical.current = true;
            playAlertSound();
            pushToast({ type: 'critical', title: `Critical · ${d.station}`, message: `Fuel ${d.fuel_temp}°C` });
          }
        } else if (d.fuel_temp < -40) {
          setAlertMessage(`Warning: ${d.station} fuel temp low at ${d.fuel_temp}°C`);
          setAlertLevel('warning');
          lastCritical.current = false;
        } else {
          setAlertMessage('');
          setAlertLevel('normal');
          lastCritical.current = false;
        }
      } catch (e) {
        const mockData = {
          station: activeDashboard,
          fuel_temp: parseFloat((-45 + (Math.random() * 8 - 4)).toFixed(1)),
          ambient_temp: parseFloat((-20 + (Math.random() * 6 - 3)).toFixed(1)),
          wind_speed: Math.round(42 + (Math.random() * 10 - 5)),
          ice_thickness: parseFloat((1.8 + (Math.random() * 0.4 - 0.2)).toFixed(2)),
          personnel: 22, power_output: 97, satellite_link: 'Intermittent',
          humidity: 65, pressure: 980, radiation: 0.12, auto_heal: 'Active'
        };
        setTelemetry(mockData);
        setHistory((prev) => [...prev, {
          time: new Date().toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }),
          fuel_temp: mockData.fuel_temp,
          ambient_temp: mockData.ambient_temp,
          wind_speed: mockData.wind_speed,
          ice_thickness: mockData.ice_thickness,
        }].slice(-40));
      }
    };

    f();
    const i = setInterval(f, 3000);
    return () => clearInterval(i);
  }, [activeDashboard]);

  /* ═══════════════════════════════════════════════════════════
     LEDGER POLL
     ═══════════════════════════════════════════════════════════ */
  useEffect(() => {
    setLedger(null);
    const f = async () => {
      try {
        const r = await fetch(getApiUrl(`/api/ledger/${activeDashboard}`));
        if (!r.ok) throw new Error();
        setLedger(await r.json());
      } catch (e) {
        setLedger({
          total_blocks: 1253,
          blocks: Array.from({ length: 4 }).map((_, i) => ({
            index: 1253 - i,
            timestamp: new Date(Date.now() - i * 60000).toISOString(),
            hash: `0x${Math.random().toString(16).substring(2, 42)}`,
            data: `Telemetry batch #${1253 - i} recorded`
          }))
        });
      }
    };
    f();
    const i = setInterval(f, 15000);
    return () => clearInterval(i);
  }, [activeDashboard]);

  /* ═══════════════════════════════════════════════════════════
     STATION INFO
     ═══════════════════════════════════════════════════════════ */
  useEffect(() => {
    setStationInfo(null);
    fetch(getApiUrl(`/api/station-info/${activeDashboard}`))
      .then((r) => r.json())
      .then(setStationInfo)
      .catch(() => {
        setStationInfo({
          name: activeDashboard === 'maitri' ? 'Maitri' : 'Bharati',
          region: 'Schirmacher Oasis, Central Dronning Maud Land',
          coordinates: '-70.76S 11.73E',
          commissioned: '1989',
          elevation_m: 120, capacity_main: 25, capacity_total: 45,
          built_from: 'Prefabricated containers',
          communication: 'VSAT / Iridium',
          power: 'Diesel + Solar'
        });
      });
  }, [activeDashboard]);

  const isMaitri = activeDashboard === 'maitri';

  const openMetric = (key) => {
    const map = {
      fuel_temp:    { title: 'Fuel Temperature',    sub: 'Rolling samples' },
      ambient_temp: { title: 'Ambient Temperature', sub: 'Outside air' },
      wind_speed:   { title: 'Wind Speed',          sub: 'Sustained velocity' },
      ice_thickness:{ title: 'Ice Thickness',       sub: 'Sea ice measurement' },
    };
    if (map[key]) setModal({ key, ...map[key] });
  };

  const criticalCount = history.filter(h => h.fuel_temp < -50).length;
  const warningCount = history.filter(h => h.fuel_temp >= -50 && h.fuel_temp < -40).length;
  const nominalCount = history.length - criticalCount - warningCount;

  // WebSocket status pill colors
  const wsTone = wsStatus === 'open' ? 'success'
                : wsStatus === 'connecting' ? 'warning'
                : 'danger';
  const wsLabel = wsStatus === 'open' ? 'LIVE AI'
                : wsStatus === 'connecting' ? 'CONNECTING'
                : 'OFFLINE';

  return (
    <div className="dsv" style={{
      background: '#0a0e14',
      minHeight: '100vh',
      color: '#e6edf3',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display: 'flex',
      flexDirection: 'column',
      fontSize: 13,
      '--panel': '#0f141d',
      '--border': 'rgba(255,255,255,0.06)',
      '--text-dim': 'rgba(230,237,243,0.5)',
      '--text-mute': 'rgba(230,237,243,0.35)',
      '--mono': 'JetBrains Mono, "SF Mono", Consolas, monospace',
    }}>
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />

      <DetailModal open={!!modal} onClose={() => setModal(null)} title={modal?.title} subtitle={modal?.sub}>
        {modal && (
          <>
            <div style={{ padding: 16, borderRadius: 8, background: '#0f141d', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: 'rgba(230,237,243,0.5)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Current Reading
              </div>
              <div style={{ fontSize: 32, fontWeight: 600, color: '#58a6ff', fontFamily: 'JetBrains Mono', marginTop: 8 }}>
                {telemetry?.[modal.key]}
                {modal.key === 'ice_thickness' ? ' m' : modal.key === 'wind_speed' ? ' km/h' : '°C'}
              </div>
            </div>
            <div style={{ height: 220, width: '100%' }}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'rgba(230,237,243,0.4)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'rgba(230,237,243,0.4)' }} />
                  <Tooltip contentStyle={{ borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: '#0f141d', color: '#fff', fontSize: 12 }} />
                  <Line type="monotone" dataKey={modal.key} stroke="#58a6ff" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </DetailModal>

      {/* ═══ TOP BAR ═══ */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 56,
        background: '#0a0e14', borderBottom: '1px solid var(--border)',
        zIndex: 50, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 26, height: 26,
              background: 'linear-gradient(135deg, #58a6ff, #2563eb)',
              borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 800, fontSize: 13,
            }}>D</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em' }}>DhruvaTwin</div>
              <div style={{ fontSize: 9, color: 'var(--text-mute)', letterSpacing: '0.08em', fontWeight: 500 }}>TEAM HACKFINITY007</div>
            </div>
          </div>

          <div style={{ width: 1, height: 24, background: 'var(--border)' }} />

          <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.03)', padding: 3, borderRadius: 7, border: '1px solid var(--border)' }}>
            <button
              onClick={() => { setActiveDashboard('maitri'); setActiveTab('overview'); }}
              style={{
                padding: '6px 14px', borderRadius: 5, border: 'none',
                background: isMaitri ? 'rgba(88,166,255,0.12)' : 'transparent',
                color: isMaitri ? '#58a6ff' : 'var(--text-dim)',
                fontWeight: 600, fontSize: 11, cursor: 'pointer',
                letterSpacing: '0.02em', transition: 'all 0.15s',
              }}
            >MAITRI</button>
            <button
              onClick={() => { setActiveDashboard('bharati'); setActiveTab('overview'); }}
              style={{
                padding: '6px 14px', borderRadius: 5, border: 'none',
                background: !isMaitri ? 'rgba(88,166,255,0.12)' : 'transparent',
                color: !isMaitri ? '#58a6ff' : 'var(--text-dim)',
                fontWeight: 600, fontSize: 11, cursor: 'pointer',
                letterSpacing: '0.02em', transition: 'all 0.15s',
              }}
            >BHARATI</button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11 }}>
          <StatusPill tone="success">Drop predicted in 37m · 73.2% confidence</StatusPill>
          <StatusPill tone="warning">Syncing · 0 queued</StatusPill>
          <div style={{ color: 'var(--text-dim)', fontFamily: 'var(--mono)', fontSize: 11 }}>
            {clock.toLocaleDateString('en-CA')} {clock.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} UTC
          </div>
          <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
              <div style={{ fontSize: 9, color: 'var(--text-mute)', letterSpacing: '0.06em', fontWeight: 600 }}>OPERATOR</div>
              <div style={{ fontSize: 11, color: '#e6edf3', fontWeight: 600 }}>{safeProfile.toUpperCase()}</div>
            </div>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'linear-gradient(135deg, #58a6ff, #2563eb)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: 11,
            }}>O</div>
          </div>
        </div>
      </div>

      {/* ═══ BODY ═══ */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* SIDEBAR */}
        <div style={{
          width: 240, background: '#0a0e14',
          borderRight: '1px solid var(--border)',
          overflowY: 'auto', flexShrink: 0, paddingTop: 20,
        }}>
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{ fontSize: 9.5, color: 'var(--text-mute)', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8 }}>ROLE VIEW</div>
            <select style={{
              width: '100%', padding: '8px 10px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border)', borderRadius: 6,
              color: '#e6edf3', fontSize: 12, outline: 'none', cursor: 'pointer',
            }}>
              <option>Scientist</option>
              <option>Engineer</option>
              <option>Commander</option>
            </select>
          </div>

          {NAV_SECTIONS.map((section) => (
            <React.Fragment key={section.label}>
              <div style={{
                padding: '16px 16px 6px',
                fontSize: 9.5, color: 'var(--text-mute)',
                fontWeight: 700, letterSpacing: '0.1em',
              }}>{section.label}</div>
              {section.items.map((item) => {
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', padding: '8px 16px',
                      background: active ? 'rgba(88,166,255,0.06)' : 'transparent',
                      border: 'none',
                      borderLeft: active ? '2px solid #58a6ff' : '2px solid transparent',
                      color: active ? '#e6edf3' : 'var(--text-dim)',
                      fontSize: 12.5, fontWeight: active ? 600 : 500,
                      cursor: 'pointer', transition: 'all 0.1s',
                      textAlign: 'left', fontFamily: 'inherit',
                    }}
                  >
                    <span style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: active ? '#58a6ff' : 'rgba(255,255,255,0.15)',
                    }} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </div>

        {/* MAIN */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-mute)', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8 }}>
                    SENSOR DASHBOARD
                  </div>
                  <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
                    {stationInfo?.name ?? (isMaitri ? 'Maitri' : 'Bharati')} Live Telemetry
                  </h1>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
                    {stationInfo?.region ?? 'Schirmacher Oasis'} · {stationInfo?.coordinates ?? '-70.76S 11.73E'} · Est. {stationInfo?.commissioned ?? '1989'}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <StatusPill tone="success">Simulation Feed</StatusPill>
                  <div style={{ fontSize: 10.5, color: 'var(--text-mute)', fontFamily: 'var(--mono)' }}>last tick 1s ago</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <KpiCard label="Critical Sensors" value={criticalCount} tone="danger" sub="threshold breaches in critical band" />
                <KpiCard label="Warnings & Watches" value={warningCount} tone="warning" sub="outside nominal band, not critical" />
                <KpiCard label="Nominal Sensors" value={nominalCount} tone="success" sub="inside all threshold bands" />
                <KpiCard label="Ambient Temperature" value={telemetry?.ambient_temp ?? '—'} unit="°C" tone="accent" sub="automatic weather station" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, padding: '20px 22px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#e6edf3', letterSpacing: '0.06em' }}>FEATURED SENSOR</div>
                      <div style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 4 }}>
                        PIPE-MAITRI · thermal pipeline temp · rolling 30 min window
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Tag color="blue">GEN-1</Tag>
                      <Tag color="purple">PIPELINE</Tag>
                    </div>
                  </div>
                  <div style={{ height: 260, width: '100%' }}>
                    <TelemetryChart data={history} />
                  </div>
                </div>

                <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, padding: '20px 22px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#e6edf3', letterSpacing: '0.06em' }}>LIVE ALERT FEED</div>
                    <div style={{ fontSize: 11, color: '#58a6ff', cursor: 'pointer', fontWeight: 600 }}>Triage</div>
                  </div>
                  
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '20px 0' }}>
                    {alertMessage ? (
                      <div style={{ textAlign: 'center', maxWidth: '100%' }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: '50%',
                          background: alertLevel === 'critical' ? 'rgba(248,81,73,0.12)' : 'rgba(210,153,34,0.12)',
                          color: alertLevel === 'critical' ? '#f85149' : '#d29922',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 18, fontWeight: 700, margin: '0 auto 16px',
                          border: `1px solid ${alertLevel === 'critical' ? 'rgba(248,81,73,0.3)' : 'rgba(210,153,34,0.3)'}`,
                        }}>!</div>
                        <div style={{
                          fontSize: 12, fontWeight: 700,
                          color: alertLevel === 'critical' ? '#f85149' : '#d29922',
                          marginBottom: 10, letterSpacing: '0.04em', textTransform: 'uppercase',
                        }}>
                          {alertLevel === 'critical' ? 'Critical Alert' : 'Warning'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>{alertMessage}</div>
                      </div>
                    ) : (
                      <>
                        <div style={{
                          width: 40, height: 40, borderRadius: '50%',
                          background: 'rgba(63,185,80,0.1)', color: '#3fb950',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 18, fontWeight: 700, border: '1px solid rgba(63,185,80,0.25)',
                        }}>✓</div>
                        <div style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.5 }}>
                          No open alerts.<br />All sensors nominal.
                        </div>
                      </>
                    )}
                  </div>

                  <button 
                    onClick={() => setIsChatOpen(!isChatOpen)}
                    style={{
                      width: '100%', padding: '10px', background: '#58a6ff',
                      border: 'none', borderRadius: 7, color: '#0a0e14',
                      fontWeight: 700, fontSize: 12, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: 8, letterSpacing: '0.02em', transition: 'all 0.15s',
                    }}
                  >
                    Station Assistant
                    <span style={{
                      fontSize: 10, background: 'rgba(10,14,20,0.25)',
                      padding: '2px 6px', borderRadius: 3,
                      fontFamily: 'var(--mono)', fontWeight: 600,
                    }}>Ctrl+K</span>
                  </button>
                </div>
              </div>

              {telemetry && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
                  <KpiCard label="Ice Thickness" value={telemetry.ice_thickness} unit="m" sub="sea ice measurement" />
                  <KpiCard label="Wind Speed" value={telemetry.wind_speed} unit="km/h" sub="sustained velocity" />
                  <KpiCard label="Humidity" value={telemetry.humidity} unit="%" sub="relative humidity" />
                  <KpiCard label="Pressure" value={telemetry.pressure} unit="hPa" sub="atmospheric pressure" />
                  <KpiCard label="Radiation" value={telemetry.radiation} unit="µSv/h" sub="ambient dose rate" />
                  <KpiCard label="Auto-Heal" value={telemetry.auto_heal} tone="success" sub="system status" />
                </div>
              )}
            </div>
          )}

          {activeTab === 'sensors' && (
            <div style={{ height: 'calc(100vh - 130px)', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, padding: 8 }}>
              <IoTSensors station={activeDashboard} />
            </div>
          )}
          
          {activeTab === 'live' && (
            <div style={{ height: 'calc(100vh - 130px)', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, padding: 8 }}>
              <LiveSensorFeed station={activeDashboard} />
            </div>
          )}
          
          {activeTab === 'map' && (
            <div style={{ height: 'calc(100vh - 130px)', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, padding: 8 }}>
              <StationMap />
            </div>
          )}
          
          {activeTab === '3d' && (
            <div style={{ height: 'calc(100vh - 130px)', width: '100%', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <StationTwin key={`twin-${activeDashboard}`} station={activeDashboard} telemetry={telemetry} onStationChange={(s) => setActiveDashboard(s)} />
            </div>
          )}
          
          {activeTab === 'cascade' && (
            <div style={{ height: 'calc(100vh - 130px)', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, padding: 8 }}>
              <CascadeSim key={`cascade-${activeDashboard}`} />
            </div>
          )}
          
          {activeTab === 'offline' && (
            <div style={{ height: 'calc(100vh - 130px)', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, padding: 8 }}>
              <OfflineMode key={`offline-${activeDashboard}`} />
            </div>
          )}
          
          {activeTab === 'ledger' && (
            <div style={{
              background: 'var(--panel)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '22px 24px',
              height: 'calc(100vh - 130px)', overflowY: 'auto',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.02em' }}>Blockchain Ledger</div>
                <div style={{ fontSize: 11, color: '#58a6ff', fontFamily: 'var(--mono)' }}>{ledger?.total_blocks ?? 0} blocks</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(ledger?.blocks || []).map((b) => (
                  <div key={b.index} style={{
                    padding: '14px 16px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, letterSpacing: '0.04em' }}>
                        BLOCK #{b.index}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-mute)', fontFamily: 'var(--mono)' }}>
                        {b.timestamp.substring(11, 19)}
                      </div>
                    </div>
                    <div style={{
                      fontSize: 11, fontFamily: 'var(--mono)', color: '#58a6ff',
                      wordBreak: 'break-all', marginBottom: 8,
                      background: 'rgba(88,166,255,0.05)',
                      padding: '6px 10px', borderRadius: 4,
                    }}>{b.hash}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{b.data}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {activeTab === 'logistics' && (
            <div style={{ height: 'calc(100vh - 130px)', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, padding: 8 }}>
              <Logistics station={activeDashboard} />
            </div>
          )}
        </div>
      </div>

      {/* ═══ CHAT ASSISTANT ═══ */}
      {isChatOpen && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          width: 380, height: 520,
          background: '#0a0e14',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          boxShadow: '0 24px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', zIndex: 1000,
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(255,255,255,0.02)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 7,
                background: 'linear-gradient(135deg, #58a6ff, #2563eb)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 800, fontSize: 12,
              }}>S</div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>Station Assistant</div>
                <div style={{ fontSize: 10, color: wsStatus === 'open' ? '#3fb950' : wsStatus === 'connecting' ? '#d29922' : '#f85149', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
                  {botTyping ? 'PROCESSING' : wsLabel}
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsChatOpen(false)}
              style={{
                background: 'transparent', border: 'none',
                color: 'var(--text-mute)', fontSize: 16,
                cursor: 'pointer', padding: 4, lineHeight: 1,
              }}
            >×</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-mute)', fontSize: 11.5, marginTop: 40, lineHeight: 1.6 }}>
                Ask a question about the station.<br />
                Try: <span style={{ color: '#58a6ff', fontFamily: 'var(--mono)' }}>status</span>, <span style={{ color: '#58a6ff', fontFamily: 'var(--mono)' }}>fuel</span>, <span style={{ color: '#58a6ff', fontFamily: 'var(--mono)' }}>what if generator fails</span>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={{ alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                <div style={{
                  fontSize: 9, color: 'var(--text-mute)', marginBottom: 4,
                  letterSpacing: '0.08em', fontWeight: 600,
                  textAlign: msg.sender === 'user' ? 'right' : 'left',
                }}>
                  {msg.sender === 'user' ? 'OPERATOR' : 'SYSTEM'}
                </div>
                <div style={{
                  padding: '9px 12px', borderRadius: 8,
                  background: msg.sender === 'user' ? 'rgba(88,166,255,0.12)' : 'rgba(255,255,255,0.03)',
                  border: msg.sender === 'user' ? '1px solid rgba(88,166,255,0.25)' : '1px solid var(--border)',
                  fontSize: 12, lineHeight: 1.5, color: '#e6edf3',
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.text}
                </div>
                <div style={{
                  fontSize: 9.5, color: 'var(--text-mute)', marginTop: 4,
                  fontFamily: 'var(--mono)',
                  textAlign: msg.sender === 'user' ? 'right' : 'left',
                }}>{msg.time || ''}</div>
              </div>
            ))}
            {botTyping && (
              <div style={{ alignSelf: 'flex-start' }}>
                <div style={{ fontSize: 9, color: 'var(--text-mute)', marginBottom: 4, letterSpacing: '0.08em', fontWeight: 600 }}>SYSTEM</div>
                <div style={{
                  display: 'flex', gap: 4, padding: '10px 14px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 8, border: '1px solid var(--border)',
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#58a6ff', animation: 'pulse 1s infinite' }} />
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#58a6ff', animation: 'pulse 1s infinite 0.2s' }} />
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#58a6ff', animation: 'pulse 1s infinite 0.4s' }} />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick chips */}
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['status', 'fuel', 'what if generator fails', 'help'].map((c) => (
              <button
                key={c}
                onClick={() => setInput(c)}
                style={{
                  padding: '4px 10px', background: 'rgba(88,166,255,0.08)',
                  border: '1px solid rgba(88,166,255,0.2)', borderRadius: 5,
                  color: '#58a6ff', fontSize: 10.5, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'var(--mono)',
                }}
              >{c}</button>
            ))}
          </div>

          {/* Input */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type a command..."
              style={{
                flex: 1, padding: '9px 12px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--border)',
                borderRadius: 7, color: '#e6edf3',
                fontSize: 12, outline: 'none', fontFamily: 'inherit',
              }}
              onFocus={(e) => { e.target.style.borderColor = 'rgba(88,166,255,0.4)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              style={{
                padding: '9px 16px',
                background: input.trim() ? '#58a6ff' : 'rgba(255,255,255,0.04)',
                border: 'none', borderRadius: 7,
                color: input.trim() ? '#0a0e14' : 'var(--text-mute)',
                fontWeight: 700, fontSize: 11,
                cursor: input.trim() ? 'pointer' : 'not-allowed',
                letterSpacing: '0.04em', transition: 'all 0.15s',
              }}
            >SEND</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ HELPER: STATUS PILL ═══ */
function StatusPill({ children, tone = 'default' }) {
  const tones = {
    success: { bg: 'rgba(63,185,80,0.08)', border: 'rgba(63,185,80,0.2)', color: '#3fb950' },
    warning: { bg: 'rgba(210,153,34,0.08)', border: 'rgba(210,153,34,0.2)', color: '#d29922' },
    danger: { bg: 'rgba(248,81,73,0.08)', border: 'rgba(248,81,73,0.2)', color: '#f85149' },
    default: { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', color: 'rgba(230,237,243,0.7)' },
  };
  const t = tones[tone] || tones.default;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 10px', borderRadius: 999,
      background: t.bg, border: `1px solid ${t.border}`,
      color: t.color, fontSize: 10.5, fontWeight: 600,
      letterSpacing: '0.02em',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
      {children}
    </div>
  );
}

/* ═══ HELPER: TAG ═══ */
function Tag({ children, color = 'blue' }) {
  const colors = {
    blue: { bg: 'rgba(88,166,255,0.08)', border: 'rgba(88,166,255,0.2)', color: '#58a6ff' },
    purple: { bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.2)', color: '#8b5cf6' },
    green: { bg: 'rgba(63,185,80,0.08)', border: 'rgba(63,185,80,0.2)', color: '#3fb950' },
  };
  const t = colors[color] || colors.blue;
  return (
    <span style={{
      padding: '3px 8px',
      background: t.bg, border: `1px solid ${t.border}`,
      color: t.color, borderRadius: 4, fontSize: 10,
      fontWeight: 600, fontFamily: 'var(--mono)',
      letterSpacing: '0.04em',
    }}>{children}</span>
  );
}

export default Dashboard;