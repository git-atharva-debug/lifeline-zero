import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { incidentAPI } from '../../services/api';
import BuildingViewer3D from '../../components/BuildingViewer3D';
import '../../styles/incidents.css';

// ---- Constants ----
const INCIDENT_TYPES_FILTER = [
    { value: '', label: 'All Types' },
    { value: 'fire', label: 'Fire' },
    { value: 'flood', label: 'Flood' },
    { value: 'earthquake', label: 'Earthquake' },
    { value: 'medical', label: 'Medical' },
    { value: 'collapse', label: 'Collapse' },
    { value: 'other', label: 'Other' },
];

const PRIORITY_FILTER = [
    { value: '', label: 'All Priorities' },
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
];

function timeAgo(date) {
    const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

function getInitials(name) {
    if (!name) return '??';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function IncidentControl() {
    const { user } = useAuth();

    // ---- State ----
    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Filters
    const [typeFilter, setTypeFilter] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('');

    // Stats
    const [stats, setStats] = useState({ active: 0, responding: 0, total: 0, critical: 0 });

    // Confirmation dialog
    const [confirmAction, setConfirmAction] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);

    // Expanded incident (to show 3D map)
    const [expandedId, setExpandedId] = useState(null);

    // ---- Fetch Active Incidents ----
    const fetchIncidents = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = { limit: 100 };
            if (typeFilter) params.incidentType = typeFilter;
            if (priorityFilter) params.priority = priorityFilter;
            const res = await incidentAPI.getActive(params);

            const data = res.data || [];
            setIncidents(data);

            // Calculate stats
            setStats({
                active: data.filter(i => i.status === 'active').length,
                responding: data.filter(i => i.status === 'responding').length,
                total: data.length,
                critical: data.filter(i => i.priority === 'critical').length,
            });
        } catch (err) {
            setError(err.message || 'Failed to load incidents.');
        } finally {
            setLoading(false);
        }
    }, [typeFilter, priorityFilter]);

    useEffect(() => {
        fetchIncidents();
        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchIncidents, 30000);
        return () => clearInterval(interval);
    }, [fetchIncidents]);

    // ---- Update Status ----
    const handleStatusUpdate = async () => {
        if (!confirmAction) return;
        const { id, status } = confirmAction;

        setActionLoading(id);
        setConfirmAction(null);
        setError('');
        setSuccess('');

        try {
            await incidentAPI.updateStatus(id, status);
            setSuccess(`Incident status updated to "${status}".`);
            setTimeout(() => setSuccess(''), 4000);

            // Refresh list
            await fetchIncidents();
        } catch (err) {
            setError(err.message || 'Failed to update status.');
        } finally {
            setActionLoading(null);
        }
    };

    // ---- Available actions ----
    const getActions = (incident) => {
        const actions = [];
        if (incident.status === 'active') {
            actions.push({ status: 'responding', label: 'Respond', className: 'respond' });
            actions.push({ status: 'cancelled', label: 'Cancel', className: 'cancel' });
        }
        if (incident.status === 'responding') {
            actions.push({ status: 'resolved', label: 'Resolve', className: 'resolve' });
            actions.push({ status: 'cancelled', label: 'Cancel', className: 'cancel' });
        }
        return actions;
    };

    // ---- Status label for confirm dialog ----
    const statusLabels = {
        responding: { title: 'Deploy Response Team?', desc: 'This will mark the incident as "Responding". The reporting civilian will be notified that help is on the way.' },
        resolved: { title: 'Mark as Resolved?', desc: 'This will close the incident and mark it as "Resolved". This action cannot be undone.' },
        cancelled: { title: 'Cancel This Incident?', desc: 'This will permanently cancel the incident. This action cannot be undone.' },
    };

    // ---- Toggle 3D map view ----
    const toggleMap = (id) => {
        setExpandedId(prev => prev === id ? null : id);
    };

    return (
        <div className="incidents-page" style={styles.container}>
            {/* Header with colorful gradient title */}
            <div style={styles.header}>
                <h1 style={styles.title}>
                    <span style={styles.titleGradient}>Incident</span>
                    <span style={styles.titleNormal}> Control</span>
                </h1>
                <span style={styles.liveBadge}>● LIVE</span>
            </div>
            <p style={styles.subtitle}>Real-time emergency monitoring — Officer {user?.name}</p>

            {/* Messages */}
            {success && <div style={styles.successToast}>✅ {success}</div>}
            {error && <div style={styles.errorToast}>❌ {error}</div>}

            {/* Stats */}
            <div style={styles.statsGrid}>
                <div style={styles.statCard}>
                    <div style={{ ...styles.statValue, color: '#ef4444' }}>{stats.active}</div>
                    <div style={styles.statLabel}>Active</div>
                </div>
                <div style={styles.statCard}>
                    <div style={{ ...styles.statValue, color: '#3b82f6' }}>{stats.responding}</div>
                    <div style={styles.statLabel}>Responding</div>
                </div>
                <div style={styles.statCard}>
                    <div style={{ ...styles.statValue, color: '#dc2626' }}>{stats.critical}</div>
                    <div style={styles.statLabel}>Critical</div>
                </div>
                <div style={styles.statCard}>
                    <div style={{ ...styles.statValue, color: '#22c55e' }}>{stats.total}</div>
                    <div style={styles.statLabel}>Total Active</div>
                </div>
            </div>

            {/* Filter Bar */}
            <div style={styles.filterBar}>
                <select style={styles.filterSelect} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                    {INCIDENT_TYPES_FILTER.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <select style={styles.filterSelect} value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
                    {PRIORITY_FILTER.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <button
                    style={styles.refreshBtn}
                    onClick={fetchIncidents}
                    disabled={loading}
                >
                    Refresh
                </button>
                <span style={styles.incidentCount}>
                    {incidents.length} incident{incidents.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Loading */}
            {loading && (
                <div style={styles.incidentsList}>
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} style={styles.skeletonCard}>
                            <div style={styles.skeletonLine}></div>
                            <div style={styles.skeletonLine}></div>
                            <div style={styles.skeletonLine}></div>
                            <div style={styles.skeletonLine}></div>
                        </div>
                    ))}
                </div>
            )}

            {/* Empty */}
            {!loading && incidents.length === 0 && (
                <div style={styles.emptyState}>
                    <div style={styles.emptyIcon}>✓</div>
                    <div style={styles.emptyTitle}>No active incidents</div>
                    <div style={styles.emptySubtitle}>
                        {typeFilter || priorityFilter
                            ? 'No incidents match your current filters.'
                            : 'All clear! No active emergencies right now.'}
                    </div>
                </div>
            )}

            {/* Incident Cards */}
            {!loading && incidents.length > 0 && (
                <div style={styles.incidentsList}>
                    {incidents.map(inc => {
                        const isUpdating = actionLoading === inc._id;
                        const actions = getActions(inc);
                        const reporter = inc.user || {};
                        const hasMap = inc.phantomMap && inc.phantomMap.walls && inc.phantomMap.walls.length > 0;
                        const isExpanded = expandedId === inc._id;

                        return (
                            <div key={inc._id} style={{
                                ...styles.incidentCard,
                                opacity: isUpdating ? 0.6 : 1,
                                borderLeft: `3px solid ${
                                    inc.priority === 'critical' ? '#ef4444' : 
                                    inc.priority === 'high' ? '#f97316' : 
                                    inc.priority === 'medium' ? '#f59e0b' : '#22c55e'
                                }`,
                            }}>
                                <div style={styles.cardHeader}>
                                    <div style={styles.cardTitle}>
                                        <span style={styles.typeName}>{inc.incidentType}</span>
                                        <span style={{
                                            ...styles.priorityTag,
                                            background: inc.priority === 'critical' ? '#fef2f2' : 
                                                       inc.priority === 'high' ? '#fff7ed' : 
                                                       inc.priority === 'medium' ? '#fefce8' : '#f0fdf4',
                                            color: inc.priority === 'critical' ? '#ef4444' : 
                                                   inc.priority === 'high' ? '#f97316' : 
                                                   inc.priority === 'medium' ? '#f59e0b' : '#22c55e',
                                            borderColor: inc.priority === 'critical' ? '#fecaca' : 
                                                        inc.priority === 'high' ? '#fed7aa' : 
                                                        inc.priority === 'medium' ? '#fde68a' : '#bbf7d0',
                                        }}>{inc.priority}</span>
                                        {hasMap && (
                                            <span style={styles.mapBadge}>MAP</span>
                                        )}
                                    </div>
                                    <span style={{
                                        ...styles.statusTag,
                                        background: inc.status === 'active' ? '#fef2f2' : 
                                                   inc.status === 'responding' ? '#eff6ff' : '#f0fdf4',
                                        color: inc.status === 'active' ? '#ef4444' : 
                                               inc.status === 'responding' ? '#3b82f6' : '#22c55e',
                                        borderColor: inc.status === 'active' ? '#fecaca' : 
                                                    inc.status === 'responding' ? '#bfdbfe' : '#bbf7d0',
                                    }}>
                                        {inc.status === 'responding' && '🚁 '}
                                        {inc.status}
                                    </span>
                                </div>

                                {inc.description && (
                                    <p style={styles.description}>{inc.description}</p>
                                )}

                                <div style={styles.metaInfo}>
                                    <span>📍 {inc.location.lat.toFixed(4)}, {inc.location.lng.toFixed(4)}</span>
                                    <span>🕐 {timeAgo(inc.createdAt)}</span>
                                    <span>🆔 {inc._id.slice(-6).toUpperCase()}</span>
                                </div>

                                {/* Reporter Info */}
                                {reporter.name && (
                                    <div style={styles.userInfo}>
                                        <div style={styles.userAvatar}>{getInitials(reporter.name)}</div>
                                        <div style={styles.userDetails}>
                                            <span style={styles.userName}>{reporter.name}</span>
                                            <span style={styles.userContact}>
                                                {reporter.email}
                                                {reporter.phone && ` · ${reporter.phone}`}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Building Map Section */}
                                {hasMap && (
                                    <div style={styles.mapSection}>
                                        <button
                                            onClick={() => toggleMap(inc._id)}
                                            style={{
                                                ...styles.mapToggle,
                                                background: isExpanded ? '#f5f3ff' : '#faf5ff',
                                                color: '#9333ea',
                                            }}
                                        >
                                            <span>{isExpanded ? 'Hide' : 'View'} Building Layout</span>
                                            <span style={styles.mapStats}>
                                                {inc.phantomMap.metadata?.wallCount || inc.phantomMap.walls.length} walls
                                                {inc.phantomMap.metadata?.doorCount > 0 && ` · ${inc.phantomMap.metadata.doorCount} doors`}
                                                {inc.phantomMap.metadata?.markerCount > 0 && ` · ${inc.phantomMap.metadata.markerCount} markers`}
                                            </span>
                                        </button>

                                        {isExpanded && (
                                            <div style={styles.mapExpanded}>
                                                {/* Floorplan image */}
                                                {inc.phantomMap.floorplanImage?.url && (
                                                    <div style={styles.floorplanSection}>
                                                        <p style={styles.sectionLabel}>Original Floor Plan</p>
                                                        <img
                                                            src={inc.phantomMap.floorplanImage.url}
                                                            alt="Floor plan"
                                                            style={styles.floorplanImage}
                                                        />
                                                    </div>
                                                )}

                                                {/* 3D Viewer */}
                                                <div style={styles.viewer3DSection}>
                                                    <p style={styles.sectionLabel}>3D Building Structure</p>
                                                    <BuildingViewer3D
                                                        walls={inc.phantomMap.walls}
                                                        doors={inc.phantomMap.doors || []}
                                                        windows={inc.phantomMap.windows || []}
                                                        markers={inc.phantomMap.markers || []}
                                                        height={400}
                                                        showGrid={true}
                                                    />
                                                    <div style={styles.legend}>
                                                        {[
                                                            { color: '#ef4444', label: 'SOS' },
                                                            { color: '#22c55e', label: 'Exit' },
                                                            { color: '#3b82f6', label: 'Aid' },
                                                            { color: '#f97316', label: 'Hazard' },
                                                            { color: '#7c6b5a', label: 'Walls' },
                                                            { color: '#8B7355', label: 'Doors' },
                                                            { color: '#88aacc', label: 'Windows' },
                                                        ].map(l => (
                                                            <div key={l.label} style={styles.legendItem}>
                                                                <div style={{ ...styles.legendDot, background: l.color }} />
                                                                <span>{l.label}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Action Buttons */}
                                {actions.length > 0 && (
                                    <div style={styles.actionButtons}>
                                        {actions.map(a => (
                                            <button
                                                key={a.status}
                                                style={{
                                                    ...styles.actionBtn,
                                                    ...(a.className === 'respond' && styles.respondBtn),
                                                    ...(a.className === 'resolve' && styles.resolveBtn),
                                                    ...(a.className === 'cancel' && styles.cancelBtn),
                                                }}
                                                disabled={isUpdating}
                                                onClick={() => setConfirmAction({
                                                    id: inc._id,
                                                    status: a.status,
                                                    typeName: inc.incidentType,
                                                })}
                                            >
                                                {isUpdating ? '...' : a.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Confirmation Dialog */}
            {confirmAction && (
                <div style={styles.overlay} onClick={() => setConfirmAction(null)}>
                    <div style={styles.dialog} onClick={e => e.stopPropagation()}>
                        <h3 style={styles.dialogTitle}>{statusLabels[confirmAction.status]?.title || 'Confirm Action'}</h3>
                        <p style={styles.dialogDesc}>{statusLabels[confirmAction.status]?.desc}</p>
                        <p style={styles.dialogInfo}>
                            Incident: <strong>{confirmAction.typeName}</strong>
                            {' · ID: '}{confirmAction.id.slice(-6).toUpperCase()}
                        </p>
                        <div style={styles.dialogActions}>
                            <button
                                style={styles.dialogCancel}
                                onClick={() => setConfirmAction(null)}
                            >
                                Cancel
                            </button>
                            <button
                                style={{
                                    ...styles.dialogConfirm,
                                    ...(confirmAction.status === 'cancelled' && styles.dialogConfirmRed),
                                    ...(confirmAction.status === 'resolved' && styles.dialogConfirmGreen),
                                    ...(confirmAction.status === 'responding' && styles.dialogConfirmBlue),
                                }}
                                onClick={handleStatusUpdate}
                            >
                                {confirmAction.status === 'responding' && 'Deploy'}
                                {confirmAction.status === 'resolved' && 'Resolve'}
                                {confirmAction.status === 'cancelled' && 'Cancel Incident'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const styles = {
    container: {
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '2rem',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        background: '#ffffff',
        minHeight: '100vh',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '0.5rem',
    },
    title: {
        fontSize: '2rem',
        fontWeight: 800,
        margin: 0,
        letterSpacing: '-0.02em',
    },
    titleGradient: {
        background: 'linear-gradient(135deg, #ef4444 0%, #f97316 50%, #eab308 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
    },
    titleNormal: {
        color: '#0f172a',
    },
    liveBadge: {
        background: '#fef2f2',
        color: '#ef4444',
        borderRadius: '999px',
        padding: '0.2rem 0.75rem',
        fontSize: '0.7rem',
        fontWeight: 600,
        border: '1px solid #fecaca',
    },
    subtitle: {
        fontSize: '0.9rem',
        color: '#64748b',
        marginBottom: '2rem',
    },
    successToast: {
        position: 'fixed',
        top: '5rem',
        right: '1rem',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '0.5rem',
        padding: '0.75rem 1rem',
        fontSize: '0.8rem',
        color: '#0f172a',
        boxShadow: '0 8px 20px rgba(0,0,0,0.08)',
        zIndex: 9999,
    },
    errorToast: {
        position: 'fixed',
        top: '5rem',
        right: '1rem',
        background: '#ffffff',
        border: '1px solid #fecaca',
        borderRadius: '0.5rem',
        padding: '0.75rem 1rem',
        fontSize: '0.8rem',
        color: '#ef4444',
        boxShadow: '0 8px 20px rgba(0,0,0,0.08)',
        zIndex: 9999,
    },
    statsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1rem',
        marginBottom: '1.5rem',
    },
    statCard: {
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '0.75rem',
        padding: '1rem',
        textAlign: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        transition: 'all 0.2s',
        cursor: 'default',
    },
    statValue: {
        fontSize: '1.8rem',
        fontWeight: 700,
        marginBottom: '0.25rem',
    },
    statLabel: {
        fontSize: '0.8rem',
        color: '#64748b',
        fontWeight: 500,
    },
    filterBar: {
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'center',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
    },
    filterSelect: {
        padding: '0.6rem 1rem',
        borderRadius: '0.5rem',
        border: '1px solid #e2e8f0',
        background: '#ffffff',
        fontSize: '0.85rem',
        color: '#0f172a',
        cursor: 'pointer',
        minWidth: '140px',
        transition: 'all 0.2s',
    },
    refreshBtn: {
        padding: '0.6rem 1.2rem',
        borderRadius: '0.5rem',
        border: '1px solid #e2e8f0',
        background: '#ffffff',
        fontSize: '0.85rem',
        fontWeight: 600,
        color: '#64748b',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    incidentCount: {
        marginLeft: 'auto',
        fontSize: '0.85rem',
        color: '#64748b',
        background: '#f8fafc',
        padding: '0.4rem 1rem',
        borderRadius: '0.5rem',
        border: '1px solid #e2e8f0',
    },
    incidentsList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
    },
    skeletonCard: {
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '0.75rem',
        padding: '1.25rem',
        animation: 'pulse 1.5s ease infinite',
    },
    skeletonLine: {
        height: '1rem',
        background: '#f1f5f9',
        borderRadius: '0.25rem',
        marginBottom: '0.75rem',
        width: '60%',
    },
    emptyState: {
        textAlign: 'center',
        padding: '4rem 1rem',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '1rem',
    },
    emptyIcon: {
        fontSize: '3rem',
        color: '#22c55e',
        marginBottom: '1rem',
    },
    emptyTitle: {
        fontSize: '1.2rem',
        fontWeight: 700,
        color: '#0f172a',
        marginBottom: '0.5rem',
    },
    emptySubtitle: {
        fontSize: '0.9rem',
        color: '#64748b',
    },
    incidentCard: {
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '0.75rem',
        padding: '1.25rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        transition: 'all 0.2s',
    },
    cardHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '0.75rem',
    },
    cardTitle: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        flexWrap: 'wrap',
    },
    typeName: {
        fontSize: '1rem',
        fontWeight: 600,
        color: '#0f172a',
    },
    priorityTag: {
        fontSize: '0.65rem',
        fontWeight: 600,
        padding: '0.2rem 0.6rem',
        borderRadius: '0.25rem',
        border: '1px solid',
        textTransform: 'uppercase',
    },
    mapBadge: {
        background: '#f5f3ff',
        color: '#9333ea',
        borderRadius: '0.25rem',
        padding: '0.2rem 0.6rem',
        fontSize: '0.6rem',
        fontWeight: 600,
        border: '1px solid #d8b4fe',
    },
    statusTag: {
        fontSize: '0.7rem',
        fontWeight: 600,
        padding: '0.25rem 0.75rem',
        borderRadius: '0.25rem',
        border: '1px solid',
    },
    description: {
        fontSize: '0.85rem',
        color: '#475569',
        lineHeight: 1.6,
        marginBottom: '0.75rem',
    },
    metaInfo: {
        display: 'flex',
        gap: '1rem',
        fontSize: '0.7rem',
        color: '#64748b',
        fontFamily: "'DM Mono', monospace",
        marginBottom: '0.75rem',
        flexWrap: 'wrap',
    },
    userInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem',
        background: '#f8fafc',
        borderRadius: '0.5rem',
        marginBottom: '0.75rem',
        border: '1px solid #e2e8f0',
    },
    userAvatar: {
        width: '2rem',
        height: '2rem',
        background: '#3b82f6',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.8rem',
        fontWeight: 600,
        color: '#ffffff',
        flexShrink: 0,
    },
    userDetails: {
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    },
    userName: {
        fontSize: '0.85rem',
        fontWeight: 600,
        color: '#0f172a',
    },
    userContact: {
        fontSize: '0.7rem',
        color: '#64748b',
    },
    mapSection: {
        marginTop: '0.75rem',
    },
    mapToggle: {
        width: '100%',
        padding: '0.75rem',
        borderRadius: '0.5rem',
        border: '1px solid #d8b4fe',
        fontSize: '0.85rem',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    mapStats: {
        fontSize: '0.7rem',
        color: '#6b7280',
    },
    mapExpanded: {
        marginTop: '0.75rem',
        animation: 'fadeUp 0.3s ease',
    },
    floorplanSection: {
        marginBottom: '0.75rem',
        padding: '0.75rem',
        background: '#f8fafc',
        borderRadius: '0.5rem',
        border: '1px solid #e2e8f0',
    },
    sectionLabel: {
        fontSize: '0.7rem',
        color: '#64748b',
        marginBottom: '0.5rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.3px',
    },
    floorplanImage: {
        width: '100%',
        maxHeight: '250px',
        objectFit: 'contain',
        borderRadius: '0.5rem',
        border: '1px solid #e2e8f0',
    },
    viewer3DSection: {
        padding: '0.75rem',
        background: '#f8fafc',
        borderRadius: '0.5rem',
        border: '1px solid #e2e8f0',
    },
    legend: {
        display: 'flex',
        gap: '1rem',
        marginTop: '0.5rem',
        flexWrap: 'wrap',
    },
    legendItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
        fontSize: '0.7rem',
        color: '#64748b',
    },
    legendDot: {
        width: '0.5rem',
        height: '0.5rem',
        borderRadius: '0.125rem',
        flexShrink: 0,
    },
    actionButtons: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '0.5rem',
        marginTop: '1rem',
    },
    actionBtn: {
        padding: '0.6rem',
        borderRadius: '0.5rem',
        border: 'none',
        fontSize: '0.8rem',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    respondBtn: {
        background: '#3b82f6',
        color: '#ffffff',
    },
    resolveBtn: {
        background: '#22c55e',
        color: '#ffffff',
    },
    cancelBtn: {
        background: '#fef2f2',
        color: '#ef4444',
        border: '1px solid #fecaca',
    },
    overlay: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
    },
    dialog: {
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '1rem',
        padding: '2rem',
        width: '100%',
        maxWidth: '420px',
        animation: 'fadeUp 0.3s ease',
        boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
    },
    dialogTitle: {
        margin: '0 0 0.75rem',
        fontSize: '1.3rem',
        fontWeight: 700,
        color: '#0f172a',
    },
    dialogDesc: {
        margin: '0 0 1rem',
        fontSize: '0.9rem',
        color: '#64748b',
        lineHeight: 1.6,
    },
    dialogInfo: {
        fontSize: '0.85rem',
        color: '#64748b',
        marginBottom: '1.5rem',
    },
    dialogActions: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '0.75rem',
    },
    dialogCancel: {
        padding: '0.75rem',
        borderRadius: '0.5rem',
        border: '1px solid #e2e8f0',
        background: '#ffffff',
        fontSize: '0.85rem',
        fontWeight: 600,
        color: '#64748b',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    dialogConfirm: {
        padding: '0.75rem',
        borderRadius: '0.5rem',
        border: 'none',
        fontSize: '0.85rem',
        fontWeight: 600,
        color: '#ffffff',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    dialogConfirmRed: {
        background: '#ef4444',
    },
    dialogConfirmGreen: {
        background: '#22c55e',
    },
    dialogConfirmBlue: {
        background: '#3b82f6',
    },
};

// Add global styles for animations
const globalStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
    
    @keyframes fadeUp {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: none; }
    }
    
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }
    
    * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
    }
    
    body {
        background: #ffffff;
    }
    
    button:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    
    select:hover {
        border-color: #94a3b8;
    }
`;

// Inject global styles
const styleSheet = document.createElement("style");
styleSheet.textContent = globalStyles;
document.head.appendChild(styleSheet);