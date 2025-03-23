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
      return config;
    }

    // Otherwise, try to determine the right token based on URL
    let token;

    if (config.url?.includes('/doctors/') || config.url?.includes('/appointments/doctor')) {
      token = localStorage.getItem('doctorToken');
      console.log('Using doctorToken for request to:', config.url);
    } else if (config.url?.includes('/admin/')) {
      token = localStorage.getItem('adminToken');
      console.log('Using adminToken for request to:', config.url);
    } else {
      token = localStorage.getItem('token');
      console.log('Using regular token for request to:', config.url);
    }

    // If URL doesn't match specific patterns but tokens exist, prioritize
    if (!token) {
      if (localStorage.getItem('doctorToken')) {
        token = localStorage.getItem('doctorToken');
        console.log('Falling back to doctorToken');
      } else if (localStorage.getItem('adminToken')) {
        token = localStorage.getItem('adminToken');
        console.log('Falling back to adminToken');
      } else if (localStorage.getItem('token')) {
        token = localStorage.getItem('token');
        console.log('Falling back to regular token');
      }
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      console.log('No token found for request to:', config.url);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api; 