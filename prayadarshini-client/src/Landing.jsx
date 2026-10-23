import React, { useEffect, useState } from 'react';

const STATIONS = [
  {
    id: 'maitri',
    name: 'Maitri',
    hindi: 'मैत्री',
    
    accent: '#e63946',
    est: 1989,
    location: 'Schirmacher Oasis',
    desc: 'India\'s second permanent Antarctic base',
  },
  {
    id: 'bharati',
    name: 'Bharati',
    hindi: 'भारती',
    accent: '#1e5a8a',
    est: 2012,
    location: 'Larsemann Hills',
    desc: 'India\'s third permanent Antarctic base',
  },
];

const FEATURES = [
  { title: 'MQTT Telemetry', desc: 'Live sensor stream from edge devices' },
  {  title: '3D Digital Twin', desc: 'Interactive models of both stations' },
  { title: 'AI Assistant', desc: 'Natural language operations chat' },
  {  title: 'Blockchain Ledger', desc: 'Tamper-proof event logging' },
];

export default function Landing({ onEnter }) {
  const [time, setTime] = useState(new Date());
  const [preview, setPreview] = useState(null);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch live telemetry preview (real data from your backend!)
  useEffect(() => {
    const f = async () => {
      try {
        const r = await fetch(`http://localhost:8000/api/telemetry/maitri`);
        setPreview(await r.json());
      } catch {
        /* backend may not be running */
      }
    };
    f();
    const i = setInterval(f, 5000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="mc-page">
      {/* ═════ Animated aurora background ═════ */}
      <div className="mc-aurora" />
      <div className="mc-grid-overlay" />

      {/* ═════ NAV ═════ */}
      <nav className="mc-nav">
        <div className="mc-logo">
          <span style={{ fontSize: '22px' }}></span>
          <div>
            <div className="mc-logo-name">DHRUVA TWIN</div>
            <div className="mc-logo-sub">POLAR TWIN · SIH26060</div>
          </div>
        </div>

        <div className="mc-nav-right">
          <div className="mc-sys-status">
            <span className="mc-dot" />
            <span>SYS ONLINE</span>
          </div>
          <div className="mc-clock">
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <button className="mc-nav-btn" onClick={onEnter}>
            Enter Console →
          </button>
        </div>
      </nav>

      {/* ═════ HERO ═════ */}
      <section className="mc-hero">
        {/* LEFT: Text */}
        <div className="mc-hero-text">
          <div className="mc-tag">
            <span className="mc-tag-line" />
            MISSION CONTROL · LIVE
          </div>

          <h1 className="mc-title">
            DHRUVA TWIN
            <span className="mc-title-sub"> A Pole-Star-Inspired, Resilient AIoT-Enabled Digital Twin Framework for Antarctic Research Stations</span>
          </h1>

          <p className="mc-lead">
            A unified digital twin for India's Antarctic research stations —
            streaming real-time telemetry, predictive auto-heal, and blockchain-verified
            data integrity from Maitri &amp; Bharati.
          </p>

          <div className="mc-cta-row">
            <button className="mc-cta-primary" onClick={() => onEnter('commander')}> Launch Mission Control</button>
            <button className="mc-cta-secondary" onClick={onEnter}>
              Watch Demo ▶
            </button>
          </div>

          <div className="mc-trust-row">
            <div className="mc-trust-item">
              <span className="mc-trust-num">25+</span>
              <span className="mc-trust-label">Live sensors</span>
            </div>
            <div className="mc-trust-divider" />
            <div className="mc-trust-item">
              <span className="mc-trust-num">&lt;100ms</span>
              <span className="mc-trust-label">Latency</span>
            </div>
            <div className="mc-trust-divider" />
            <div className="mc-trust-item">
              <span className="mc-trust-num">100%</span>
              <span className="mc-trust-label">Uptime</span>
            </div>
          </div>
        </div>

        {/* RIGHT: Live data preview card */}
        <div className="mc-hero-visual">
          <div className="mc-preview-card">
            <div className="mc-preview-header">
              <div className="mc-preview-title">
                <span className="mc-dot live" />
                LIVE · MAITRI STATION
              </div>
              <span className="mc-preview-time">
                {preview ? 'updated 5s ago' : 'connecting...'}
              </span>
            </div>

            <div className="mc-preview-grid">
              <div className="mc-preview-tile">
                <div className="mc-preview-icon"></div>
                <div className="mc-preview-value">
                  {preview?.fuel_temp ?? '—'}°C
                </div>
                <div className="mc-preview-label">Fuel Temp</div>
              </div>
              <div className="mc-preview-tile">
                <div className="mc-preview-icon"></div>
                <div className="mc-preview-value">
                  {preview?.wind_speed ?? '—'} <span style={{ fontSize: '12px' }}>km/h</span>
                </div>
                <div className="mc-preview-label">Wind Speed</div>
              </div>
              <div className="mc-preview-tile">
                <div className="mc-preview-icon"></div>
                <div className="mc-preview-value">{preview?.personnel ?? '—'}</div>
                <div className="mc-preview-label">Personnel</div>
              </div>
              <div className="mc-preview-tile">
                <div className="mc-preview-icon"></div>
                <div className="mc-preview-value">{preview?.power_output ?? '—'}%</div>
                <div className="mc-preview-label">Power</div>
              </div>
            </div>

            <div className="mc-preview-footer">
              <span> MQTT · polar/station/maitri/sensor/#</span>
              <span className="mc-preview-live">
                <span className="mc-dot live" /> Streaming
              </span>
            </div>
          </div>

          {/* Floating side badges */}
          <div className="mc-badge mc-badge-1"> Blockchain OK</div>
          <div className="mc-badge mc-badge-2"> Auto-Heal Active</div>
        </div>
      </section>

      {/* ═════ STATIONS ═════ */}
      <section className="mc-section">
        <div className="mc-section-header">
          <div className="mc-section-tag">OPERATIONS</div>
          <h2 className="mc-section-title">Two stations. One console.</h2>
        </div>

        <div className="mc-station-grid">
          {STATIONS.map((s) => (
            <button className="mc-station" style={{ '--accent': s.accent }} onClick={() => onEnter(s.id)}>
              <div className="mc-station-accent" />
              <div className="mc-station-top">
                <span style={{ fontSize: '32px' }}>{s.emoji}</span>
                <span className="mc-station-badge">Est. {s.est}</span>
              </div>
              <div className="mc-station-name">
                {s.name} <span className="mc-station-hindi">{s.hindi}</span>
              </div>
              <div className="mc-station-loc"> {s.location}</div>
              <div className="mc-station-desc">{s.desc}</div>
              <div className="mc-station-cta">
                Open {s.name} Console →
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ═════ FEATURES ═════ */}
      <section className="mc-section">
        <div className="mc-section-header">
          <div className="mc-section-tag">CAPABILITIES</div>
          <h2 className="mc-section-title">Everything in one platform</h2>
        </div>

        <div className="mc-feature-grid">
          {FEATURES.map((f, i) => (
            <div key={i} className="mc-feature">
              <div className="mc-feature-icon">{f.icon}</div>
              <div className="mc-feature-title">{f.title}</div>
              <div className="mc-feature-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═════ BOTTOM CTA ═════ */}
      <section className="mc-final">
        <div className="mc-final-orb" />
        <div className="mc-section-tag">READY</div>
        <h2 className="mc-final-title">Enter the console</h2>
        <p className="mc-final-desc">
          Both stations streaming simultaneously. No setup required.
        </p>
        <button className="mc-cta-primary large" onClick={onEnter}>
           Open Polar Twin Dashboard
        </button>
      </section>

      {/* ═════ FOOTER ═════ */}
      <footer className="mc-footer">
        <div>© 2026 Dhruva Twin · SIH26060</div>
        <div className="mc-footer-tech">
          <span>React</span><span>·</span>
          <span>FastAPI</span><span>·</span>
          <span>MQTT</span><span>·</span>
          <span>Three.js</span><span>·</span>
          <span>Blockchain</span>
        </div>
      </footer>
    </div>
  );
}