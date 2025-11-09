import { useState, useEffect, useCallback, useRef } from 'react';

export interface ChromecastDevice {
  id: string;
  name: string;
  friendlyName?: string;
}

export interface ChromecastState {
  isConnected: boolean;
  isConnecting: boolean;
  device: ChromecastDevice | null;
  session: any;
  mediaSession: any;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  currentMedia: {
    url: string;
    title: string;
    contentType: string;
  } | null;
}

interface UseChromecastOptions {
  onStateChange?: (state: ChromecastState) => void;
  onError?: (error: Error) => void;
}

export const useChromecast = (options: UseChromecastOptions = {}) => {
  const [state, setState] = useState<ChromecastState>({
    isConnected: false,
    isConnecting: false,
    device: null,
    session: null,
    mediaSession: null,
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    volume: 100,
    isMuted: false,
    currentMedia: null,
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  // Update state and notify listeners
  const updateState = useCallback((updates: Partial<ChromecastState>) => {
    setState((prev) => {
      const newState = { ...prev, ...updates };
      stateRef.current = newState;
      options.onStateChange?.(newState);
      return newState;
    });
  }, [options]);

  // Get Cast Context
  const getCastContext = useCallback(() => {
    return (window as any).cast?.framework?.CastContext?.getInstance();
  }, []);

  // Discover available Chromecast devices
  const discoverDevices = useCallback(async (): Promise<ChromecastDevice[]> => {
    const ctx = getCastContext();
    if (!ctx) {
      return [];
    }

    try {
      const devices: ChromecastDevice[] = [];
      
      // Check Cast state - if devices are available, we can show them
      const castState = ctx.getCastState();
      const CastState = (window as any).cast?.framework?.CastState;
      
      if (!CastState) {
        return [];
      }

      // If devices are available, we'll use the CastButton to show them
      // But we can't enumerate them directly without user interaction
      // So we'll return a generic entry that will trigger the CastButton
      if (castState !== CastState.NO_DEVICES_AVAILABLE) {
        // Check if there's an active session with a device
        const session = ctx.getCurrentSession();
        if (session && typeof session.getReceiver === 'function') {
          try {
            const receiver = session.getReceiver();
            if (receiver) {
              devices.push({
                id: receiver.friendlyName || 'chromecast-connected',
                name: receiver.friendlyName || 'Chromecast',
                friendlyName: receiver.friendlyName,
              });
            }
          } catch (e) {
            console.log('Error getting receiver from session:', e);
          }
        } else {
          // Devices are available but not connected
          devices.push({
            id: 'chromecast-available',
            name: 'Chromecast / Google Cast',
          });
        }
      }

      return devices;
    } catch (error) {
      console.error('Error discovering Chromecast devices:', error);
      return [];
    }
  }, [getCastContext]);

  // Connect to Chromecast (shows device picker)
  const connect = useCallback(async (): Promise<boolean> => {
    const ctx = getCastContext();
    if (!ctx) {
      options.onError?.(new Error('Chromecast לא זמין'));
      return false;
    }

    try {
      updateState({ isConnecting: true });

      ctx.setOptions({
        receiverApplicationId: (window as any).chrome?.cast?.media?.DEFAULT_MEDIA_RECEIVER_APP_ID,
        // Enable discovery of all Cast-enabled devices including Smart TVs
        autoJoinPolicy: (window as any).chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
      });

      // Request session - this will show device picker with all available devices
      // This includes Chromecast devices, Smart TVs, and other Cast-enabled devices
      const session = await ctx.requestSession();
      
      if (!session) {
        updateState({ isConnecting: false });
        return false;
      }

      // Get device info
      let device: ChromecastDevice = {
        id: 'Chromecast',
        name: 'Chromecast',
      };
      
      if (typeof session.getReceiver === 'function') {
        try {
          const receiver = session.getReceiver();
          if (receiver) {
            device = {
              id: receiver.friendlyName || 'Chromecast',
              name: receiver.friendlyName || 'Chromecast',
              friendlyName: receiver.friendlyName,
            };
          }
        } catch (e) {
          console.log('Error getting receiver from session:', e);
        }
      }

      // Set up session listeners
      const onSessionStateChanged = (e: any) => {
        if (e.sessionState === (window as any).cast.framework.SessionState.SESSION_ENDED) {
          updateState({
            isConnected: false,
            isConnecting: false,
            device: null,
            session: null,
            mediaSession: null,
            currentMedia: null,
          });
        } else if (e.sessionState === (window as any).cast.framework.SessionState.SESSION_STARTED) {
          updateState({
            isConnected: true,
            isConnecting: false,
            device,
            session,
          });
        }
      };

      const onSessionError = (e: any) => {
        console.error('Chromecast session error:', e);
        options.onError?.(new Error(e.error?.message || 'שגיאה בחיבור Chromecast'));
        updateState({
          isConnected: false,
          isConnecting: false,
        });
      };

      ctx.addEventListener(
        (window as any).cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
        onSessionStateChanged
      );
      ctx.addEventListener(
        (window as any).cast.framework.CastContextEventType.SESSION_ERROR,
        onSessionError
      );

      // Get media session if exists
      const mediaSession = session.getMediaSession();
      if (mediaSession) {
        setMediaListeners(mediaSession);
      }

      updateState({
        isConnected: true,
        isConnecting: false,
        device,
        session,
        mediaSession,
      });

      return true;
    } catch (error: any) {
      console.error('Error connecting to Chromecast:', error);
      updateState({ isConnecting: false });
      
      if (error.code === 'cancel') {
        // User cancelled - don't show error
        return false;
      }
      
      options.onError?.(new Error(error.message || 'לא ניתן להתחבר ל-Chromecast'));
      return false;
    }
  }, [getCastContext, updateState, options]);

  // Disconnect from Chromecast
  const disconnect = useCallback(async () => {
    const ctx = getCastContext();
    if (!ctx) return;

    try {
      const session = ctx.getCurrentSession();
      if (session) {
        await session.endSession(true);
      }

      updateState({
        isConnected: false,
        device: null,
        session: null,
        mediaSession: null,
        currentMedia: null,
      });
    } catch (error) {
      console.error('Error disconnecting from Chromecast:', error);
    }
  }, [getCastContext, updateState]);

  // Set up media session listeners
  const setMediaListeners = useCallback((mediaSession: any) => {
    if (!mediaSession) return;

    const onMediaUpdate = () => {
      const playerState = mediaSession.playerState;
      // Get current time from media session
      const currentTime = mediaSession.getEstimatedTime ? mediaSession.getEstimatedTime() : (mediaSession.currentTime || 0);
      const media = mediaSession.media;
      
      updateState({
        mediaSession,
        isPlaying: playerState === (window as any).chrome.cast.media.PlayerState.PLAYING,
        currentTime,
        duration: media?.duration || 0,
        volume: mediaSession.volume?.level !== undefined ? mediaSession.volume.level * 100 : stateRef.current.volume,
        isMuted: mediaSession.volume?.muted || false,
      });
    };

    mediaSession.addUpdateListener(onMediaUpdate);
    mediaSession.addStatusListener(onMediaUpdate);
  }, [updateState]);

  // Load media to Chromecast
  const loadMedia = useCallback(async (
    url: string,
    title: string,
    contentType: string = 'audio/mpeg'
  ): Promise<boolean> => {
    const ctx = getCastContext();
    if (!ctx) {
      options.onError?.(new Error('Chromecast לא זמין'));
      return false;
    }

    let session = ctx.getCurrentSession();
    
    // If not connected, connect first
    if (!session) {
      const connected = await connect();
      if (!connected) {
        return false;
      }
      session = ctx.getCurrentSession();
    }

    if (!session) {
      options.onError?.(new Error('לא מחובר ל-Chromecast'));
      return false;
    }

    try {
      // Get token for Netlify functions
      const accessToken = sessionStorage.getItem('gd_access_token');
      const finalUrl = accessToken && url.includes('netlify') 
        ? `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(accessToken)}`
        : url;

      const mediaInfo = new (window as any).chrome.cast.media.MediaInfo(finalUrl, contentType);
      mediaInfo.metadata = new (window as any).chrome.cast.media.MusicTrackMediaMetadata();
      mediaInfo.metadata.title = title;
      mediaInfo.streamType = (window as any).chrome.cast.media.StreamType.BUFFERED;

      const request = new (window as any).chrome.cast.media.LoadRequest(mediaInfo);
      request.autoplay = true;
      request.currentTime = 0;

      const mediaSession = await session.loadMedia(request);
      
      if (mediaSession) {
        setMediaListeners(mediaSession);
        updateState({
          mediaSession,
          currentMedia: { url, title, contentType },
          isPlaying: true,
        });
      }

      return true;
    } catch (error: any) {
      console.error('Error loading media to Chromecast:', error);
      options.onError?.(new Error(error.message || 'לא ניתן לשדר ל-Chromecast'));
      return false;
    }
  }, [getCastContext, connect, setMediaListeners, updateState, options]);

  // Control playback
  const play = useCallback(async () => {
    const mediaSession = stateRef.current.mediaSession;
    if (!mediaSession) return false;

    try {
      await mediaSession.play();
      updateState({ isPlaying: true });
      return true;
    } catch (error) {
      console.error('Error playing:', error);
      return false;
    }
  }, [updateState]);

  const pause = useCallback(async () => {
    const mediaSession = stateRef.current.mediaSession;
    if (!mediaSession) return false;

    try {
      await mediaSession.pause();
      updateState({ isPlaying: false });
      return true;
    } catch (error) {
      console.error('Error pausing:', error);
      return false;
    }
  }, [updateState]);

  const stop = useCallback(async () => {
    const mediaSession = stateRef.current.mediaSession;
    if (!mediaSession) return false;

    try {
      await mediaSession.stop();
      updateState({ isPlaying: false, currentTime: 0 });
      return true;
    } catch (error) {
      console.error('Error stopping:', error);
      return false;
    }
  }, [updateState]);

  const seek = useCallback(async (time: number) => {
    const mediaSession = stateRef.current.mediaSession;
    if (!mediaSession) return false;

    try {
      const seekRequest = new (window as any).chrome.cast.media.SeekRequest();
      seekRequest.currentTime = time;
      await mediaSession.seek(seekRequest);
      updateState({ currentTime: time });
      return true;
    } catch (error) {
      console.error('Error seeking:', error);
      return false;
    }
  }, [updateState]);

  const setVolume = useCallback(async (volume: number) => {
    const session = stateRef.current.session;
    if (!session) return false;

    try {
      const vol = new (window as any).chrome.cast.Volume();
      vol.level = Math.max(0, Math.min(1, volume / 100));
      await session.setVolume(vol);
      updateState({ volume });
      return true;
    } catch (error) {
      console.error('Error setting volume:', error);
      return false;
    }
  }, [updateState]);

  const setMuted = useCallback(async (muted: boolean) => {
    const session = stateRef.current.session;
    if (!session) return false;

    try {
      const vol = new (window as any).chrome.cast.Volume();
      vol.muted = muted;
      await session.setVolume(vol);
      updateState({ isMuted: muted });
      return true;
    } catch (error) {
      console.error('Error setting muted:', error);
      return false;
    }
  }, [updateState]);

  // Monitor session state
  useEffect(() => {
    const ctx = getCastContext();
    if (!ctx) return;

    // Check for existing session
    const checkExistingSession = () => {
      const session = ctx.getCurrentSession();
      if (session && !stateRef.current.isConnected) {
        let device: ChromecastDevice = {
          id: 'Chromecast',
          name: 'Chromecast',
        };
        
        if (typeof session.getReceiver === 'function') {
          try {
            const receiver = session.getReceiver();
            if (receiver) {
              device = {
                id: receiver.friendlyName || 'Chromecast',
                name: receiver.friendlyName || 'Chromecast',
                friendlyName: receiver.friendlyName,
              };
            }
          } catch (e) {
            console.log('Error getting receiver from session:', e);
          }
        }

        const mediaSession = session.getMediaSession();
        if (mediaSession) {
          setMediaListeners(mediaSession);
        }

        updateState({
          isConnected: true,
          device,
          session,
          mediaSession,
        });
      }
    };

    // Initial check
    checkExistingSession();

    // Listen for session state changes
    const onSessionStateChanged = (e: any) => {
      if (e.sessionState === (window as any).cast.framework.SessionState.SESSION_ENDED) {
        updateState({
          isConnected: false,
          device: null,
          session: null,
          mediaSession: null,
          currentMedia: null,
        });
      } else if (e.sessionState === (window as any).cast.framework.SessionState.SESSION_STARTED) {
        checkExistingSession();
      }
    };

    ctx.addEventListener(
      (window as any).cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
      onSessionStateChanged
    );

    // Poll for media updates
    const interval = setInterval(() => {
      const mediaSession = stateRef.current.mediaSession;
      if (mediaSession) {
        const currentTime = mediaSession.getEstimatedTime ? mediaSession.getEstimatedTime() : (mediaSession.currentTime || 0);
        if (Math.abs(currentTime - stateRef.current.currentTime) > 0.5) {
          updateState({ currentTime });
        }
      }
    }, 500);

    return () => {
      ctx.removeEventListener(
        (window as any).cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
        onSessionStateChanged
      );
      clearInterval(interval);
    };
  }, [getCastContext, setMediaListeners, updateState]);

  return {
    state,
    discoverDevices,
    connect,
    disconnect,
    loadMedia,
    play,
    pause,
    stop,
    seek,
    setVolume,
    setMuted,
  };
};

