import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface ThemeContextType {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const userId = user?._id || 'guest';
  
  // Initialize dark mode from localStorage if available, using user-specific key
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const savedTheme = localStorage.getItem(`theme_${userId}`);
    return savedTheme ? JSON.parse(savedTheme) : false;
  });

  // Update theme when user changes
  useEffect(() => {
    const savedTheme = localStorage.getItem(`theme_${userId}`);
    if (savedTheme) {
      setDarkMode(JSON.parse(savedTheme));
    }
  }, [userId]);

  // Persist theme to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(`theme_${userId}`, JSON.stringify(darkMode));
    
    // Apply dark mode to the document
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode, userId]);

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