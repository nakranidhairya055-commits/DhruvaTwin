import React, { useState } from 'react';
import Landing from './Landing';
import Dashboard from './Dashboard';

function App() {
  const [view, setView] = useState('landing');
  const [profile, setProfile] = useState('commander');

  const handleEnter = (selectedProfile) => {
  // Handle case where a React event or object is passed
  let p = 'commander';
  if (typeof selectedProfile === 'string' && selectedProfile.trim()) {
    p = selectedProfile.toLowerCase();
  }
  setProfile(p);
  setView('dashboard');
};

  if (view === 'landing') {
    return <Landing onEnter={handleEnter} />;
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setView('landing')}
        style={{
          position: 'fixed',
          top: '18px',
          left: '18px',
          zIndex: 1000,
          padding: '8px 16px',
          borderRadius: '999px',
          border: '1px solid rgba(255,255,255,0.2)',
          background: 'rgba(15,35,64,0.75)',
          backdropFilter: 'blur(12px)',
          color: '#fff',
          fontSize: '12px',
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'all 0.2s',
          boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(74,159,212,0.85)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(15,35,64,0.75)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        ← Home
      </button>

      <Dashboard profile={profile} />
    </div>
  );
}

export default App;