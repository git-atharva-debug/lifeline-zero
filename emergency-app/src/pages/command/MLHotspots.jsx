import React, { useState, useEffect } from 'react';

export default function MLHotspots() {
  const [loading, setLoading] = useState(false);
  const [predictions, setPredictions] = useState(null);
  const [error, setError] = useState(null);
  const [weather, setWeather] = useState({ temp: 35, wind: 40, rain: 0 });

  const fetchHotspots = async () => {
    setLoading(true);
    setError(null);
    try {
      const grids = [];
      // Generate a 10x10 grid layout for visualization over Seattle
      // Bounding box: lat 47.5 to 47.7, lng -122.4 to -122.2
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 10; j++) {
          const lat = 47.5 + (i * 0.02);
          const lng = -122.4 + (j * 0.02);
          grids.push({ lat: parseFloat(lat.toFixed(4)), lng: parseFloat(lng.toFixed(4)) });
        }
      }

      const res = await fetch('http://localhost:5000/api/ml/hotspots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grids,
          weather,
          time: { hour: new Date().getHours(), day_of_week: new Date().getDay() }
        })
      });

      if (!res.ok) throw new Error('Failed to fetch predictions from ML microservice');
      const data = await res.json();
      setPredictions(data.predictions);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHotspots();
  }, [weather]);

  const getColor = (score) => {
    if (score > 0.7) return '#ef4444'; // Red
    if (score > 0.4) return '#f97316'; // Orange
    if (score > 0.3) return '#eab308'; // Yellow
    return '#22c55e'; // Green
  };

  return (
    <div style={{ padding: '2rem', background: '#f8fafc', minHeight: '100vh' }}>
      <h1 style={{ fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
        🔥 ML Spatial-Temporal Hotspots
      </h1>
      <p style={{ color: '#64748b', marginBottom: '2rem' }}>
        Spatio-Temporal LSTM Deep Learning Model predicting disaster probability across 100 Seattle grids based on historical weather and time patterns.
      </p>

      <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '2rem' }}>
        <h3 style={{ marginTop: 0, color: '#1e293b' }}>Simulation Parameters</h3>
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem' }}>Temperature (°C): {weather.temp}</label>
            <input type="range" min="0" max="50" value={weather.temp} onChange={(e) => setWeather({ ...weather, temp: parseInt(e.target.value) })} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem' }}>Wind (km/h): {weather.wind}</label>
            <input type="range" min="0" max="100" value={weather.wind} onChange={(e) => setWeather({ ...weather, wind: parseInt(e.target.value) })} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem' }}>Rainfall (mm): {weather.rain}</label>
            <input type="range" min="0" max="100" value={weather.rain} onChange={(e) => setWeather({ ...weather, rain: parseInt(e.target.value) })} />
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '1rem', borderRadius: '8px', marginBottom: '2rem' }}>
          Error: {error} (Ensure the Python Microservice is running on port 5001)
        </div>
      )}

      {loading ? (
        <p style={{ color: '#64748b', fontWeight: 600 }}>Analyzing spatial grids via LSTM...</p>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(10, 1fr)', 
          gap: '4px', 
          width: '100%', 
          maxWidth: '600px',
          aspectRatio: '1',
          background: '#e2e8f0',
          padding: '4px',
          borderRadius: '12px'
        }}>
          {predictions?.map((p, i) => (
            <div 
              key={i}
              style={{
                background: getColor(p.dangerScore),
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '0.6rem',
                fontWeight: 'bold',
                opacity: 0.85,
                transition: 'all 0.3s'
              }}
              title={`Grid [${p.lat}, ${p.lng}] - Risk: ${p.dangerScore.toFixed(2)}`}
            >
              {(p.dangerScore * 100).toFixed(0)}%
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
