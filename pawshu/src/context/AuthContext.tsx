import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const API_URL = 'http://localhost:5000/api';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const response = await axios.get(`${API_URL}/auth/profile`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.status === 200) {
            setUser(response.data);
          } else {
            localStorage.removeItem('token');
          }
        } catch (error) {
          console.error('Error loading user:', error);
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };

    loadUser();
  }, []);

  const login = async (token: string) => {
    localStorage.setItem('token', token);
    try {
      const response = await axios.get(`${API_URL}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.status === 200) {
        const userData = response.data;
        setUser(userData);
        
        // Transfer guest cart and wishlist to user account if they exist
        const guestCart = localStorage.getItem('cartItems_guest');
        const guestWishlist = localStorage.getItem('wishlist_guest');
        
        // Only transfer if guest data exists and user data doesn't
        if (guestCart && !localStorage.getItem(`cartItems_${userData._id}`)) {
          localStorage.setItem(`cartItems_${userData._id}`, guestCart);
        }
        
        if (guestWishlist && !localStorage.getItem(`wishlist_${userData._id}`)) {
          localStorage.setItem(`wishlist_${userData._id}`, guestWishlist);
        }
      }
    } catch (error) {
      console.error('Error loading user after login:', error);
    }
  };

  const logout = () => {
    // Only clear authentication token, not user data
    localStorage.removeItem('token');
    localStorage.removeItem('adminToken');
    
    // Don't clear user-specific cart and wishlist data
    // This allows the data to persist between sessions
    
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      logout,
      isAuthenticated: !!user
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 