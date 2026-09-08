// =================================================================
// Rescue.AI — Frontend Fetch Examples for Emergency Incident API
// =================================================================
// Copy these into your React app or any frontend.
// Replace API_BASE with your actual backend URL.
// =================================================================

const API_BASE = "http://localhost:5000/api";

// Helper: get stored JWT token
const getToken = () => localStorage.getItem("token");

// Helper: standard fetch with auth
const authFetch = async (url, options = {}) => {
    const token = getToken();
    if (!token) throw new Error("No auth token found. Please login.");

    const res = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...options.headers,
        },
    });

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.message || `Request failed with status ${res.status}`);
    }

    return data;
};

// =================================================================
// 1. CREATE INCIDENT (user role)
// =================================================================
const createIncident = async ({ incidentType, description, lat, lng, priority }) => {
    try {
        const data = await authFetch(`${API_BASE}/incidents/create`, {
            method: "POST",
            body: JSON.stringify({
                incidentType,        // "fire" | "flood" | "earthquake" | "medical" | "collapse" | "other"
                description,         // optional string
                location: { lat, lng },
                priority,            // "low" | "medium" | "high" | "critical"
            }),
        });

        console.log("✅ Incident created:", data.data);
        return data.data;
    } catch (err) {
        console.error("❌ Create incident error:", err.message);
        throw err;
    }
};

// Example usage:
// createIncident({
//   incidentType: "fire",
//   description: "Building on fire, 3rd floor, people trapped",
//   lat: 18.5204,
//   lng: 73.8567,
//   priority: "critical"
// });

// =================================================================
// 2. GET MY INCIDENTS (user role)
// =================================================================
const getMyIncidents = async ({ status, page = 1, limit = 20 } = {}) => {
    try {
        const params = new URLSearchParams();
        if (status) params.append("status", status);
        params.append("page", page);
        params.append("limit", limit);

        const data = await authFetch(`${API_BASE}/incidents/my?${params.toString()}`);

        console.log("✅ My incidents:", data.data);
        console.log("📄 Pagination:", data.pagination);
        return data;
    } catch (err) {
        console.error("❌ Get my incidents error:", err.message);
        throw err;
    }
};

// Example usage:
// getMyIncidents({ status: "active", page: 1, limit: 10 });

// =================================================================
// 3. GET ACTIVE INCIDENTS (command role)
// =================================================================
const getActiveIncidents = async ({ incidentType, priority, page = 1, limit = 50 } = {}) => {
    try {
        const params = new URLSearchParams();
        if (incidentType) params.append("incidentType", incidentType);
        if (priority) params.append("priority", priority);
        params.append("page", page);
        params.append("limit", limit);

        const data = await authFetch(`${API_BASE}/incidents/active?${params.toString()}`);

        console.log("✅ Active incidents:", data.data);
        return data;
    } catch (err) {
        console.error("❌ Get active incidents error:", err.message);
        throw err;
    }
};

// Example usage:
// getActiveIncidents({ priority: "critical" });

// =================================================================
// 4. UPDATE INCIDENT STATUS (command role)
// =================================================================
const updateIncidentStatus = async (incidentId, newStatus) => {
    try {
        const data = await authFetch(`${API_BASE}/incidents/${incidentId}/status`, {
            method: "PUT",
            body: JSON.stringify({ status: newStatus }),
        });

        console.log(`✅ Status updated to "${newStatus}":`, data.data);
        return data.data;
    } catch (err) {
        console.error("❌ Update status error:", err.message);
        throw err;
    }
};

// Example usage:
// updateIncidentStatus("65a1b2c3d4e5f6a7b8c9d0e1", "responding");

// =================================================================
// 5. GET SINGLE INCIDENT (user: own only | command: any)
// =================================================================
const getIncidentById = async (incidentId) => {
    try {
        const data = await authFetch(`${API_BASE}/incidents/${incidentId}`);

        console.log("✅ Incident details:", data.data);
        return data.data;
    } catch (err) {
        console.error("❌ Get incident error:", err.message);
        throw err;
    }
};

// Example usage:
// getIncidentById("65a1b2c3d4e5f6a7b8c9d0e1");

// =================================================================
// REACT HOOK EXAMPLE — useIncidents
// =================================================================
// import { useState, useEffect, useCallback } from "react";
//
// const useIncidents = () => {
//   const [incidents, setIncidents] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState(null);
//
//   const fetchMyIncidents = useCallback(async (filters = {}) => {
//     setLoading(true);
//     setError(null);
//     try {
//       const data = await getMyIncidents(filters);
//       setIncidents(data.data);
//     } catch (err) {
//       setError(err.message);
//     } finally {
//       setLoading(false);
//     }
//   }, []);
//
//   const submitIncident = useCallback(async (incidentData) => {
//     setLoading(true);
//     setError(null);
//     try {
//       const newIncident = await createIncident(incidentData);
//       setIncidents((prev) => [newIncident, ...prev]);
//       return newIncident;
//     } catch (err) {
//       setError(err.message);
//       throw err;
//     } finally {
//       setLoading(false);
//     }
//   }, []);
//
//   return { incidents, loading, error, fetchMyIncidents, submitIncident };
// };

export {
    createIncident,
    getMyIncidents,
    getActiveIncidents,
    updateIncidentStatus,
    getIncidentById,
};
