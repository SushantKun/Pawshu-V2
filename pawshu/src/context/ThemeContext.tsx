import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface ThemeContextType {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const auth = useAuth();
  const user = auth?.user;
  const userId = user?._id || 'guest';
  const userRole = user?.role || 'guest';
  
  // Generate a unique theme key based on user ID and role
  const themeKey = `theme_${userRole}_${userId}`;
  
  // Initialize dark mode from localStorage if available, using user and role specific key
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const savedTheme = localStorage.getItem(themeKey);
    return savedTheme ? JSON.parse(savedTheme) : false;
  });

  // Update theme when user changes
  useEffect(() => {
    const savedTheme = localStorage.getItem(themeKey);
    if (savedTheme) {
      setDarkMode(JSON.parse(savedTheme));
    } else {
      // Reset to default when changing users
      setDarkMode(false);
    }
  }, [userId, userRole, themeKey]);

  // Persist theme to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(themeKey, JSON.stringify(darkMode));
    
    // Apply dark mode to the document
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode, themeKey]);

  const toggleDarkMode = () => {
    setDarkMode(prevMode => !prevMode);
  };

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}; 