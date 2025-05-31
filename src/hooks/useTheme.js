"use client";

import { useState, useEffect } from 'react';
import { STORAGE_KEYS, THEMES } from '../lib/constants';

export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    // Check for saved theme preference in localStorage
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
      if (savedTheme) {
        return savedTheme;
      }
      
      // Check for system preference
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return THEMES.DARK;
      }
    }
    
    // Default to dark theme
    return THEMES.DARK;
  });
  
  // Update theme in localStorage and apply to document
  const setTheme = (newTheme) => {
    setThemeState(newTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.THEME, newTheme);
    }
  };
  
  // Apply theme class to document
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const root = window.document.documentElement;
      
      const isDark = 
        theme === THEMES.DARK ||
        (theme === THEMES.SYSTEM && 
          window.matchMedia('(prefers-color-scheme: dark)').matches);
      
      // Remove old theme class
      root.classList.remove('dark', 'light');
      
      // Add new theme class
      root.classList.add(isDark ? 'dark' : 'light');
    }
  }, [theme]);
  
  // Listen for system theme changes if using system preference
  useEffect(() => {
    if (typeof window !== 'undefined' && theme === THEMES.SYSTEM) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const handleChange = () => {
        setThemeState(THEMES.SYSTEM);
      };
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);
  
  return { theme, setTheme };
}
