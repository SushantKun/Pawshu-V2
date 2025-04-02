import axios from 'axios';
import { isTokenExpired, clearAuthData, USER_ROLES, TOKEN_STORAGE_KEYS } from '../utils/auth';

// Create axios instance with base URL
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add a request interceptor to include auth token
api.interceptors.request.use((config) => {
  // Check which token to use based on the endpoint
  let token = null;
  const url = config.url || '';
  
  if (url.startsWith('/admin')) {
    token = localStorage.getItem(TOKEN_STORAGE_KEYS.ADMIN);
    // Check if token is expired and clear it
    if (token && isTokenExpired(token)) {
      clearAuthData(USER_ROLES.ADMIN);
      token = null;
    }
  } else if (url.startsWith('/doctors') || url.includes('/doctor')) {
    token = localStorage.getItem(TOKEN_STORAGE_KEYS.DOCTOR);
    // Check if token is expired and clear it
    if (token && isTokenExpired(token)) {
      clearAuthData(USER_ROLES.DOCTOR);
      token = null;
    }
  } else {
    token = localStorage.getItem(TOKEN_STORAGE_KEYS.USER);
    // Check if token is expired and clear it
    if (token && isTokenExpired(token)) {
      clearAuthData(USER_ROLES.USER);
      token = null;
    }
  }
  
  // If token exists, add it to headers
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Add a response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Handle specific error cases
      switch (error.response.status) {
        case 401:
          // Unauthorized - determine which auth to clear based on URL
          if (error.config.url?.startsWith('/admin')) {
            clearAuthData(USER_ROLES.ADMIN);
            window.location.href = '/admin/login';
          } else if (error.config.url?.startsWith('/doctors') || error.config.url?.includes('/doctor')) {
            clearAuthData(USER_ROLES.DOCTOR);
            window.location.href = '/doctor/login';
          } else {
            clearAuthData(USER_ROLES.USER);
            window.location.href = '/login';
          }
          break;
        case 403:
          // Forbidden - user doesn't have necessary permissions
          console.error('Access forbidden');
          break;
        default:
          // Handle other error cases
          console.error('API Error:', error.response.data);
      }
    }
    return Promise.reject(error);
  }
);

export default api; 