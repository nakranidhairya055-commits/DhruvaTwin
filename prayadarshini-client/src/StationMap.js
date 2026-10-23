import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet's default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Station coordinates
const STATIONS = {
  maitri: {
    name: 'Maitri',
    lat: -70.7657,
    lon: 11.7361,
    region: 'Schirmacher Oasis, Queen Maud Land',
    established: 1989,
  },
  bharati: {
    name: 'Bharati',
    lat: -69.4069,
    lon: 76.1947,
    region: 'Larsemann Hills, Prydz Bay',
    established: 2012,
  },
};

// Ship route waypoints: Cape Town → Southern Ocean → Bharati
const SHIP_ROUTE = [
  { lat: -33.9249, lon: 18.4241, label: 'Cape Town (Departure)' },
  { lat: -40.0, lon: 25.0, label: 'South Atlantic' },
  { lat: -48.0, lon: 38.0, label: 'Southern Ocean' },
  { lat: -56.0, lon: 52.0, label: 'Roaring Forties' },
  { lat: -63.0, lon: 65.0, label: 'Approaching Antarctica' },
  { lat: -67.5, lon: 72.0, label: 'Prydz Bay' },
  { lat: -69.4069, lon: 76.1947, label: 'Bharati Station (Arrival)' },
];

// Custom colored icon based on temperature
function makeIcon(color) {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background:${color};
      width:22px;height:22px;border-radius:50%;
      border:3px solid white;
      box-shadow:0 0 12px ${color};
    "></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

// Ship icon (animated)
function makeShipIcon(heading = 0) {
  return L.divIcon({
    className: 'ship-marker',
    html: `<div style="
      font-size: 26px;
      transform: rotate(${heading}deg);
      filter: drop-shadow(0 0 8px #00aaff);
      animation: shipBob 2s ease-in-out infinite;
    ">🚢</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

// Interpolate position along route (0.0 to 1.0)
function getPositionOnRoute(progress) {
  const totalSegments = SHIP_ROUTE.length - 1;
  const scaledProgress = progress * totalSegments;
  const segmentIndex = Math.min(Math.floor(scaledProgress), totalSegments - 1);
  const segmentProgress = scaledProgress - segmentIndex;

  const start = SHIP_ROUTE[segmentIndex];
  const end = SHIP_ROUTE[segmentIndex + 1];

  const lat = start.lat + (end.lat - start.lat) * segmentProgress;
  const lon = start.lon + (end.lon - start.lon) * segmentProgress;

  // Compute heading (angle)
  const dLat = end.lat - start.lat;
  const dLon = end.lon - start.lon;
  const heading = (Math.atan2(dLon, dLat) * 180) / Math.PI;

  return { lat, lon, heading };
}

export default function StationMap() {
  const [stationData, setStationData] = useState({ maitri: null, bharati: null });
  const [shipProgress, setShipProgress] = useState(0);

  // Fetch station telemetry every 5s
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [maitriRes, bharatiRes] = await Promise.all([
          fetch('/api/telemetry/maitri'),
          fetch('/api/telemetry/bharati'),
        ]);
        const maitri = await maitriRes.json();
        const bharati = await bharatiRes.json();
        setStationData({ maitri, bharati });
      } catch (err) {
        console.error('Map telemetry fetch failed:', err);
      }
    };
    fetchAll();
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, []);

  // Animate ship along route (loops every 60 seconds)
  useEffect(() => {
    const startTime = Date.now();
    const DURATION = 60000; // 60 seconds for full journey
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = (elapsed % DURATION) / DURATION;
      setShipProgress(progress);
      requestAnimationFrame(animate);
    };
    animate();
  }, []);

  const getColor = (temp) => {
    if (temp === null || temp === undefined) return '#888';
    if (temp < -50) return '#ff0000';
    if (temp < -30) return '#ff8800';
    return '#00aaff';
  };

  const shipPos = getPositionOnRoute(shipProgress);
  const routeLine = SHIP_ROUTE.map((p) => [p.lat, p.lon]);
  const distanceKm = 4200; // Cape Town → Bharati approx distance
  const daysElapsed = Math.round(shipProgress * 14); // ~14 day voyage

  return (
    <div style={{
      border: '1px solid #ccc',
      borderRadius: '10px',
      padding: '10px',
      background: '#f0f8ff',
      marginTop: '15px',
      color: '#333'
    }}>
      <h3 style={{ marginTop: 0 }}>🗺️ Real-Time Station Map</h3>
      <div style={{ height: '420px', borderRadius: '8px', overflow: 'hidden' }}>
        <MapContainer
          center={[-55, 45]}
          zoom={3}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
          />

          {/* Ship route polyline */}
          <Polyline
            positions={routeLine}
            pathOptions={{
              color: '#007bff',
              weight: 3,
              dashArray: '8, 8',
              opacity: 0.7,
            }}
          />

          {/* Route waypoint dots */}
          {SHIP_ROUTE.map((p, i) => (
            <Circle
              key={i}
              center={[p.lat, p.lon]}
              radius={10000}
              pathOptions={{ color: '#007bff', fillColor: '#007bff', fillOpacity: 0.4 }}
            >
              <Tooltip permanent direction="top" offset={[0, -5]} opacity={0.9}>
                <span style={{ fontSize: '10px' }}>{p.label}</span>
              </Tooltip>
            </Circle>
          ))}

          {/* Moving ship marker */}
          <Marker position={[shipPos.lat, shipPos.lon]} icon={makeShipIcon(shipPos.heading)}>
            <Popup>
              <div style={{ fontFamily: 'Arial', minWidth: '180px' }}>
                <h4 style={{ margin: '0 0 6px 0', color: '#007bff' }}>🚢 Research Vessel</h4>
                <p style={{ margin: '2px 0', fontSize: '12px' }}>
                  <b>Route:</b> Cape Town → Bharati
                </p>
                <p style={{ margin: '2px 0', fontSize: '12px' }}>
                  <b>Progress:</b> {Math.round(shipProgress * 100)}%
                </p>
                <p style={{ margin: '2px 0', fontSize: '12px' }}>
                  <b>Distance:</b> {distanceKm.toLocaleString()} km total
                </p>
                <p style={{ margin: '2px 0', fontSize: '12px' }}>
                  <b>Day:</b> {daysElapsed} / 14
                </p>
                <p style={{ margin: '2px 0', fontSize: '12px' }}>
                  <b>Position:</b> {shipPos.lat.toFixed(2)}°, {shipPos.lon.toFixed(2)}°
                </p>
              </div>
            </Popup>
          </Marker>

          {/* Station markers */}
          {Object.entries(STATIONS).map(([key, station]) => {
            const data = stationData[key];
            const temp = data?.fuel_temp;
            const color = getColor(temp);

            return (
              <React.Fragment key={key}>
                <Circle
                  center={[station.lat, station.lon]}
                  radius={80000}
                  pathOptions={{ color, fillColor: color, fillOpacity: 0.15 }}
                />

                <Marker position={[station.lat, station.lon]} icon={makeIcon(color)}>
                  <Popup>
                    <div style={{ minWidth: '200px', fontFamily: 'Arial' }}>
                      <h4 style={{ margin: '0 0 6px 0', color }}>
                        {station.name} Station
                      </h4>
                      <p style={{ margin: '2px 0', fontSize: '12px' }}>
                        <b>📍</b> {station.region}
                      </p>
                      <p style={{ margin: '2px 0', fontSize: '12px' }}>
                        <b>📅</b> Est. {station.established}
                      </p>
                      <p style={{ margin: '2px 0', fontSize: '12px' }}>
                        <b>🕐</b> {station.lat.toFixed(4)}°, {station.lon.toFixed(4)}°
                      </p>
                      {data ? (
                        <>
                          <hr style={{ margin: '6px 0' }} />
                          <p style={{ margin: '2px 0', fontSize: '12px' }}>
                            <b>🌡️ Fuel:</b> <span style={{ color }}>{temp}°C</span>
                          </p>
                          <p style={{ margin: '2px 0', fontSize: '12px' }}>
                            <b>❄️ Ambient:</b> {data.ambient_temp}°C
                          </p>
                          <p style={{ margin: '2px 0', fontSize: '12px' }}>
                            <b>💨 Wind:</b> {data.wind_speed} km/h
                          </p>
                          <p style={{ margin: '2px 0', fontSize: '12px' }}>
                            <b>👥 Personnel:</b> {data.personnel}
                          </p>
                          <p style={{ margin: '2px 0', fontSize: '12px' }}>
                            <b>📡 Satellite:</b> {data.satellite_link}
                          </p>
                        </>
                      ) : (
                        <p style={{ fontSize: '12px', color: '#888' }}>Loading...</p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              </React.Fragment>
            );
          })}
        </MapContainer>
      </div>

      {/* Ship status footer */}
      <div style={{
        marginTop: '10px',
        padding: '10px 15px',
        background: '#fff',
        borderRadius: '8px',
        border: '1px solid #ddd',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '13px'
      }}>
        <span><b>🚢 Research Vessel:</b> Cape Town → Bharati</span>
        <span><b>📊 Progress:</b> {Math.round(shipProgress * 100)}%</span>
        <span><b>📅 Day:</b> {daysElapsed}/14</span>
        <span><b>📏 Distance:</b> {Math.round(distanceKm * shipProgress).toLocaleString()} km</span>
      </div>

      <p style={{ textAlign: 'center', fontSize: '12px', color: '#666', margin: '8px 0 0 0' }}>
        🔴 Critical (&lt;-50°C) | 🟠 Warning (&lt;-30°C) | 🔵 Normal | 🚢 Live Ship Tracking
      </p>
    </div>
  );
}