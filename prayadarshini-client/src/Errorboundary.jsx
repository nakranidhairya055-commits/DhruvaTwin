import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Swallow removeChild errors from React portals
    if (error?.message?.includes('removeChild')) {
      console.warn('[Boundary] Caught removeChild error — auto-recovering');
      setTimeout(() => {
        this.setState({ hasError: false, error: null });
      }, 100);
      return;
    }
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && !this.state.error?.message?.includes('removeChild')) {
      return (
        <div style={{
          padding: 40,
          background: '#0a0f1a',
          color: '#ff6b76',
          borderRadius: 12,
          border: '1px solid rgba(255,41,101,0.3)',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 13,
        }}>
          <h3>⚠️ Something crashed</h3>
          <p>{this.state.error?.message || 'Unknown error'}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '10px 20px',
              background: '#00d9ff',
              border: 'none',
              borderRadius: 8,
              color: '#000',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}