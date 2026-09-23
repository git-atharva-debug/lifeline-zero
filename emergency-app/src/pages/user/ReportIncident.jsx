import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { incidentAPI } from '../../services/api';
import AegisTalk from '../../components/user/AegisTalk';
import '../../styles/incidents.css';

// ─── Constants (unchanged from your original) ─────────────────────────────────
const INCIDENT_TYPES = [
    { value: 'fire', icon: '🔥', label: 'Fire' },
    { value: 'flood', icon: '🌊', label: 'Flood' },
    { value: 'earthquake', icon: '🏚️', label: 'Earthquake' },
    { value: 'medical', icon: '🏥', label: 'Medical' },
    { value: 'collapse', icon: '🏗️', label: 'Collapse' },
    { value: 'other', icon: '⚠️', label: 'Other' },
];
const PRIORITIES = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' },
];
const TYPE_ICONS = { fire: '🔥', flood: '🌊', earthquake: '🏚️', medical: '🏥', collapse: '🏗️', other: '⚠️' };

function timeAgo(date) {
    const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

// ─── NEW: write to localStorage so ResourceTracker picks it up live ────────────
// This is the ONLY addition to your original file — everything else is identical.
function writeIncidentLocal(incident) {
    try {
        const existing = JSON.parse(localStorage.getItem('incidents_local') || '[]');
        // Don't duplicate if same id already exists
        const deduped = existing.filter(i => i.id !== incident.id);
        deduped.unshift(incident);
        localStorage.setItem('incidents_local', JSON.stringify(deduped.slice(0, 50)));
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'incidents_local',
            newValue: JSON.stringify(deduped.slice(0, 50)),
        }));
    } catch (e) {
        console.error('writeIncidentLocal:', e);
    }
}

export default function ReportIncident() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('ai-report');
    const [form, setForm] = useState({ 
        incidentType: '', 
        description: '', 
        lat: '', 
        lng: '', 
        priority: 'medium',
        estimatedPeople: 1 // New field for people count
    });
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');
    const [locating, setLocating] = useState(false);
    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState('');
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

    const fetchMyIncidents = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const params = { page, limit: 15 };
            if (statusFilter) params.status = statusFilter;
            const res = await incidentAPI.getMy(params);
            setIncidents(res.data);
            setPagination(res.pagination);
        } catch (err) {
            console.error('Fetch incidents error:', err);
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        if (activeTab === 'my') fetchMyIncidents();
    }, [activeTab, fetchMyIncidents]);

    const getCurrentLocation = () => {
        if (!navigator.geolocation) { setError('Geolocation is not supported by your browser.'); return; }
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => { setForm(f => ({ ...f, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) })); setLocating(false); },
            (err) => { setError('Failed to get location. Please enter coordinates manually.'); setLocating(false); },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); setSuccess('');
        if (!form.incidentType) { setError('Please select an incident type.'); return; }
        if (!form.lat || !form.lng) { setError('Please enter or detect your location.'); return; }
        const lat = parseFloat(form.lat);
        const lng = parseFloat(form.lng);
        if (isNaN(lat) || lat < -90 || lat > 90) { setError('Latitude must be between -90 and 90.'); return; }
        if (isNaN(lng) || lng < -180 || lng > 180) { setError('Longitude must be between -180 and 180.'); return; }
        
        // Validate people count
        const people = parseInt(form.estimatedPeople) || 1;
        if (people < 1) { setError('Number of affected people must be at least 1.'); return; }
        if (people > 1000) { setError('Please contact emergency services directly for large-scale incidents.'); return; }

        setSubmitting(true);
        try {
            // Your existing backend call — unchanged
            const apiResult = await incidentAPI.create({
                incidentType: form.incidentType,
                description: form.description,
                location: { lat, lng },
                priority: form.priority,
                estimatedPeople: people, // Include in API call
            });

            // ── Bridge: also write to localStorage for ResourceTracker ──
            writeIncidentLocal({
                id: apiResult?._id || apiResult?.id || `local_${Date.now()}`,
                incidentType: form.incidentType,
                description: form.description,
                location: { lat, lng },
                lat,
                lon: lng,
                priority: form.priority,
                status: 'active',
                createdAt: new Date().toISOString(),
                reportedBy: user?.name || 'Unknown',
                aiAssessment: null,
                estimatedPeople: people, // Include people count
            });
            // ──────────────────────────────────────────────────────────

            setSuccess(`🚨 Emergency incident reported successfully! Estimated ${people} affected people. Rescue teams have been notified.`);
            setForm({ incidentType: '', description: '', lat: '', lng: '', priority: 'medium', estimatedPeople: 1 });
            setTimeout(() => setSuccess(''), 5000);
        } catch (err) {
            // If backend is down, still write locally so ResourceTracker works offline
            writeIncidentLocal({
                id: `local_${Date.now()}`,
                incidentType: form.incidentType,
                description: form.description,
                location: { lat, lng },
                lat,
                lon: lng,
                priority: form.priority,
                status: 'active',
                createdAt: new Date().toISOString(),
                reportedBy: user?.name || 'Unknown',
                aiAssessment: null,
                estimatedPeople: people, // Include people count
            });
            setError(err.message || 'Failed to reach server — saved locally.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleAIAssist = (extractedData) => {
        setForm(f => ({
            ...f,
            incidentType: extractedData.incidentType || 'other',
            description: extractedData.description || '',
            priority: extractedData.priority || 'medium',
            estimatedPeople: extractedData.estimatedPeople || 1
        }));
        if (!form.lat || !form.lng) {
            getCurrentLocation();
        }
        setActiveTab('report');
        setSuccess('AI extracted details successfully. Please verify and submit.');
        setTimeout(() => setSuccess(''), 5000);
    };

    return (
        <div className="incidents-page">
            <div>
                <h1>🚨 Emergency Report</h1>
                <p className="page-subtitle">Report an emergency or view your incident history, {user?.name}</p>
            </div>

            <div className="incident-tabs">
                <button className={`incident-tab ${activeTab === 'ai-report' ? 'active' : ''}`} onClick={() => setActiveTab('ai-report')}>🤖 AEGIS Talk</button>
                <button className={`incident-tab ${activeTab === 'report' ? 'active' : ''}`} onClick={() => setActiveTab('report')}>📝 Manual Report</button>
                <button className={`incident-tab ${activeTab === 'my' ? 'active' : ''}`} onClick={() => setActiveTab('my')}>📋 My Incidents {pagination.total > 0 && `(${pagination.total})`}</button>
            </div>

            {success && <div className="success-toast">✅ {success}</div>}
            {error && <div className="error-toast">❌ {error}</div>}

            {activeTab === 'ai-report' && (
                <div style={{ marginBottom: '2rem' }}>
                    <AegisTalk onReportSubmit={handleAIAssist} />
                </div>
            )}

            {activeTab === 'report' && (
                <form onSubmit={handleSubmit}>
                    <div className="card" style={{ marginBottom: '1.25rem' }}>
                        <div className="incident-form">
                            <div className="form-group">
                                <label>Emergency Type *</label>
                                <div className="type-grid">
                                    {INCIDENT_TYPES.map(t => (
                                        <button key={t.value} type="button" className={`type-option ${form.incidentType === t.value ? 'selected' : ''}`} onClick={() => setForm(f => ({ ...f, incidentType: t.value }))}>
                                            <span className="type-icon">{t.icon}</span><span className="type-label">{t.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* NEW: People Count Input */}
                            <div className="form-group">
                                <label>Estimated Number of Affected People *</label>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <input
                                        type="number"
                                        min="1"
                                        max="1000"
                                        value={form.estimatedPeople}
                                        onChange={(e) => setForm(f => ({ ...f, estimatedPeople: parseInt(e.target.value) || 1 }))}
                                        className="form-input"
                                        style={{ width: '120px' }}
                                    />
                                    <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
                                        This helps us allocate appropriate resources
                                    </span>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Priority Level *</label>
                                <div className="priority-row">
                                    {PRIORITIES.map(p => (
                                        <button key={p.value} type="button" className={`priority-btn ${form.priority === p.value ? `selected p-${p.value}` : ''}`} onClick={() => setForm(f => ({ ...f, priority: p.value }))}>{p.label}</button>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Your Location *</label>
                                <div className="location-picker">
                                    <div className="form-group"><input type="number" step="any" className="form-input" placeholder="Latitude (e.g. 18.5204)" value={form.lat} onChange={e => setForm(f => ({ ...f, lat: e.target.value }))} /></div>
                                    <div className="form-group"><input type="number" step="any" className="form-input" placeholder="Longitude (e.g. 73.8567)" value={form.lng} onChange={e => setForm(f => ({ ...f, lng: e.target.value }))} /></div>
                                    <button type="button" className="location-btn" onClick={getCurrentLocation} disabled={locating}>{locating ? '📡 Detecting...' : '📍 Detect GPS'}</button>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Description (Optional)</label>
                                <textarea 
                                    className="form-textarea" 
                                    placeholder="Describe the situation — what you see, any injuries, specific needs..." 
                                    value={form.description} 
                                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))} 
                                    maxLength={1000} 
                                />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#475569' }}>
                                    <span>Include details about injuries, accessibility, etc.</span>
                                    <span>{form.description.length}/1000</span>
                                </div>
                            </div>

                            <button type="submit" className="submit-incident-btn" disabled={submitting}>
                                {submitting ? '⏳ Submitting...' : `🆘 Send Emergency Report (${form.estimatedPeople} people)`}
                            </button>
                        </div>
                    </div>
                </form>
            )}

            {activeTab === 'my' && (
                <div>
                    <div className="filter-bar">
                        <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="">All Statuses</option>
                            <option value="active">Active</option>
                            <option value="responding">Responding</option>
                            <option value="resolved">Resolved</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                        <span className="incident-count">{pagination.total} incident{pagination.total !== 1 ? 's' : ''}</span>
                    </div>

                    {loading && (
                        <div className="incidents-list">
                            {[1,2,3].map(i => (
                                <div key={i} className="skeleton-card">
                                    <div className="skeleton-line w-40"/>
                                    <div className="skeleton-line w-80"/>
                                    <div className="skeleton-line w-60"/>
                                </div>
                            ))}
                        </div>
                    )}

                    {!loading && incidents.length === 0 && (
                        <div className="empty-state">
                            <div className="empty-icon">📭</div>
                            <div className="empty-title">No incidents found</div>
                            <div className="empty-subtitle">
                                {statusFilter ? 'Try changing the filter.' : 'Report your first emergency from the Report tab.'}
                            </div>
                        </div>
                    )}

                    {!loading && incidents.length > 0 && (
                        <div className="incidents-list">
                            {incidents.map(inc => (
                                <div key={inc._id} className={`incident-card priority-${inc.priority}`}>
                                    <div className="incident-card-header">
                                        <div className="incident-card-title">
                                            <span className="type-emoji">{TYPE_ICONS[inc.incidentType] || '⚠️'}</span>
                                            <span className="type-name">{inc.incidentType}</span>
                                            {inc.estimatedPeople && (
                                                <span className="people-badge" style={{
                                                    background: 'rgba(59,130,246,0.1)',
                                                    color: '#60a5fa',
                                                    padding: '2px 8px',
                                                    borderRadius: '999px',
                                                    fontSize: '0.65rem',
                                                    marginLeft: '0.5rem'
                                                }}>
                                                    👥 {inc.estimatedPeople}
                                                </span>
                                            )}
                                            <span className={`priority-tag p-${inc.priority}`}>{inc.priority}</span>
                                        </div>
                                        <span className={`status-tag status-${inc.status}`}>
                                            {inc.status==='active'&&'● '}
                                            {inc.status==='responding'&&'🚁 '}
                                            {inc.status==='resolved'&&'✅ '}
                                            {inc.status==='cancelled'&&'✕ '}
                                            {inc.status}
                                        </span>
                                    </div>
                                    {inc.description && <p className="incident-description">{inc.description}</p>}
                                    <div className="incident-card-meta">
                                        <span>📍 {inc.location.lat.toFixed(4)}, {inc.location.lng.toFixed(4)}</span>
                                        <span>🕐 {timeAgo(inc.createdAt)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {!loading && pagination.pages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
                            {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(p => (
                                <button 
                                    key={p} 
                                    className={`btn ${p === pagination.page ? 'btn-blue' : 'btn-outline'}`} 
                                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem' }} 
                                    onClick={() => fetchMyIncidents(p)}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}