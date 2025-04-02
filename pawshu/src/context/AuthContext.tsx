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
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, userData?: User) => Promise<void>;
  logout: () => void;
  loading: boolean;
  error: string | null;
  updateUser: (userData: User) => void;
}

// Create context with a default value
const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  login: async () => {},
  logout: () => {},
  loading: true,
  error: null,
  updateUser: () => {}
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

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        let token = localStorage.getItem('token');
        
        if (!token) {
          const cookieToken = document.cookie
            .split('; ')
            .find(row => row.startsWith('token='))
            ?.split('=')[1];
            
          if (cookieToken) {
            token = cookieToken;
            localStorage.setItem('token', token);
          }
        }
        
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
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (token: string, userData?: User) => {
    setLoading(true);
    setError(null);

    try {
      // Save token to localStorage and cookies
      localStorage.setItem('token', token);
      document.cookie = `token=${token}; path=/; max-age=2592000`; // 30 days

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
      document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      setError('Failed to authenticate');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    setUser(null);
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
    updateUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};