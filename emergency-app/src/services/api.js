import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API calls
export const authAPI = {
  register: async (data) => {
    try {
      const response = await api.post('/auth/register', data);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Registration failed' };
    }
  },

  login: async (data) => {
    try {
      const response = await api.post('/auth/login', data);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Login failed' };
    }
  },

  getCurrentUser: async () => {
    try {
      const response = await api.get('/auth/me');
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to get user' };
    }
  },
};

// Alert API calls
export const alertAPI = {
  getAlerts: async (params) => {
    try {
      const response = await api.get('/alerts', { params });
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to fetch alerts' };
    }
  },

  getAlertById: async (id) => {
    try {
      const response = await api.get(`/alerts/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to fetch alert' };
    }
  },

  createAlert: async (data) => {
    try {
      const response = await api.post('/alerts', data);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to create alert' };
    }
  },

  updateAlert: async (id, data) => {
    try {
      const response = await api.put(`/alerts/${id}`, data);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to update alert' };
    }
  },

  deleteAlert: async (id) => {
    try {
      const response = await api.delete(`/alerts/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to delete alert' };
    }
  },
};

// Notification API calls
export const notificationAPI = {
  getNotifications: async (params) => {
    try {
      const response = await api.get('/notifications', { params });
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to fetch notifications' };
    }
  },

  markAsRead: async (notificationId) => {
    try {
      const response = await api.put(`/notifications/${notificationId}/read`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to mark as read' };
    }
  },

  markAllAsRead: async () => {
    try {
      const response = await api.put('/notifications/read-all');
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to mark all as read' };
    }
  },

  deleteNotification: async (notificationId) => {
    try {
      const response = await api.delete(`/notifications/${notificationId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to delete notification' };
    }
  },
};

// User API calls
export const userAPI = {
  getProfile: async () => {
    try {
      const response = await api.get('/users/profile');
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to fetch profile' };
    }
  },

  updateProfile: async (data) => {
    try {
      const response = await api.put('/users/profile', data);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to update profile' };
    }
  },

  getAllUsers: async (params) => {
    try {
      const response = await api.get('/users', { params });
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to fetch users' };
    }
  },

  updateUserRole: async (userId, data) => {
    try {
      const response = await api.put(`/users/${userId}/role`, data);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to update user role' };
    }
  },
};

// Emergency Profile API calls
export const emergencyProfileAPI = {
  get: async () => {
    try {
      const response = await api.get('/users/profile/emergency');
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to fetch emergency profile' };
    }
  },

  update: async (data) => {
    try {
      const response = await api.put('/users/profile/emergency', data);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to update emergency profile' };
    }
  },
};

// Incident API calls
export const incidentAPI = {
  create: async (data) => {
    try {
      const response = await api.post('/incidents/create', data);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to create incident' };
    }
  },

  getMy: async (params) => {
    try {
      const response = await api.get('/incidents/my', { params });
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to fetch your incidents' };
    }
  },

  getActive: async (params) => {
    try {
      const response = await api.get('/incidents/active', { params });
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to fetch active incidents' };
    }
  },

  updateStatus: async (id, status) => {
    try {
      const response = await api.put(`/incidents/${id}/status`, { status });
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to update incident status' };
    }
  },

  getById: async (id) => {
    try {
      const response = await api.get(`/incidents/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to fetch incident' };
    }
  },
};

// Map API calls
export const mapAPI = {
  upload: async (incidentId, formData) => {
    try {
      const response = await api.post(`/maps/upload/${incidentId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to upload map' };
    }
  },

  getByIncident: async (incidentId) => {
    try {
      const response = await api.get(`/maps/incident/${incidentId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to fetch map' };
    }
  },

  getMy: async () => {
    try {
      const response = await api.get('/maps/my');
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to fetch your maps' };
    }
  },

  delete: async (mapId) => {
    try {
      const response = await api.delete(`/maps/${mapId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to delete map' };
    }
  },
};

// Phantom Map API calls
export const phantomAPI = {
  upload: async (formData) => {
    try {
      const response = await api.post('/phantom/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to upload house layout' };
    }
  },

  getMy: async () => {
    try {
      const response = await api.get('/phantom/my');
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to fetch your maps' };
    }
  },

  getActive: async () => {
    try {
      const response = await api.get('/phantom/active');
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to fetch active map' };
    }
  },

  setActive: async (mapId) => {
    try {
      const response = await api.put(`/phantom/${mapId}/activate`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to set active map' };
    }
  },

  delete: async (mapId) => {
    try {
      const response = await api.delete(`/phantom/${mapId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to delete map' };
    }
  },
};

// What If Scenario API calls
export const whatIfAPI = {
  simulateScenario: async (data) => {
    try {
      const response = await api.post('/whatif/simulate', data);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to simulate scenario' };
    }
  },
};

// ==================== BOTTLENECK API ====================
// Used by CivilianBottleneck.jsx and CommandBottleneck.jsx via api.post() directly.
// These named exports are provided for consistency if needed elsewhere.
export const bottleneckAPI = {
  /**
   * Civilian route analysis
   * @param {{userLatitude, userLongitude, familySize, mobilityType, departureDelay, disasterType, disasterIntensity, affectedPopulation}} data
   */
  simulateCivilian: async (data) => {
    try {
      const response = await api.post('/bottleneck/civilian', data);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Civilian simulation failed' };
    }
  },

  /**
   * Command bottleneck simulation
   * @param {{affectedPopulation, disasterIntensity, preparednessScore, evacuationLoad, roadCapacityMultiplier, timeOfDay}} data
   */
  simulateCommand: async (data) => {
    try {
      const response = await api.post('/bottleneck/command', data);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Command simulation failed' };
    }
  },
};
// Broadcast Alert API calls
export const broadcastAPI = {
  create: async (data) => {
    try {
      const response = await api.post('/broadcasts', data);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to send broadcast' };
    }
  },

  getAll: async (limit = 50) => {
    try {
      const response = await api.get('/broadcasts', { params: { limit } });
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to fetch broadcasts' };
    }
  },
};

// SOS Beacon API calls
export const sosAPI = {
  // User: activate / ping SOS beacon
  activate: async (data) => {
    try {
      const response = await api.post('/sos/activate', data);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to activate SOS' };
    }
  },

  // User: deactivate SOS beacon
  deactivate: async () => {
    try {
      const response = await api.put('/sos/deactivate');
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to deactivate SOS' };
    }
  },

  // Command: get all active beacons
  getActive: async () => {
    try {
      const response = await api.get('/sos/active');
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to fetch SOS beacons' };
    }
  },

  // Command: update beacon rescue status
  updateStatus: async (beaconId, rescueStatus) => {
    try {
      const response = await api.put(`/sos/${beaconId}/status`, { rescueStatus });
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to update beacon status' };
    }
  },

  // Command: clear resolved beacons
  clearResolved: async () => {
    try {
      const response = await api.delete('/sos/resolved');
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to clear resolved beacons' };
    }
  },
};

// Resource API calls
export const resourceAPI = {
  getAll: async () => {
    try {
      const response = await api.get('/resources');
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to fetch resources' };
    }
  },
  add: async (type) => {
    try {
      const response = await api.post('/resources/add', { type });
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to add resource' };
    }
  },
  removeByType: async (type) => {
    try {
      const response = await api.delete(`/resources/remove/${type}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to remove resource' };
    }
  },
  update: async (id, data) => {
    try {
      const response = await api.patch(`/resources/${id}`, data);
      return response.data;
    } catch (error) {
      throw error.response?.data || { success: false, message: 'Failed to update resource' };
    }
  }
};

export default api;
