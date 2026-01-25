import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState('light');
  const [mounted, setMounted] = useState(false);

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const stored = localStorage.getItem('theme');
    
    if (stored) {
      setTheme(stored);
      applyTheme(stored);
    } else {
      // Respect system preference
      const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const systemTheme = dark ? 'dark' : 'light';
      setTheme(systemTheme);
      applyTheme(systemTheme);
    }
    
    setMounted(true);
  }, []);

  const applyTheme = (newTheme) => {
    const html = document.documentElement;
    if (newTheme === 'dark') {
      html.setAttribute('data-theme', 'dark');
    } else {
      html.removeAttribute('data-theme');
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    applyTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  // Prevent flash on mount
  if (!mounted) return null;

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg bg-bg-secondary border border-border hover:bg-bg-tertiary transition-colors duration-200"
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? (
        <Moon size={20} className="text-text-primary" />
      ) : (
        <Sun size={20} className="text-text-primary" />
      )}
    </button>
  );
}
