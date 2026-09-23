import React, { useState, useEffect } from 'react';
import { 
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer 
} from 'recharts';
import { incidentAPI } from '../../services/api';

const COLORS = {
  fire: '#ef4444',
  flood: '#3b82f6',
  earthquake: '#8b5cf6',
  medical: '#10b981',
  collapse: '#f59e0b',
  other: '#64748b'
};

const PRIORITY_COLORS = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
  critical: '#7f1d1d'
};

export default function LiveAnalytics() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const res = await incidentAPI.getActive({ limit: 1000 });
      if (res.success) {
        setIncidents(res.data);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load analytics data.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading Live Analytics...</div>;
  if (error) return <div style={{ padding: '2rem', color: 'red' }}>{error}</div>;

  // Process data for Incident Type Pie Chart
  const typeCounts = incidents.reduce((acc, curr) => {
    acc[curr.incidentType] = (acc[curr.incidentType] || 0) + 1;
    return acc;
  }, {});
  const typeData = Object.keys(typeCounts).map(key => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value: typeCounts[key],
    fill: COLORS[key] || COLORS.other
  }));

  // Process data for Priority Bar Chart
  const priorityCounts = incidents.reduce((acc, curr) => {
    acc[curr.priority] = (acc[curr.priority] || 0) + 1;
    return acc;
  }, {});
  const priorityData = Object.keys(PRIORITY_COLORS).map(key => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    Count: priorityCounts[key] || 0,
    fill: PRIORITY_COLORS[key]
  }));

  return (
    <div style={{ padding: '2rem', background: '#f8fafc', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '1.8rem', marginBottom: '0.5rem', color: '#0f172a' }}>📊 Live Analytics</h1>
      <p style={{ color: '#64748b', marginBottom: '2rem' }}>Real-time visualization of active emergencies.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
        
        {/* Incident Type Donut Chart */}
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginBottom: '1rem', color: '#1e293b' }}>Active Incidents by Type</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Priority Bar Chart */}
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginBottom: '1rem', color: '#1e293b' }}>Incidents by Severity</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                <RechartsTooltip cursor={{fill: '#f1f5f9'}} />
                <Bar dataKey="Count" radius={[4, 4, 0, 0]}>
                  {priorityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
