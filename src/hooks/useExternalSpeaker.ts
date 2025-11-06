import { useRef, useEffect, useMemo } from 'react';

interface ExternalSpeakerState {
  type: 'Chromecast' | 'AirPlay' | 'DLNA' | 'Sonos' | 'Bluetooth' | 'Browser' | null;
  session: any; // Cast session or other session object
  mediaSession: any; // Media session for Chromecast
  isConnected: boolean;
}

// Global state for external speaker
let externalSpeakerState: ExternalSpeakerState = {
  type: null,
  session: null,
  mediaSession: null,
  isConnected: false,
};

// Listeners for state changes
const listeners: Set<() => void> = new Set();

export const useExternalSpeaker = (selectedSpeaker: string | null, speakers: any[]) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = document.querySelector('audio') as HTMLAudioElement;
  }, []);

  // Get speaker info
  const getSpeakerInfo = () => {
    if (!selectedSpeaker) return null;
    return speakers.find((s: any) => s.id === selectedSpeaker);
  };

  // Check if external speaker is active (reactive)
  const isExternalSpeakerActive = useMemo(() => {
    const speaker = getSpeakerInfo();
    return speaker && speaker.type !== 'Browser';
  }, [selectedSpeaker, speakers]);

  // Get current external speaker state
  const getExternalSpeakerState = () => {
    return externalSpeakerState;
  };

  // Set external speaker state
  const setExternalSpeakerState = (state: Partial<ExternalSpeakerState>) => {
    externalSpeakerState = { ...externalSpeakerState, ...state };
    listeners.forEach(listener => listener());
  };

  // Control external speaker
  const controlExternalSpeaker = async (action: 'play' | 'pause' | 'stop' | 'seek' | 'volume', value?: any) => {
    const speaker = getSpeakerInfo();
    if (!speaker || speaker.type === 'Browser') {
      return false; // Not an external speaker
    }

    try {
      switch (speaker.type) {
        case 'Chromecast':
          return await controlChromecast(action, value);
        case 'AirPlay':
          return await controlAirPlay(action, value);
        case 'DLNA':
          return await controlDLNA(speaker, action, value);
        case 'Sonos':
          return await controlSonos(speaker, action, value);
        case 'Bluetooth':
          return await controlBluetooth(action, value);
        default:
          return false;
      }
    } catch (error) {
      console.error('Error controlling external speaker:', error);
      return false;
    }
  };

  // Chromecast control
  const controlChromecast = async (action: string, value?: any) => {
    const ctx = (window as any).cast?.framework?.CastContext?.getInstance();
    if (!ctx) return false;

    const session = ctx.getCurrentSession();
    if (!session) return false;

    const media = session.getMediaSession();
    if (!media) return false;

    switch (action) {
      case 'play':
        media.play();
        return true;
      case 'pause':
        media.pause();
        return true;
      case 'stop':
        media.stop();
        return true;
      case 'seek':
        if (typeof value === 'number') {
          const seekRequest = new (window as any).chrome.cast.media.SeekRequest();
          seekRequest.currentTime = value;
          media.seek(seekRequest);
          return true;
        }
        return false;
      case 'volume':
        if (typeof value === 'number') {
          const volume = new (window as any).chrome.cast.Volume();
          volume.level = value / 100; // Convert 0-100 to 0-1
          session.setVolume(volume);
          return true;
        }
        return false;
      default:
        return false;
    }
  };

  // AirPlay control
  const controlAirPlay = async (action: string, value?: any) => {
    const audio = audioRef.current || document.querySelector('audio') as HTMLAudioElement;
    if (!audio) return false;

    // AirPlay control is limited - we can only show the picker
    // The actual control is handled by the OS
    switch (action) {
      case 'play':
        audio.play();
        return true;
      case 'pause':
        audio.pause();
        return true;
      case 'stop':
        audio.pause();
        audio.currentTime = 0;
        return true;
      case 'seek':
        if (typeof value === 'number') {
          audio.currentTime = value;
          return true;
        }
        return false;
      case 'volume':
        if (typeof value === 'number') {
          audio.volume = value / 100;
          return true;
        }
        return false;
      default:
        return false;
    }
  };

  // DLNA control
  const controlDLNA = async (speaker: any, action: string, value?: any) => {
    // DLNA control requires backend service
    // This is a placeholder for future implementation
    return false;
  };

  // Sonos control
  const controlSonos = async (speaker: any, action: string, value?: any) => {
    // Sonos control requires backend service
    // This is a placeholder for future implementation
    return false;
  };

  // Bluetooth control
  const controlBluetooth = async (action: string, value?: any) => {
    const audio = audioRef.current || document.querySelector('audio') as HTMLAudioElement;
    if (!audio) return false;

    // Bluetooth audio is controlled through the audio element
    // The OS handles the routing
    switch (action) {
      case 'play':
        audio.play();
        return true;
      case 'pause':
        audio.pause();
        return true;
      case 'stop':
        audio.pause();
        audio.currentTime = 0;
        return true;
      case 'seek':
        if (typeof value === 'number') {
          audio.currentTime = value;
          return true;
        }
        return false;
      case 'volume':
        if (typeof value === 'number') {
          audio.volume = value / 100;
          return true;
        }
        return false;
      default:
        return false;
    }
  };

  // Stop local audio when external speaker is active
  const stopLocalAudio = () => {
    const audio = audioRef.current || document.querySelector('audio') as HTMLAudioElement;
    if (audio && isExternalSpeakerActive()) {
      audio.pause();
      audio.currentTime = 0;
    }
  };

  // Monitor Chromecast session
  useEffect(() => {
    const speaker = getSpeakerInfo();
    if (speaker?.type === 'Chromecast') {
      const ctx = (window as any).cast?.framework?.CastContext?.getInstance();
      if (ctx) {
        const session = ctx.getCurrentSession();
        if (session) {
          setExternalSpeakerState({
            type: 'Chromecast',
            session,
            mediaSession: session.getMediaSession(),
            isConnected: true,
          });

          // Listen to session updates
          const media = session.getMediaSession();
          if (media) {
            const updateMediaState = () => {
              setExternalSpeakerState({
                type: 'Chromecast',
                session,
                mediaSession: media,
                isConnected: true,
              });
            };

            media.addUpdateListener(updateMediaState);
            media.addStatusListener(updateMediaState);

            return () => {
              media.removeUpdateListener(updateMediaState);
              media.removeStatusListener(updateMediaState);
            };
          }
        }
      }
    } else if (speaker?.type !== 'Browser') {
      setExternalSpeakerState({
        type: speaker?.type || null,
        session: null,
        mediaSession: null,
        isConnected: true,
      });
    } else {
      setExternalSpeakerState({
        type: null,
        session: null,
        mediaSession: null,
        isConnected: false,
      });
    }
  }, [selectedSpeaker, speakers]);

  return {
    isExternalSpeakerActive,
    controlExternalSpeaker,
    stopLocalAudio,
    getExternalSpeakerState,
  };
};

