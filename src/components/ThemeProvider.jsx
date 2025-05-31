'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { THEMES } from '@/lib/constants';

// Create context
const ThemeContext = createContext();

export function useThemeContext() {
  return useContext(ThemeContext);
}

export default function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(THEMES.DARK);
  const [mounted, setMounted] = useState(false);
  
  // Update theme in localStorage and document
  const updateTheme = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update document class
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    
    const isDark = 
      newTheme === THEMES.DARK || 
      (newTheme === THEMES.SYSTEM && 
       window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    root.classList.add(isDark ? 'dark' : 'light');
  };
  
  // Initialize theme from localStorage or system preference
  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme) {
      updateTheme(savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      updateTheme(THEMES.DARK);
    } else {
      updateTheme(THEMES.LIGHT);
    }
    
    // Listen for system theme changes if using system preference
    if (theme === THEMES.SYSTEM) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => updateTheme(THEMES.SYSTEM);
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, []);
  
  // Provide the theme context to children
  const value = {
    theme,
    setTheme: updateTheme,
  };
  
  // Avoid rendering with initial theme to prevent hydration mismatch
  if (!mounted) {
    return null;
  }
  
  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}