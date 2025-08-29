import React, { createContext, useContext, useState, useEffect } from 'react';
import { APIClient } from '../services/api';

interface AppSettings {
  defaultMode: 'smart' | 'review' | 'raw';
  defaultTimeRange: string;
  showEmptyColumns: boolean;
  autoSave: boolean;
  theme: 'light' | 'dark';
}

interface AppContextType {
  apiClient: APIClient | null;
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  sessionId: string | null;
}

const defaultSettings: AppSettings = {
  defaultMode: 'smart',
  defaultTimeRange: '24h',
  showEmptyColumns: false,
  autoSave: true,
  theme: 'dark'
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

interface AppProviderProps {
  children: React.ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [apiClient] = useState(() => new APIClient());
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const savedSettings = localStorage.getItem('aidx-settings');
      return savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  useEffect(() => {
    // Initialize session
    const initSession = async () => {
      try {
        const response = await apiClient.startSession(settings);
        setSessionId(response.sessionId);
      } catch (error) {
        console.error('Failed to start session:', error);
      }
    };
    
    initSession();
  }, [apiClient, settings]);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    
    try {
      localStorage.setItem('aidx-settings', JSON.stringify(updatedSettings));
      
      // Update session settings if we have an active session
      if (sessionId) {
        apiClient.updateSession(updatedSettings).catch(error => {
          console.warn('Failed to update session settings:', error);
        });
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  return (
    <AppContext.Provider value={{
      apiClient,
      settings,
      updateSettings,
      sessionId
    }}>
      {children}
    </AppContext.Provider>
  );
};