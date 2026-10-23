import React, { useEffect, useRef, useState } from 'react';
import {
  AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

/* ═══════════════════════════════════════════
   1. ANIMATED NUMBER COUNTER
   ═══════════════════════════════════════════ */
export function AnimatedNumber({ value, decimals = 0, suffix = '' }) {
  const [display, setDisplay] = useState(value ?? 0);
  const fromRef = useRef(value ?? 0);
  const startRef = useRef(0);
  const rafRef = useRef();

  useEffect(() => {
    if (value == null) return;
    const from = fromRef.current;
    const to = value;
    const duration = 600;
    startRef.current = performance.now();

    const tick = (now) => {
      const t = Math.min((now - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  return (
    <>
      {Number(display).toFixed(decimals)}
      {suffix}
    </>
  );
}

/* ═══════════════════════════════════════════
   2. TOAST NOTIFICATIONS
   ═══════════════════════════════════════════ */
export function ToastContainer({ toasts, onDismiss }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => onDismiss(t.id)}
          style={{
            pointerEvents: 'auto',
            minWidth: '280px',
            maxWidth: '400px',
            padding: '14px 18px',
            borderRadius: '14px',
            background:
              t.type === 'critical'
                ? 'linear-gradient(135deg, rgba(220,38,38,0.98), rgba(239,68,68,0.95))'
                : t.type === 'warning'
                ? 'linear-gradient(135deg, rgba(245,158,11,0.98), rgba(251,191,36,0.95))'
                : 'linear-gradient(135deg, rgba(30,90,138,0.98), rgba(74,159,212,0.95))',
            color: '#fff',
            boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
            backdropFilter: 'blur(12px)',
            cursor: 'pointer',
            animation: 'toastIn 0.35s cubic-bezier(.2,.8,.2,1)',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>{t.icon || '🔔'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '13px' }}>{t.title}</div>
              {t.message && (
                <div style={{ fontSize: '11.5px', opacity: 0.92, marginTop: '2px' }}>
                  {t.message}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   3. LIVE CHART (sparkline)
   ═══════════════════════════════════════════ */
export function LiveChart({ data, dataKey, color = '#e63946', height = 80, unit = '' }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.5} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="time" hide />
        <YAxis hide domain={['auto', 'auto']} />
        <Tooltip
          contentStyle={{
            background: 'rgba(15,35,64,0.95)',
            border: 'none',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#fff',
          }}
          labelStyle={{ color: '#9ec6ff' }}
          formatter={(v) => [`${v}${unit}`, dataKey]}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2.5}
          fill={`url(#grad-${dataKey})`}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ═══════════════════════════════════════════
   4. DETAIL MODAL
   ═══════════════════════════════════════════ */
export function DetailModal({ open, onClose, title, subtitle, children }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5,11,24,0.72)',
        backdropFilter: 'blur(8px)',
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.25s',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(255,255,255,0.98)',
          color: '#0f2340',
          borderRadius: '20px',
          padding: '24px',
          maxWidth: '720px',
          width: '90%',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
          animation: 'modalIn 0.35s cubic-bezier(.2,.8,.2,1)',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: 'none',
            background: '#eef2f7',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 700,
            color: '#5b6b83',
          }}
        >
          ✕
        </button>
        <h2 style={{ margin: '0 0 4px', fontSize: '20px' }}>{title}</h2>
        {subtitle && (
          <p style={{ margin: 0, fontSize: '12.5px', color: '#5b6b83' }}>{subtitle}</p>
        )}
        <div style={{ marginTop: '18px' }}>{children}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   5. SOUND ALERT
   ═══════════════════════════════════════════ */
export function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(660, now + 0.15);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.start(now);
    osc.stop(now + 0.4);
  } catch (e) {
    /* silent */
  }
}