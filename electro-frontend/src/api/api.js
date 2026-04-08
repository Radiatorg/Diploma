import axios from 'axios';
import { API_ORIGIN } from '../utils/apiOrigin';

const API_BASE_URL = `${API_ORIGIN}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Добавляем токен к каждому запросу
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Обработка ошибок
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const originalRequest = error.config;

    // Если ошибка 401 (Unauthorized) и мы еще не пытались повторить запрос (или это не запрос логина)
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      console.warn('Сессия истекла или токен недействителен. Выход из системы...');
      
      // Очищаем хранилище
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Принудительный редирект на страницу входа
      // Используем window.location, так как axios находится вне контекста React Router
      if (window.location.pathname !== '/login') {
          window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
};

// User API
export const userAPI = {
  getProfile: () => api.get('/user/profile'),
  updateProfile: (data) => api.put('/user/profile', data),
  deleteProfile: () => api.delete('/user/profile'),
};

// Project API (Designer)
export const projectAPI = {
  getAll: () => api.get('/designer/projects'),
  getById: (id) => api.get(`/designer/projects/${id}`),
  create: (data) => api.post('/designer/projects', data),
  update: (id, data) => api.put(`/designer/projects/${id}`, data),
  delete: (id) => api.delete(`/designer/projects/${id}`),
};

// Room API
export const roomAPI = {
  getByProject: (projectId) => api.get(`/designer/projects/${projectId}/rooms`),
  getById: (projectId, roomId) => api.get(`/designer/projects/${projectId}/rooms/${roomId}`),
  create: (projectId, data) => api.post(`/designer/projects/${projectId}/rooms`, data),
  update: (projectId, roomId, data) => api.put(`/designer/projects/${projectId}/rooms/${roomId}`, data),
  delete: (projectId, roomId) => api.delete(`/designer/projects/${projectId}/rooms/${roomId}`),
  getTypes: () => api.get('/room-types'),
  getWalls: (projectId, roomId) => api.get(`/designer/projects/${projectId}/rooms/${roomId}/walls`),
};

// Appliance API
export const applianceAPI = {
  getAll: () => api.get('/appliances'),
  getById: (id) => api.get(`/appliances/${id}`),
};

// Manufacturers (производители / изготовители)
export const manufacturerAPI = {
  list: () => api.get('/manufacturers'),
  getById: (id) => api.get(`/manufacturers/${id}`),
  getAppliances: (id) => api.get(`/manufacturers/${id}/appliances`),
};

// Category API
export const categoryAPI = {
  getAll: () => api.get('/categories'),
  getById: (id) => api.get(`/categories/${id}`),
  create: (data) => api.post('/categories', data),
  delete: (id) => api.delete(`/categories/${id}`),
};

// Chat API
export const chatAPI = {
  getAllMessages: () => api.get('/chat/messages'),
  createMessage: (data) => api.post('/chat/messages', data),
  deleteMessage: (id) => api.delete(`/chat/messages/${id}`),
};

// Project Appliance API
export const projectApplianceAPI = {
  getByProject: (projectId) => api.get(`/designer/projects/${projectId}/appliances`),
  add: (projectId, data) => api.post(`/designer/projects/${projectId}/appliances`, data),
  update: (projectId, projectApplianceId, data) => api.put(`/designer/projects/${projectId}/appliances/${projectApplianceId}`, data),
  delete: (projectId, projectApplianceId) => api.delete(`/designer/projects/${projectId}/appliances/${projectApplianceId}`),
};

// Calculation API
export const calculationAPI = {
  getReport: (projectId) => api.get(`/designer/projects/${projectId}/calculations`),
};

// Specification API
export const specificationAPI = {
  getSpecification: (projectId) => api.get(`/designer/projects/${projectId}/specifications`),
};

// PDF Export API
export const pdfExportAPI = {
  exportSpecification: (projectId) => api.get(`/designer/projects/${projectId}/export/specification.pdf`, { responseType: 'blob' }),
  exportCalculation: (projectId) => api.get(`/designer/projects/${projectId}/export/calculation.pdf`, { responseType: 'blob' }),
};

// Email API
export const emailAPI = {
  sendCalculationAndSpecification: (projectId) => api.post(`/designer/projects/${projectId}/send-email`),
};

// Saved Specification API
export const savedSpecificationAPI = {
  save: (projectId, data) => api.post(`/designer/projects/${projectId}/saved-specifications`, data),
  getAll: (projectId) => api.get(`/designer/projects/${projectId}/saved-specifications`),
  getById: (projectId, specificationId, full = false) => {
    const url = `/designer/projects/${projectId}/saved-specifications/${specificationId}`;
    return api.get(url, { 
      params: { full: full ? 'true' : 'false' } 
    });
  },
  delete: (projectId, specificationId) => api.delete(`/designer/projects/${projectId}/saved-specifications/${specificationId}`),
};

// Admin API
export const adminAPI = {
  // Users
  getAllUsers: () => api.get('/admin/users'),
  getUserById: (id) => api.get(`/admin/users/${id}`),
  createUser: (data, roles) => api.post('/admin/users', data, { params: { roles } }),
  updateUser: (id, data, roles) => api.put(`/admin/users/${id}`, data, { params: { roles } }),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  
  // Appliances
  getAllAppliances: () => api.get('/appliances'),
  createAppliance: (data) => api.post('/admin/appliances', data),
  updateAppliance: (id, data) => api.put(`/admin/appliances/${id}`, data),
  deleteAppliance: (id) => api.delete(`/admin/appliances/${id}`),
  
  // Room Types
  getAllRoomTypes: () => api.get('/admin/room-types'),
  createRoomType: (data) => api.post('/admin/room-types', data),
  updateRoomType: (id, data) => api.put(`/admin/room-types/${id}`, data),
  deleteRoomType: (id) => api.delete(`/admin/room-types/${id}`),
  
  // Projects
  getAllProjects: () => api.get('/admin/projects'),
  getProjectById: (id) => api.get(`/admin/projects/${id}`),
  
  // Project details (admin can access designer endpoints)
  getProjectRooms: (projectId) => api.get(`/designer/projects/${projectId}/rooms`),
  getProjectAppliances: (projectId) => api.get(`/designer/projects/${projectId}/appliances`),
  getProjectCalculation: (projectId) => api.get(`/designer/projects/${projectId}/calculations`),
  getProjectSpecification: (projectId) => api.get(`/designer/projects/${projectId}/specifications`),
  
  // Statistics
  getApplianceStatistics: () => api.get('/admin/statistics/appliances'),
  getManufacturerStatistics: () => api.get('/admin/statistics/manufacturers'),

  // Manufacturers (admin)
  getAllManufacturers: () => api.get('/admin/manufacturers'),
  getManufacturerById: (id) => api.get(`/admin/manufacturers/${id}`),
  createManufacturer: (data) => api.post('/admin/manufacturers', data),
  updateManufacturer: (id, data) => api.put(`/admin/manufacturers/${id}`, data),
  deleteManufacturer: (id) => api.delete(`/admin/manufacturers/${id}`),
  exportManufacturersExcel: () =>
    api.get('/admin/manufacturers/export/excel', { responseType: 'blob' }),
  importManufacturersExcel: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/admin/manufacturers/import/excel', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Appliances Excel
  exportAppliancesExcel: () =>
    api.get('/admin/appliances/export/excel', { responseType: 'blob' }),
  importAppliancesExcel: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/admin/appliances/import/excel', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  // Electrical Symbols
  createElectricalSymbol: (data) => api.post('/admin/electrical-symbols', data),
  updateElectricalSymbol: (id, data) => api.put(`/admin/electrical-symbols/${id}`, data),
  deleteElectricalSymbol: (id) => api.delete(`/admin/electrical-symbols/${id}`),
};

// Floor Plan API
export const floorPlanAPI = {
  get: (projectId) => api.get(`/designer/projects/${projectId}/floor-plan`),
  createOrUpdate: (projectId, data) => api.post(`/designer/projects/${projectId}/floor-plan`, data),
  update: (projectId, data) => api.put(`/designer/projects/${projectId}/floor-plan`, data),
  delete: (projectId) => api.delete(`/designer/projects/${projectId}/floor-plan`),
};

// Wall API
export const wallAPI = {
  getByProject: (projectId) => api.get(`/designer/projects/${projectId}/walls`),
  create: (projectId, data) => api.post(`/designer/projects/${projectId}/walls`, data),
  saveBatch: (projectId, data) => api.post(`/designer/projects/${projectId}/walls/batch`, data),
  update: (projectId, wallId, data) => api.put(`/designer/projects/${projectId}/walls/${wallId}`, data),
  delete: (projectId, wallId) => api.delete(`/designer/projects/${projectId}/walls/${wallId}`),
};

// Electrical Point API
export const electricalPointAPI = {
  getByProject: (projectId) => api.get(`/designer/projects/${projectId}/electrical-points`),
  create: (projectId, data) => api.post(`/designer/projects/${projectId}/electrical-points`, data),
  saveBatch: (projectId, data) => api.post(`/designer/projects/${projectId}/electrical-points/batch`, data),
  update: (projectId, pointId, data) => api.put(`/designer/projects/${projectId}/electrical-points/${pointId}`, data),
  delete: (projectId, pointId) => api.delete(`/designer/projects/${projectId}/electrical-points/${pointId}`),
};

// Cable Run API
export const cableRunAPI = {
  getByProject: (projectId) => api.get(`/designer/projects/${projectId}/cable-runs`),
  create: (projectId, data) => api.post(`/designer/projects/${projectId}/cable-runs`, data),
  update: (projectId, cableRunId, data) =>
    api.put(`/designer/projects/${projectId}/cable-runs/${cableRunId}`, data),
  delete: (projectId, cableRunId) => api.delete(`/designer/projects/${projectId}/cable-runs/${cableRunId}`),
};

// Circuit API
export const circuitAPI = {
  getByProject: (projectId) => api.get(`/designer/projects/${projectId}/circuits`),
  create: (projectId, data) => api.post(`/designer/projects/${projectId}/circuits`, data),
  update: (projectId, circuitId, data) => api.put(`/designer/projects/${projectId}/circuits/${circuitId}`, data),
  delete: (projectId, circuitId) => api.delete(`/designer/projects/${projectId}/circuits/${circuitId}`),
};

// Electrical Symbol API
export const electricalSymbolAPI = {
  getAll: () => api.get('/electrical-symbols'),
  getByType: (type) => api.get(`/electrical-symbols/type/${type}`),
  getByCategory: (category) => api.get(`/electrical-symbols/category/${category}`),
  getById: (id) => api.get(`/electrical-symbols/${id}`),
};

// File API
export const fileAPI = {
  upload: (file, type = 'general') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    return api.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  getFileUrl: (filename) => `${API_BASE_URL}/files/${filename}`,
  delete: (filename) => api.delete(`/files/${filename}`),
};

export default api;

