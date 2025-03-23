import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to add the auth token
api.interceptors.request.use(
  (config) => {
    // Use the token provided in the headers first (if available)
    if (config.headers.Authorization) {
      console.log(`Authorization header already set for ${config.url}`);
      return config;
    }
    
    // Otherwise, try to determine the right token based on URL
    let token;
    let tokenSource = '';
    
    // Specific check for doctor dashboard endpoint
    if (config.url === '/doctors/dashboard-stats') {
      console.log('🔍 Detected doctor dashboard stats request');
      token = localStorage.getItem('doctorToken');
      const doctorInfo = localStorage.getItem('doctorInfo');
      
      console.log('📋 Doctor info in localStorage:', doctorInfo ? JSON.parse(doctorInfo) : 'None');
      
      if (token) {
        console.log('✅ Found doctorToken for dashboard');
      } else {
        console.log('❌ No doctorToken found for dashboard!');
      }
    }
    // For doctor-related routes, always use the doctor token if available
    else if (config.url?.includes('/doctors') || config.url?.includes('/appointments/doctor')) {
      token = localStorage.getItem('doctorToken');
      tokenSource = 'doctorToken';
      console.log('Using doctorToken for request to:', config.url);
    } else if (config.url?.includes('/admin')) {
      token = localStorage.getItem('adminToken');
      tokenSource = 'adminToken';
      console.log('Using adminToken for request to:', config.url);
    } else {
      token = localStorage.getItem('token');
      tokenSource = 'regularToken';
      console.log('Using regular token for request to:', config.url);
    }
    
    // If URL doesn't match specific patterns but tokens exist, prioritize
    if (!token) {
      if (localStorage.getItem('doctorToken')) {
        token = localStorage.getItem('doctorToken');
        tokenSource = 'fallback doctorToken';
        console.log('Falling back to doctorToken');
      } else if (localStorage.getItem('adminToken')) {
        token = localStorage.getItem('adminToken');
        tokenSource = 'fallback adminToken';
        console.log('Falling back to adminToken');
      } else if (localStorage.getItem('token')) {
        token = localStorage.getItem('token');
        tokenSource = 'fallback regularToken';
        console.log('Falling back to regular token');
      }
    }
    
    if (token) {
      console.log(`Setting Authorization header with ${tokenSource} for ${config.url}`);
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      console.log(`⚠️ No token available for ${config.url}`);
    }
    
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Add a response interceptor to log forbidden errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 403) {
      console.error('🚫 403 Forbidden Error:', {
        url: error.config.url,
        method: error.config.method,
        hasAuthHeader: !!error.config.headers.Authorization,
        response: error.response.data
      });
      
      // Log the token that was used (first 10 chars only for security)
      if (error.config.headers.Authorization) {
        const token = error.config.headers.Authorization.replace('Bearer ', '');
        console.log(`Token used (first 10 chars): ${token.substring(0, 10)}...`);
        
        // If this is a doctor route, check if doctor info exists
        if (error.config.url?.includes('/doctors')) {
          const doctorInfo = localStorage.getItem('doctorInfo');
          console.log('📋 Doctor info during error:', doctorInfo ? JSON.parse(doctorInfo) : 'None');
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api; 