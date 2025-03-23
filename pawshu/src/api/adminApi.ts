import axios from 'axios';

// Create a separate admin-specific API instance
const adminApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
});

// Debug the environment variables
console.log('Admin API URL:', import.meta.env.VITE_API_URL);

// Add a request interceptor to add the admin token
adminApi.interceptors.request.use(
  (config) => {
    // Always get the admin token from localStorage
    const adminToken = localStorage.getItem('adminToken');
    
    if (adminToken) {
      config.headers.Authorization = `Bearer ${adminToken}`;
      console.log('Admin API: Using token for request:', config.url);
    } else {
      console.error('Admin API: No admin token available');
      
      // If we're on an admin page without a token, redirect to login
      if (window.location.pathname.includes('/admin')) {
        console.warn('Admin API: No token but on admin page, redirecting to login');
        window.location.href = '/admin/login';
      }
    }
    
    return config;
  },
  (error) => {
    console.error('Admin API: Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Add a response interceptor for better error handling
adminApi.interceptors.response.use(
  (response) => {
    // Successfully received response
    return response;
  },
  (error) => {
    // Setup detailed error logging
    let errorDetails = {
      message: error.message,
      url: error.config?.url || 'unknown',
    };
    
    if (error.response) {
      errorDetails = {
        ...errorDetails,
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
      };
      
      // Handle 401 Unauthorized errors (token expired or invalid)
      if (error.response.status === 401) {
        console.error('Admin API: Authentication failed (401)');
        
        // Clear the admin token and user data
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        
        // Check if we're on an admin page
        if (window.location.pathname.includes('/admin')) {
          console.warn('Admin API: Authentication failed while on admin page, redirecting to login');
          window.location.href = '/admin/login';
        }
      }
      
      // Handle 403 Forbidden errors (not an admin)
      if (error.response.status === 403) {
        console.error('Admin API: Not authorized as admin (403)');
        
        // Clear the admin token and user data
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        
        // Check if we're on an admin page
        if (window.location.pathname.includes('/admin')) {
          console.warn('Admin API: Forbidden access while on admin page, redirecting to login');
          window.location.href = '/admin/login';
        }
      }
    }
    
    console.error('Admin API Error:', errorDetails);
    return Promise.reject(error);
  }
);

export default adminApi; 