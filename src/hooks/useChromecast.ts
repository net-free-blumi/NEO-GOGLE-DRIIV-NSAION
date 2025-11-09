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

      // Check if already connected
      const existingSession = ctx.getCurrentSession();
      if (existingSession) {
        // Already connected, just update state
        const receiver = typeof existingSession.getReceiver === 'function' ? existingSession.getReceiver() : null;
        const device: ChromecastDevice = receiver ? {
          id: receiver.friendlyName || 'Chromecast',
          name: receiver.friendlyName || 'Chromecast',
          friendlyName: receiver.friendlyName,
        } : {
          id: 'Chromecast',
          name: 'Chromecast',
        };
        
        updateState({
          isConnected: true,
          isConnecting: false,
          device,
          session: existingSession,
          mediaSession: existingSession.getMediaSession(),
        });
        return true;
      }

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

      // Get device info - try multiple methods to get the device name
      let device: ChromecastDevice = {
        id: 'Chromecast',
        name: 'Chromecast',
      };
      
      // Method 1: Try session.getReceiver()
      if (typeof session.getReceiver === 'function') {
        try {
          const receiver = session.getReceiver();
          if (receiver && receiver.friendlyName) {
            device = {
              id: receiver.friendlyName || 'Chromecast',
              name: receiver.friendlyName || 'Chromecast',
              friendlyName: receiver.friendlyName,
            };
          }
        } catch (e) {
          console.log('⚠️ Error getting receiver from session:', e);
        }
      }
      
      // Method 2: Try session.getCastDevice() (this is what we saw in the logs!)
      if (typeof session.getCastDevice === 'function') {
        try {
          const castDevice = session.getCastDevice();
          if (castDevice && castDevice.friendlyName) {
            device = {
              id: castDevice.friendlyName || device.id,
              name: castDevice.friendlyName || device.name,
              friendlyName: castDevice.friendlyName,
            };
          }
        } catch (e) {
          console.log('⚠️ Error getting castDevice from session:', e);
        }
      }
      
      // Method 3: Try accessing receiver directly from session
      if ((session as any).receiver && (session as any).receiver.friendlyName) {
        const receiver = (session as any).receiver;
        device = {
          id: receiver.friendlyName || device.id,
          name: receiver.friendlyName || device.name,
          friendlyName: receiver.friendlyName,
        };
      }
      
      // Method 4: Try accessing castDevice directly from session
      if ((session as any).castDevice && (session as any).castDevice.friendlyName) {
        const castDevice = (session as any).castDevice;
        device = {
          id: castDevice.friendlyName || device.id,
          name: castDevice.friendlyName || device.name,
          friendlyName: castDevice.friendlyName,
        };
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
      
      if (error.code === 'cancel' || error.code === 'session_error') {
        // User cancelled or session error - don't show error, just return false
        // session_error usually means user cancelled or device unavailable
        return false;
      }
      
      // Only show error for other types of errors
      if (error.code !== 'session_error') {
        options.onError?.(new Error(error.message || 'לא ניתן להתחבר ל-Chromecast'));
      }
      return false;
    }
  }, [getCastContext, updateState, options]);

  // Disconnect from Chromecast
  const disconnect = useCallback(async () => {
    const ctx = getCastContext();
    if (!ctx) {
      // Even if context is not available, clear state
      updateState({
        isConnected: false,
        device: null,
        session: null,
        mediaSession: null,
        currentMedia: null,
      });
      return;
    }

    try {
      const session = ctx.getCurrentSession();
      if (session) {
        try {
          // Stop media first if playing
          const mediaSession = session.getMediaSession();
          if (mediaSession && typeof mediaSession.stop === 'function') {
            try {
              await mediaSession.stop();
            } catch (e) {
              console.log('Error stopping media:', e);
            }
          }
          
          // End session
          await session.endSession(true);
        } catch (sessionError) {
          console.log('Error ending session:', sessionError);
          // Continue to clear state even if endSession fails
        }
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
      // Clear state even if there's an error
      updateState({
        isConnected: false,
        device: null,
        session: null,
        mediaSession: null,
        currentMedia: null,
      });
    }
  }, [getCastContext, updateState]);

  // Set up media session listeners
  const setMediaListeners = useCallback((mediaSession: any) => {
    if (!mediaSession) return;

    const onMediaUpdate = () => {
      try {
        const ctx = getCastContext();
        const session = ctx?.getCurrentSession();
        
        // Get volume from session (session volume controls the device volume)
        let volume = stateRef.current.volume;
        let isMuted = stateRef.current.isMuted;
        
        if (session) {
          try {
            const receiver = typeof session.getReceiver === 'function' ? session.getReceiver() : null;
            if (receiver && receiver.volume) {
              volume = receiver.volume.level !== undefined ? receiver.volume.level * 100 : volume;
              isMuted = receiver.volume.muted !== undefined ? receiver.volume.muted : isMuted;
            }
          } catch (e) {
            console.log('Error getting receiver volume:', e);
          }
        }
        
        const playerState = mediaSession.playerState;
        // Get current time from media session
        const currentTime = mediaSession.getEstimatedTime ? mediaSession.getEstimatedTime() : (mediaSession.currentTime || 0);
        const media = mediaSession.media;
        
        updateState({
          mediaSession,
          isPlaying: playerState === (window as any).chrome.cast.media.PlayerState.PLAYING,
          currentTime,
          duration: media?.duration || 0,
          volume,
          isMuted,
        });
      } catch (e) {
        console.log('Error in media update listener:', e);
      }
    };

    // Add listeners only if they exist
    if (typeof mediaSession.addUpdateListener === 'function') {
      try {
        mediaSession.addUpdateListener(onMediaUpdate);
      } catch (e) {
        console.log('Error adding update listener:', e);
      }
    }
    
    if (typeof mediaSession.addStatusListener === 'function') {
      try {
        mediaSession.addStatusListener(onMediaUpdate);
      } catch (e) {
        console.log('Error adding status listener:', e);
      }
    }
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
      } else {
        // If no media session returned, try to get it from session
        const existingMediaSession = session.getMediaSession();
        if (existingMediaSession) {
          setMediaListeners(existingMediaSession);
          updateState({
            mediaSession: existingMediaSession,
            currentMedia: { url, title, contentType },
            isPlaying: true,
          });
        }
      }

      return true;
    } catch (error: any) {
      console.error('Error loading media to Chromecast:', error);
      
      // Handle specific error codes
      if (error.code === 'session_error' || error.code === 'timeout') {
        // Session might have ended, try to reconnect
        const ctx = getCastContext();
        const currentSession = ctx?.getCurrentSession();
        if (!currentSession) {
          options.onError?.(new Error('החיבור נותק. נסה להתחבר שוב.'));
          updateState({
            isConnected: false,
            session: null,
            mediaSession: null,
          });
          return false;
        }
      }
      
      options.onError?.(new Error(error.message || 'לא ניתן לשדר ל-Chromecast'));
      return false;
    }
  }, [getCastContext, connect, setMediaListeners, updateState, options]);

  // Control playback
  const play = useCallback(async () => {
    const mediaSession = stateRef.current.mediaSession;
    if (!mediaSession) {
      // Try to get media session from current session
      const ctx = getCastContext();
      const session = ctx?.getCurrentSession();
      if (session) {
        const ms = session.getMediaSession();
        if (ms && typeof ms.play === 'function') {
          try {
            await ms.play();
            setMediaListeners(ms);
            updateState({ mediaSession: ms, isPlaying: true });
            return true;
          } catch (e) {
            console.error('Error playing:', e);
            return false;
          }
        }
      }
      return false;
    }

    try {
      if (typeof mediaSession.play === 'function') {
        await mediaSession.play();
        updateState({ isPlaying: true });
        return true;
      } else {
        console.error('play() is not a function on mediaSession');
        return false;
      }
    } catch (error) {
      console.error('Error playing:', error);
      return false;
    }
  }, [updateState, getCastContext, setMediaListeners]);

  const pause = useCallback(async () => {
    const mediaSession = stateRef.current.mediaSession;
    if (!mediaSession) {
      // Try to get media session from current session
      const ctx = getCastContext();
      const session = ctx?.getCurrentSession();
      if (session) {
        const ms = session.getMediaSession();
        if (ms && typeof ms.pause === 'function') {
          try {
            await ms.pause();
            setMediaListeners(ms);
            updateState({ mediaSession: ms, isPlaying: false });
            return true;
          } catch (e) {
            console.error('Error pausing:', e);
            return false;
          }
        }
      }
      return false;
    }

    try {
      if (typeof mediaSession.pause === 'function') {
        await mediaSession.pause();
        updateState({ isPlaying: false });
        return true;
      } else {
        console.error('pause() is not a function on mediaSession');
        return false;
      }
    } catch (error) {
      console.error('Error pausing:', error);
      return false;
    }
  }, [updateState, getCastContext, setMediaListeners]);

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
    if (!mediaSession) {
      // Try to get media session from current session
      const ctx = getCastContext();
      const session = ctx?.getCurrentSession();
      if (session) {
        const ms = session.getMediaSession();
        if (ms && typeof ms.seek === 'function') {
          try {
            const seekRequest = new (window as any).chrome.cast.media.SeekRequest();
            seekRequest.currentTime = time;
            await ms.seek(seekRequest);
            setMediaListeners(ms);
            updateState({ mediaSession: ms, currentTime: time });
            return true;
          } catch (e) {
            console.error('Error seeking:', e);
            return false;
          }
        }
      }
      return false;
    }

    try {
      if (typeof mediaSession.seek === 'function') {
        const seekRequest = new (window as any).chrome.cast.media.SeekRequest();
        seekRequest.currentTime = time;
        await mediaSession.seek(seekRequest);
        updateState({ currentTime: time });
        return true;
      } else {
        console.error('seek() is not a function on mediaSession');
        return false;
      }
    } catch (error) {
      console.error('Error seeking:', error);
      return false;
    }
  }, [updateState, getCastContext, setMediaListeners]);

  const setVolume = useCallback(async (volume: number): Promise<boolean> => {
    const ctx = getCastContext();
    if (!ctx) {
      console.log('❌ No CastContext available for volume control');
      return false;
    }
    
    const session = ctx.getCurrentSession() || stateRef.current.session;
    if (!session) {
      console.log('❌ No session available for volume control');
      return false;
    }

    // Try to get receiver - CRITICAL for volume control!
    let receiver = null;
    let castDevice = null;
    
    // Method 1: Try session.getReceiver()
    if (typeof session.getReceiver === 'function') {
      try {
        receiver = session.getReceiver();
      } catch (e) {
        // Silent fail
      }
    }
    
    // Method 2: Try session.getCastDevice()
    if (typeof session.getCastDevice === 'function') {
      try {
        castDevice = session.getCastDevice();
        // Use castDevice as receiver if receiver is null
        if (!receiver && castDevice) {
          receiver = castDevice;
        }
      } catch (e) {
        // Silent fail
      }
    }
    
    // Method 3: Try accessing receiver directly from session
    if (!receiver && (session as any).receiver) {
      receiver = (session as any).receiver;
    }
    
    if (!receiver) {
      console.error('❌ CRITICAL: No receiver found! Volume control will NOT work without receiver!');
      return false;
    }

    const volLevel = Math.max(0, Math.min(1, volume / 100));

    try {
      // Method 1: Try receiver.setVolumeLevel if receiver is available (Cast SDK v3+)
      // This is the PREFERRED method - it works better than session.setVolume
      if (receiver) {
        // Try receiver.setVolumeLevel (if available)
        if (typeof receiver.setVolumeLevel === 'function') {
          console.log('📤 Using receiver.setVolumeLevel (PREFERRED METHOD)');
          return new Promise((resolve) => {
            const timeout = setTimeout(() => {
              console.error('❌ receiver.setVolumeLevel timeout after 5s');
              resolve(false);
            }, 5000);
            
            try {
              receiver.setVolumeLevel(
                volLevel,
                () => {
                  clearTimeout(timeout);
                  console.log('✅ Volume set successfully via receiver.setVolumeLevel:', volume);
                  updateState({ volume, session });
                  resolve(true);
                },
                (error: any) => {
                  clearTimeout(timeout);
                  console.error('❌ Error setting volume via receiver.setVolumeLevel:', error);
                  resolve(false);
                }
              );
            } catch (e) {
              clearTimeout(timeout);
              console.error('❌ Exception calling receiver.setVolumeLevel:', e);
              resolve(false);
            }
          });
        }
        
        // Try using receiver.volume.setLevel if available
        if (receiver.volume && typeof receiver.volume.setLevel === 'function') {
          console.log('📤 Using receiver.volume.setLevel');
          return new Promise((resolve) => {
            const timeout = setTimeout(() => {
              console.error('❌ receiver.volume.setLevel timeout after 5s');
              resolve(false);
            }, 5000);
            
            try {
              receiver.volume.setLevel(
                volLevel,
                () => {
                  clearTimeout(timeout);
                  console.log('✅ Volume set successfully via receiver.volume.setLevel:', volume);
                  updateState({ volume, session });
                  resolve(true);
                },
                (error: any) => {
                  clearTimeout(timeout);
                  console.error('❌ Error setting volume via receiver.volume.setLevel:', error);
                  resolve(false);
                }
              );
            } catch (e) {
              clearTimeout(timeout);
              console.error('❌ Exception calling receiver.volume.setLevel:', e);
              resolve(false);
            }
          });
        }
        
        // Try receiver.volume.level assignment - this doesn't work, but let's try it anyway
        // NOTE: receiver.volume.level is read-only and won't actually change the Chromecast volume!
        if (receiver.volume) {
          console.log('⚠️ WARNING: receiver.volume.level assignment does NOT work - it is read-only!');
          console.log('📤 Trying session.setVolume directly (receiver.volume is read-only)');
          
          // Create volume object and try session.setVolume
          const vol = new (window as any).chrome.cast.Volume();
          vol.level = volLevel;
          vol.muted = stateRef.current.isMuted;
          
          return new Promise((resolve) => {
            const timeout = setTimeout(() => {
              console.error('❌ session.setVolume timeout after 10s - callbacks never fired!');
              console.error('🔍 This means the volume command was NOT sent to Chromecast!');
              console.error('🔍 The Chromecast SDK may not support volume control in this session state.');
              resolve(false);
            }, 10000);
            
            try {
              session.setVolume(
                vol,
                () => {
                  clearTimeout(timeout);
                  console.log('✅ Volume set successfully via session.setVolume:', volume);
                  updateState({ volume, session });
                  resolve(true);
                },
                (error: any) => {
                  clearTimeout(timeout);
                  console.error('❌ Error setting volume via session.setVolume:', error);
                  console.error('Error details:', {
                    code: error?.code,
                    description: error?.description,
                    error: error
                  });
                  resolve(false);
                }
              );
            } catch (e) {
              clearTimeout(timeout);
              console.error('❌ Exception calling session.setVolume:', e);
              resolve(false);
            }
          });
        }
      }
      
      // Method 2: Try using CastReceiverVolumeRequest (newer API)
      if ((window as any).chrome?.cast?.receiver?.CastReceiverVolumeRequest) {
        console.log('📤 Trying CastReceiverVolumeRequest');
        try {
          const volumeRequest = new (window as any).chrome.cast.receiver.CastReceiverVolumeRequest();
          volumeRequest.volume = new (window as any).chrome.cast.Volume();
          volumeRequest.volume.level = volLevel;
          volumeRequest.volume.muted = stateRef.current.isMuted;
          
          return new Promise((resolve) => {
            const timeout = setTimeout(() => {
              console.error('❌ CastReceiverVolumeRequest timeout');
              resolve(false);
            }, 5000);
            
            session.setReceiverVolumeLevel(volumeRequest,
              () => {
                clearTimeout(timeout);
                console.log('✅ Volume set via CastReceiverVolumeRequest:', volume);
                updateState({ volume, session });
                resolve(true);
              },
              (error: any) => {
                clearTimeout(timeout);
                console.error('❌ CastReceiverVolumeRequest failed:', error);
                resolve(false);
              }
            );
          });
        } catch (e) {
          console.log('⚠️ CastReceiverVolumeRequest not available:', e);
        }
      }
      
      // Method 3: session.setVolume (standard method - try fire-and-forget first, like useExternalSpeaker.ts)
      // This is how other apps do it - fire-and-forget without callbacks
      if (typeof session.setVolume === 'function') {
        const vol = new (window as any).chrome.cast.Volume();
        vol.level = volLevel;
        vol.muted = stateRef.current.isMuted;
        
        try {
          // Try fire-and-forget first (like useExternalSpeaker.ts does)
          // This is how YouTube Music, Spotify, etc. do it
          session.setVolume(vol);
          updateState({ volume, session });
          return true;
        } catch (e) {
          console.error('❌ Exception calling setVolume (fire-and-forget):', e);
          // If fire-and-forget fails, try with callbacks as fallback
          return new Promise((resolve) => {
            let resolved = false;
            const timeout = setTimeout(() => {
              if (!resolved) {
                console.error('❌ setVolume callbacks never fired - timeout after 5s');
                resolved = true;
                resolve(false);
              }
            }, 5000);
            
            try {
              session.setVolume(
                vol,
                () => {
                  if (!resolved) {
                    clearTimeout(timeout);
                    console.log('✅ Volume set successfully (callbacks fired):', volume);
                    updateState({ volume, session });
                    resolved = true;
                    resolve(true);
                  }
                },
                (error: any) => {
                  if (!resolved) {
                    clearTimeout(timeout);
                    console.error('❌ Error setting volume (callbacks fired with error):', error);
                    resolved = true;
                    resolve(false);
                  }
                }
              );
            } catch (e2) {
              clearTimeout(timeout);
              console.error('❌ Exception calling setVolume with callbacks:', e2);
              if (!resolved) {
                resolved = true;
                resolve(false);
              }
            }
          });
        }
      }
      
      // Method 3: Try setting receiver.volume directly if receiver is available (last resort)
      if (receiver && receiver.volume) {
        console.log('🔄 Trying direct receiver.volume assignment');
        try {
          receiver.volume.level = volLevel;
          receiver.volume.muted = stateRef.current.isMuted;
          // Try to trigger update by calling setVolume
          if (typeof session.setVolume === 'function') {
            const vol = new (window as any).chrome.cast.Volume();
            vol.level = receiver.volume.level;
            vol.muted = receiver.volume.muted;
            session.setVolume(vol,
              () => {
                console.log('✅ Volume set via direct assignment:', volume);
                updateState({ volume, session });
              },
              (error: any) => {
                console.error('❌ Direct assignment failed:', error);
              }
            );
          }
          updateState({ volume, session });
          return true;
        } catch (e) {
          console.error('❌ Direct assignment failed:', e);
        }
      }
      
      console.error('❌ No volume control method available');
      return false;
    } catch (error) {
      console.error('❌ Exception in setVolume:', error);
      return false;
    }
  }, [updateState, getCastContext]);

  const setMuted = useCallback(async (muted: boolean): Promise<boolean> => {
    const ctx = getCastContext();
    if (!ctx) {
      console.log('❌ No CastContext available for mute control');
      return false;
    }
    
    const session = ctx.getCurrentSession() || stateRef.current.session;
    if (!session) {
      console.log('❌ No session available for mute control');
      return false;
    }

    console.log('🔇 Setting muted to:', muted);

    try {
      // Method 1: session.setVolume (standard method) - this is the correct way
      if (typeof session.setVolume === 'function') {
        const vol = new (window as any).chrome.cast.Volume();
        vol.level = stateRef.current.volume / 100; // Preserve volume level
        vol.muted = muted;
        
        console.log('📤 Calling session.setVolume for mute with:', { level: vol.level, muted: vol.muted });
        
        // Use setVolume with callbacks - this is the correct API
        return new Promise((resolve) => {
          try {
            session.setVolume(vol,
              () => {
                // Success callback
                console.log('✅ Mute set successfully:', muted);
                updateState({ isMuted: muted, session });
                resolve(true);
              },
              (error: any) => {
                // Error callback
                console.error('❌ Error setting mute:', error);
                console.error('Error details:', {
                  code: error?.code,
                  description: error?.description,
                  error: error
                });
                
                // Try alternative method - retry with new volume object
                try {
                  console.log('🔄 Retrying mute set...');
                  const vol2 = new (window as any).chrome.cast.Volume();
                  vol2.level = stateRef.current.volume / 100;
                  vol2.muted = muted;
                  
                  session.setVolume(vol2,
                    () => {
                      console.log('✅ Mute set successfully (retry):', muted);
                      updateState({ isMuted: muted, session });
                      resolve(true);
                    },
                    (error2: any) => {
                      console.error('❌ Mute set failed (retry):', error2);
                      resolve(false);
                    }
                  );
                } catch (e) {
                  console.error('❌ Retry also failed:', e);
                  resolve(false);
                }
              }
            );
          } catch (e) {
            console.error('❌ Exception calling setVolume for mute:', e);
            resolve(false);
          }
        });
      }
      
      // Method 2: Try using receiver directly (fallback)
      if (typeof session.getReceiver === 'function') {
        try {
          const receiver = session.getReceiver();
          if (receiver) {
            console.log('🔄 Trying receiver mute method');
            const vol = new (window as any).chrome.cast.Volume();
            vol.level = stateRef.current.volume / 100;
            vol.muted = muted;
            
            // Try to set mute using receiver
            if (receiver.volume) {
              receiver.volume.muted = muted;
              receiver.volume.level = vol.level;
            }
            
            // Then use session.setVolume to actually apply it
            return new Promise((resolve) => {
              session.setVolume(vol,
                () => {
                  console.log('✅ Mute set via receiver method:', muted);
                  updateState({ isMuted: muted, session });
                  resolve(true);
                },
                (error: any) => {
                  console.error('❌ Receiver mute method failed:', error);
                  resolve(false);
                }
              );
            });
          }
        } catch (e) {
          console.error('❌ Error using receiver mute:', e);
        }
      }
      
      console.error('❌ No mute control method available');
      return false;
    } catch (error) {
      console.error('❌ Exception in setMuted:', error);
      return false;
    }
  }, [updateState, getCastContext]);

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
        
        // Method 1: Try getCastDevice() (this is what we saw in the logs!)
        if (typeof session.getCastDevice === 'function') {
          try {
            const castDevice = session.getCastDevice();
            if (castDevice && castDevice.friendlyName) {
              device = {
                id: castDevice.friendlyName || 'Chromecast',
                name: castDevice.friendlyName || 'Chromecast',
                friendlyName: castDevice.friendlyName,
              };
            }
          } catch (e) {
            console.log('⚠️ Error getting castDevice from session:', e);
          }
        }
        
        // Method 2: Try getReceiver()
        if (device.name === 'Chromecast' && typeof session.getReceiver === 'function') {
          try {
            const receiver = session.getReceiver();
            if (receiver && receiver.friendlyName) {
              device = {
                id: receiver.friendlyName || 'Chromecast',
                name: receiver.friendlyName || 'Chromecast',
                friendlyName: receiver.friendlyName,
              };
            }
          } catch (e) {
            console.log('⚠️ Error getting receiver from session:', e);
          }
        }
        
        // Method 3: Try session.receiver
        if (device.name === 'Chromecast' && (session as any).receiver && (session as any).receiver.friendlyName) {
          device = {
            id: (session as any).receiver.friendlyName || 'Chromecast',
            name: (session as any).receiver.friendlyName || 'Chromecast',
            friendlyName: (session as any).receiver.friendlyName,
          };
        }
        
        // Method 4: Try session.castDevice
        if (device.name === 'Chromecast' && (session as any).castDevice && (session as any).castDevice.friendlyName) {
          device = {
            id: (session as any).castDevice.friendlyName || 'Chromecast',
            name: (session as any).castDevice.friendlyName || 'Chromecast',
            friendlyName: (session as any).castDevice.friendlyName,
          };
        }

        const mediaSession = session.getMediaSession();
        if (mediaSession) {
          setMediaListeners(mediaSession);
        }

        // Get initial volume from receiver
        let initialVolume = stateRef.current.volume;
        let initialMuted = stateRef.current.isMuted;
        try {
          if (typeof session.getReceiver === 'function') {
            const receiver = session.getReceiver();
            if (receiver && receiver.volume) {
              initialVolume = receiver.volume.level !== undefined ? receiver.volume.level * 100 : initialVolume;
              initialMuted = receiver.volume.muted !== undefined ? receiver.volume.muted : initialMuted;
            }
          }
        } catch (e) {
          console.log('Error getting initial receiver volume:', e);
        }

        updateState({
          isConnected: true,
          device,
          session,
          mediaSession,
          volume: initialVolume,
          isMuted: initialMuted,
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

    // Poll for media updates - slower interval to prevent violations
    const interval = setInterval(() => {
      try {
        const ctx = getCastContext();
        const session = ctx?.getCurrentSession();
        if (!session) {
          // No session - clear state if still marked as connected
          if (stateRef.current.isConnected) {
            updateState({
              isConnected: false,
              device: null,
              session: null,
              mediaSession: null,
              currentMedia: null,
            });
          }
          return;
        }

        // Update device name from receiver/castDevice if available
        try {
          let deviceName = null;
          
          // Method 1: Try getCastDevice() (this is what we saw in the logs!)
          if (typeof session.getCastDevice === 'function') {
            try {
              const castDevice = session.getCastDevice();
              if (castDevice && castDevice.friendlyName) {
                deviceName = castDevice.friendlyName;
              }
            } catch (e) {
              console.log('⚠️ Error getting castDevice:', e);
            }
          }
          
          // Method 2: Try getReceiver()
          if (!deviceName && typeof session.getReceiver === 'function') {
            try {
              const receiver = session.getReceiver();
              if (receiver && receiver.friendlyName) {
                deviceName = receiver.friendlyName;
              }
            } catch (e) {
              console.log('⚠️ Error getting receiver:', e);
            }
          }
          
          // Method 3: Try session.receiver
          if (!deviceName && (session as any).receiver && (session as any).receiver.friendlyName) {
            deviceName = (session as any).receiver.friendlyName;
          }
          
          // Method 4: Try session.castDevice
          if (!deviceName && (session as any).castDevice && (session as any).castDevice.friendlyName) {
            deviceName = (session as any).castDevice.friendlyName;
          }
          
          // Update state if we found a device name
          if (deviceName) {
            const currentDeviceName = stateRef.current.device?.name || stateRef.current.device?.friendlyName || '';
            if (deviceName !== currentDeviceName) {
              updateState({
                device: {
                  id: deviceName,
                  name: deviceName,
                  friendlyName: deviceName,
                }
              });
            }
          }
        } catch (e) {
          console.log('Error updating device name:', e);
        }
        
        // Get media session from current session
        const mediaSession = session.getMediaSession() || stateRef.current.mediaSession;
        if (mediaSession) {
          // Update media session in state if changed
          if (mediaSession !== stateRef.current.mediaSession) {
            setMediaListeners(mediaSession);
            updateState({ mediaSession });
          }
          
          // Update current time
          const currentTime = mediaSession.getEstimatedTime ? mediaSession.getEstimatedTime() : (mediaSession.currentTime || 0);
          if (Math.abs(currentTime - stateRef.current.currentTime) > 0.5) {
            updateState({ currentTime });
          }
          
          // Update playing state
          const playerState = mediaSession.playerState;
          const PlayerState = (window as any).chrome?.cast?.media?.PlayerState;
          if (PlayerState) {
            const isPlaying = playerState === PlayerState.PLAYING;
            if (isPlaying !== stateRef.current.isPlaying) {
              updateState({ isPlaying });
            }
          }
        }
      } catch (error) {
        console.error('Error in media update poll:', error);
      }
    }, 1000); // Slower polling to prevent violations

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

