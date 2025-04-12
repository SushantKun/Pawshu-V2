import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import axios from 'axios';

// Update User interface to match MongoDB structure with top-level properties
interface User {
  _id: string;
  email: string;
  role: string;
  createdAt?: string;
  __v?: number;
  // Properties can be either at the top level or in avatar
  firstName?: string;
  lastName?: string;
  status?: string;
  address?: string;
  phone?: string;
  isAdmin?: boolean;
  isDoctor?: boolean;
  verified?: boolean;
  name?: string; // Add the name property explicitly
  avatar?: {
    public_id?: string;
    url?: string;
    status?: string;
    address?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    isAdmin?: boolean;
    isDoctor?: boolean;
    verified?: boolean;
  };
  // Virtual property returned from MongoDB (computed from firstName and lastName)
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, userData?: User, rememberMe?: boolean) => Promise<void>;
  logout: () => void;
  loading: boolean;
  error: string | null;
  updateUser: (userData: User) => void;
  refreshToken: () => Promise<void>;
}

// Create context with a default value
const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  login: async () => { },
  logout: () => { },
  loading: true,
  error: null,
  updateUser: () => { },
  refreshToken: async () => { }
});

// Separate hook export
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Provider component
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modified to use token payload directly instead of API call
  const decodeToken = (token: string): User | null => {
    try {
      // Decode JWT token payload (middle part between dots)
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(window.atob(base64));

      console.log("Token payload:", payload);

      // Extract user data from token payload - we expect minimal data in token
      return {
        _id: payload._id,
        email: payload.email,
        role: payload.role
      };
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  };

  // Check if token is about to expire (within 1 hour)
  const isTokenExpiringSoon = (token: string): boolean => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(window.atob(base64));

      // Get expiration time from token
      const exp = payload.exp * 1000; // Convert to milliseconds
      const now = Date.now();

      // Check if token expires within the next hour
      return exp - now < 3600000; // 1 hour in milliseconds
    } catch (error) {
      console.error('Error checking token expiration:', error);
      return false;
    }
  };

  // Function to refresh the token
  const refreshToken = async (): Promise<void> => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Check if token needs refreshing
      if (!isTokenExpiringSoon(token)) return;

      // Get the stored remember me preference
      const rememberMe = localStorage.getItem('rememberMe') === 'true';

      // Call the refresh token endpoint
      const response = await axios.post('/api/auth/refresh-token', {}, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data && response.data.token) {
        // Update token in storage
        localStorage.setItem('token', response.data.token);

        // Set cookie expiration based on rememberMe flag
        const cookieExpiration = rememberMe
          ? 5184000  // 60 days in seconds if rememberMe is true
          : 604800;  // 7 days in seconds if rememberMe is false

        document.cookie = `token=${response.data.token}; path=/; max-age=${cookieExpiration}`;

        console.log('Token refreshed successfully');
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      // Don't log the user out if refresh fails, let the expired token handle that
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Get token from localStorage first
        let token = localStorage.getItem('token');
        const rememberMe = localStorage.getItem('rememberMe') === 'true';

        // Only check cookies if rememberMe was true
        if (!token && rememberMe) {
          const cookieToken = document.cookie
            .split('; ')
            .find(row => row.startsWith('token='))
            ?.split('=')[1];

          if (cookieToken) {
            token = cookieToken;
            localStorage.setItem('token', token);
          }
        }

        // If token exists but rememberMe is false, we should only use it for the current session
        // and not persist it in cookies (browser refresh is fine, but not reopening browser)

        // If we have a stored user, restore it
        const storedUser = localStorage.getItem('user');
        if (storedUser && token) {
          setUser(JSON.parse(storedUser));
        } else if (token) {
          // Decode and set minimal user from token
          const userData = decodeToken(token);
          if (userData) {
            setUser(userData);
          } else {
            // Invalid token, clear everything
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('rememberMe');
            document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        // On any error, clear all auth data
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('rememberMe');
        document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Set up token refresh interval to run every hour when user is active
  useEffect(() => {
    if (!user) return; // Only run when user is logged in

    // Refresh token immediately if needed
    refreshToken();

    // Set up interval to check token and refresh if needed
    const intervalId = setInterval(() => {
      refreshToken();
    }, 3600000); // Check every hour

    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, [user]);

  // Set up regular ping to keep user marked as online while browser is open
  useEffect(() => {
    if (!user) return; // Only run when user is logged in

    // Define ping function to send heartbeat to server
    const pingServer = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        // Send ping with user ID to update lastActive timestamp
        await axios.post(
          'http://localhost:5000/api/auth/ping',
          { userId: user._id },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            }
          }
        );
        
        // Only log pings once every minute for debugging
        const now = new Date();
        if (now.getSeconds() < 5) {
          console.log(`[Heartbeat] Online status ping sent for user ${user._id}`);
        }
      } catch (error) {
        console.error('Error sending ping:', error);
      }
    };

    // Send initial ping immediately
    pingServer();

    // Set up interval to ping the server every 5 seconds
    // Using a short interval ensures we know quickly when a user goes offline
    const pingInterval = setInterval(pingServer, 5000);

    // Add window event listener to handle browser/tab close properly
    const handleBeforeUnload = () => {
      // Try to send offline status when page is unloaded
      if (user && user._id) {
        console.log('Browser/tab closing, marking user as offline via beacon');
        
        // Create a proper blob for sendBeacon
        const blob = new Blob(
          [JSON.stringify({ userId: user._id })], 
          { type: 'application/json' }
        );
        
        // Try sendBeacon first (most reliable for page unload)
        const beaconSuccess = navigator.sendBeacon(
          'http://localhost:5000/api/auth/set-offline-beacon',
          blob
        );
        
        // Fallback method in case sendBeacon isn't supported or fails
        if (!beaconSuccess) {
          console.log('SendBeacon failed, using sync XHR as fallback');
          const token = localStorage.getItem('token');
          if (token) {
            try {
              const xhr = new XMLHttpRequest();
              xhr.open('POST', 'http://localhost:5000/api/auth/set-offline', false); // synchronous
              xhr.setRequestHeader('Content-Type', 'application/json');
              xhr.setRequestHeader('Authorization', `Bearer ${token}`);
              xhr.send(JSON.stringify({ userId: user._id }));
            } catch (error) {
              console.error('Error in XHR fallback:', error);
            }
          }
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Also set up visibility change to handle tab switching
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // User is viewing this tab again, ping immediately
        console.log('Tab became visible, sending ping');
        pingServer();
      }
      // If page becomes hidden, we don't need to do anything
      // User will be marked offline automatically after 7 seconds of no pings
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Clean up intervals and event listeners on unmount
    return () => {
      clearInterval(pingInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  const login = async (token: string, userData?: User, rememberMe: boolean = false) => {
    setLoading(true);
    setError(null);

    try {
      // Save token to localStorage 
      localStorage.setItem('token', token);

      // Store the rememberMe preference for token refresh
      localStorage.setItem('rememberMe', rememberMe ? 'true' : 'false');

      // Set cookie expiration based on rememberMe flag
      if (rememberMe) {
        // If remember me is checked, set a long cookie expiration (60 days)
        document.cookie = `token=${token}; path=/; max-age=5184000`;
      } else {
        // If remember me is NOT checked, don't set a cookie at all
        // This ensures when browser is closed, session ends
        // The localStorage token will still work until explicitly logged out
        document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      }

      // Log response data for debugging
      console.log("Login response userData:", userData);

      // Use passed userData from login response if available, otherwise decode from token
      if (userData) {
        // Store the complete user object for future sessions
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
      } else {
        const decodedUser = decodeToken(token);
        if (!decodedUser) {
          throw new Error('Failed to decode user data from token');
        }
        setUser(decodedUser);
      }
    } catch (error) {
      console.error('Login error:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('rememberMe');
      document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      setError('Failed to authenticate');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Mark user as offline before removing the token
      if (user && user._id) {
        try {
          console.log('Logging out user');
          const token = localStorage.getItem('token');
          
          // Make sure user is marked as offline
          await axios.post(
            'http://localhost:5000/api/auth/set-offline',
            { userId: user._id },
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              }
            }
          );
          console.log('User marked as offline');
        } catch (error) {
          console.error('Error marking user as offline:', error);
        }
      }
      
      // Remove token and user data from local storage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('rememberMe');
      
      // Reset user state
      setUser(null);
      
      // Use window.location.href instead of navigate
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const updateUser = (userData: User) => {
    setUser(userData);
    // Update localStorage with new user data
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const value = {
    user,
    isAuthenticated: !!user,
    login,
    logout,
    loading,
    error,
    updateUser,
    refreshToken
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};