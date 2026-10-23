// Configuration for API and WebSocket URLs
// Automatically adapts between local development (localhost:3000 -> localhost:8000)
// and production deployment on cloud platforms (Render, Railway, etc. with HTTPS and WSS)

export function getApiUrl(path) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined' && window.location.port === '3000') {
    return `http://localhost:8000${cleanPath}`;
  }
  return cleanPath;
}

export function getWsUrl(path) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined' && window.location.port === '3000') {
    return `ws://localhost:8000${cleanPath}`;
  }
  const protocol = (typeof window !== 'undefined' && window.location.protocol === 'https:') ? 'wss:' : 'ws:';
  const host = typeof window !== 'undefined' ? window.location.host : 'localhost:8000';
  return `${protocol}//${host}${cleanPath}`;
}
