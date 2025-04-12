import axios from 'axios';
import { isTokenExpired, shouldRefreshToken, clearAuthData, USER_ROLES, TOKEN_STORAGE_KEYS } from '../utils/auth';

// Create axios instance with base URL
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Track if we're currently refreshing a token to prevent infinite loops
let isRefreshing = false;

// Function to refresh a token
const refreshToken = async (role: string, token: string): Promise<string | null> => {
  if (isRefreshing) return token; // Prevent concurrent refresh attempts
  
  try {
    isRefreshing = true;
    
    const response = await axios.post('http://localhost:5000/api/auth/refresh-token', {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (response.data && response.data.token) {
      const newToken = response.data.token;
      
      // Store the new token based on role
      switch (role) {
        case USER_ROLES.ADMIN:
          localStorage.setItem(TOKEN_STORAGE_KEYS.ADMIN, newToken);
          break;
        case USER_ROLES.DOCTOR:
          localStorage.setItem(TOKEN_STORAGE_KEYS.DOCTOR, newToken);
          break;
        case USER_ROLES.USER:
        default:
          localStorage.setItem(TOKEN_STORAGE_KEYS.USER, newToken);
          
          // Get the stored remember me preference
          const rememberMe = localStorage.getItem('rememberMe') === 'true';
          
          // Set cookie expiration based on rememberMe flag
          const cookieExpiration = rememberMe 
            ? 5184000  // 60 days in seconds if rememberMe is true
            : 604800;  // 7 days in seconds if rememberMe is false
          
          document.cookie = `token=${newToken}; path=/; max-age=${cookieExpiration}`;
          break;
      }
      
      console.log(`Token refreshed for ${role} role`);
      return newToken;
    }
    
    return token;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return token;
  } finally {
    isRefreshing = false;
  }
};

// Add a request interceptor to include auth token
api.interceptors.request.use(async (config) => {
  // Check which token to use based on the endpoint
  let token = null;
  let role = USER_ROLES.USER;
  const url = config.url || '';
  
  if (url.startsWith('/admin')) {
    token = localStorage.getItem(TOKEN_STORAGE_KEYS.ADMIN);
    role = USER_ROLES.ADMIN;
    
    // Check if token is expired and clear it
    if (token && isTokenExpired(token)) {
      clearAuthData(role);
      token = null;
    }
    // Check if token should be refreshed
    else if (token && shouldRefreshToken(token)) {
      token = await refreshToken(role, token);
    }
  } else if (url.startsWith('/doctors') || url.includes('/doctor')) {
    token = localStorage.getItem(TOKEN_STORAGE_KEYS.DOCTOR);
    role = USER_ROLES.DOCTOR;
    
    // Check if token is expired and clear it
    if (token && isTokenExpired(token)) {
      clearAuthData(role);
      token = null;
    }
    // Check if token should be refreshed
    else if (token && shouldRefreshToken(token)) {
      token = await refreshToken(role, token);
    }
  } else {
    token = localStorage.getItem(TOKEN_STORAGE_KEYS.USER);
    role = USER_ROLES.USER;
    
    // Check if token is expired and clear it
    if (token && isTokenExpired(token)) {
      clearAuthData(role);
      token = null;
    }
    // Check if token should be refreshed
    else if (token && shouldRefreshToken(token) && !url.includes('/refresh-token')) {
      // Avoid refreshing during a refresh call to prevent infinite loops
      token = await refreshToken(role, token);
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