"use client";

import React from 'react';
import { useTheme } from '../hooks/useTheme';

const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  
  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };
  
  return (
    <button
      onClick={toggleTheme}
      className="rounded-md p-2 hover:bg-card/50"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
    >
      {theme === 'dark' ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 3V4M12 20V21M21 12H20M4 12H3M18.364 18.364L17.657 17.657M6.343 6.343L5.636 5.636M18.364 5.636L17.657 6.343M6.343 17.657L5.636 18.364M16 12C16 14.2091 14.2091 16 12 16C9.79086 16 8 14.2091 8 12C8 9.79086 9.79086 8 12 8C14.2091 8 16 9.79086 16 12Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 3C10.8065 4.19347 10.136 5.81217 10.136 7.5C10.136 11.0899 13.0461 14 16.636 14C18.3238 14 19.9425 13.3295 21.136 12.136C20.3318 16.0422 16.8969 19 12.7748 19C8.29126 19 4.66425 15.5376 4.66425 11.2C4.66425 7.12328 7.8909 3.77577 12 3Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
};

export default ThemeToggle;