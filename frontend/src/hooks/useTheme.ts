import { useEffect, useState } from 'react';
import { GetConfig, UpdateConfig } from '../../wailsjs/go/main/App';

// Development logger
const isDev = import.meta.env.DEV;
const logError = (...args: any[]) => {
  if (isDev) console.error(...args);
};

type Theme = 'light' | 'dark' | 'system';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    // Load saved theme from config
    const loadTheme = async () => {
      try {
        const config = await GetConfig();
        setTheme(config.theme as Theme);
        applyTheme(config.theme as Theme);
      } catch (error) {
        logError('Failed to load theme:', error);
        applyTheme('system');
      }
    };

    loadTheme();
  }, []);

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement;
    
    if (newTheme === 'system') {
      // Use system preference
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.toggle('dark', systemTheme === 'dark');
    } else {
      root.classList.toggle('dark', newTheme === 'dark');
    }
  };

  const changeTheme = async (newTheme: Theme) => {
    setTheme(newTheme);
    applyTheme(newTheme);
    
    try {
      const config = await GetConfig();
      config.theme = newTheme;
      await UpdateConfig(config);
    } catch (error) {
      logError('Failed to save theme:', error);
    }
  };

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyTheme('system');
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return { theme, changeTheme };
}
