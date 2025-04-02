/**
 * Auth utility functions for session management
 */

/**
 * Decodes a JWT token and returns its payload
 * @param token The JWT token to decode
 * @returns The decoded payload or an empty object if token is invalid
 */
export const decodeToken = (token: string | null): any => {
  if (!token) return {};
  
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding token:', error);
    return {};
  }
};

/**
 * Checks if a token is expired
 * @param token The JWT token to check
 * @returns True if token is expired or invalid, false otherwise
 */
export const isTokenExpired = (token: string | null): boolean => {
  if (!token) return true;
  
  try {
    const decoded = decodeToken(token);
    if (!decoded.exp) return true;
    
    // exp is in seconds, Date.now() is in milliseconds
    return decoded.exp * 1000 < Date.now();
  } catch (error) {
    console.error('Error checking token expiration:', error);
    return true;
  }
};

/**
 * Type definitions for different user roles
 */
export const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  DOCTOR: 'doctor'
};

/**
 * Storage keys for different tokens
 */
export const TOKEN_STORAGE_KEYS = {
  USER: 'token',
  ADMIN: 'adminToken',
  DOCTOR: 'doctorToken'
};

/**
 * Clears authentication data for a specific role
 * @param role The role to clear auth data for
 */
export const clearAuthData = (role: string): void => {
  switch (role) {
    case USER_ROLES.ADMIN:
      localStorage.removeItem(TOKEN_STORAGE_KEYS.ADMIN);
      break;
    case USER_ROLES.DOCTOR:
      localStorage.removeItem(TOKEN_STORAGE_KEYS.DOCTOR);
      localStorage.removeItem('doctorInfo');
      break;
    case USER_ROLES.USER:
    default:
      localStorage.removeItem(TOKEN_STORAGE_KEYS.USER);
      localStorage.removeItem('user');
      document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      break;
  }
};

/**
 * Checks if a user session is valid
 * @param role The role to check session for
 * @returns True if session is valid, false otherwise
 */
export const checkSession = (role: string): boolean => {
  let token: string | null;
  
  switch (role) {
    case USER_ROLES.ADMIN:
      token = localStorage.getItem(TOKEN_STORAGE_KEYS.ADMIN);
      break;
    case USER_ROLES.DOCTOR:
      token = localStorage.getItem(TOKEN_STORAGE_KEYS.DOCTOR);
      break;
    case USER_ROLES.USER:
    default:
      token = localStorage.getItem(TOKEN_STORAGE_KEYS.USER);
      break;
  }
  
  if (!token || isTokenExpired(token)) {
    clearAuthData(role);
    return false;
  }
  
  return true;
};

/**
 * Gets the session duration from a token
 * @param token The JWT token to check
 * @returns The session duration in minutes or 0 if invalid
 */
export const getSessionDuration = (token: string | null): number => {
  if (!token) return 0;
  
  try {
    const decoded = decodeToken(token);
    if (!decoded.exp || !decoded.iat) return 0;
    
    // exp and iat are in seconds
    return Math.round((decoded.exp - decoded.iat) / 60);
  } catch (error) {
    console.error('Error getting session duration:', error);
    return 0;
  }
}; 