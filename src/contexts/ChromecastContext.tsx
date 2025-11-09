import React, { createContext, useContext, ReactNode } from 'react';
import { useChromecast, ChromecastState, ChromecastDevice } from '@/hooks/useChromecast';

interface ChromecastContextType {
  state: ChromecastState;
  discoverDevices: () => Promise<ChromecastDevice[]>;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  loadMedia: (url: string, title: string, contentType?: string) => Promise<boolean>;
  play: () => Promise<boolean>;
  pause: () => Promise<boolean>;
  stop: () => Promise<boolean>;
  seek: (time: number) => Promise<boolean>;
  setVolume: (volume: number) => Promise<boolean>;
  setMuted: (muted: boolean) => Promise<boolean>;
}

const ChromecastContext = createContext<ChromecastContextType | undefined>(undefined);

export const useChromecastContext = () => {
  const context = useContext(ChromecastContext);
  if (!context) {
    throw new Error('useChromecastContext must be used within ChromecastProvider');
  }
  return context;
};

interface ChromecastProviderProps {
  children: ReactNode;
}

export const ChromecastProvider: React.FC<ChromecastProviderProps> = ({ children }) => {
  const chromecast = useChromecast({
    onStateChange: (state) => {
      // Store state in sessionStorage for persistence
      sessionStorage.setItem('chromecast_state', JSON.stringify({
        isConnected: state.isConnected,
        device: state.device,
        currentMedia: state.currentMedia,
      }));
    },
    onError: (error) => {
      console.error('Chromecast error:', error);
    },
  });

  return (
    <ChromecastContext.Provider value={chromecast}>
      {children}
    </ChromecastContext.Provider>
  );
};

