import { useEffect, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Loader2, Square, X, Maximize2, Cast } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Song } from "@/pages/Index";
import { useExternalSpeaker } from "@/hooks/useExternalSpeaker";
import { useChromecastContext } from "@/contexts/ChromecastContext";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface MusicPlayerProps {
  song: Song;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onStop?: () => void;
  selectedSpeaker: string | null;
  repeatMode?: 'none' | 'one' | 'all';
  onRepeatModeChange?: (mode: 'none' | 'one' | 'all') => void;
}

const MusicPlayer = ({
  song,
  isPlaying,
  onPlayPause,
  onNext,
  onPrevious,
  onStop,
  selectedSpeaker,
  repeatMode = 'none',
  onRepeatModeChange,
}: MusicPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Toast for notifications
  const { toast } = useToast();
  
  // Get speakers list from sessionStorage
  const [speakers] = useState(() => {
    try {
      const stored = sessionStorage.getItem('available_speakers');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  
  // Use external speaker hook (for non-Chromecast speakers)
  const { isExternalSpeakerActive, controlExternalSpeaker, stopLocalAudio } = useExternalSpeaker(
    selectedSpeaker,
    speakers
  );

  // Use Chromecast context
  const chromecast = useChromecastContext();
  
  // Check if Chromecast is the selected speaker
  const selectedSpeakerData = speakers.find((s: any) => s.id === selectedSpeaker);
  const isChromecastActive = selectedSpeakerData?.type === 'Chromecast' && chromecast.state.isConnected;

  // Load song to Chromecast if connected
  // Use ref to prevent multiple loads of the same song
  const lastLoadedSongRef = useRef<string | null>(null);
  useEffect(() => {
    if (isChromecastActive && song.url) {
      // Only load if it's a different song
      if (lastLoadedSongRef.current !== song.id) {
        lastLoadedSongRef.current = song.id;
        chromecast.loadMedia(song.url, song.name || song.title || 'Track', 'audio/mpeg').catch(() => {
          // Silent fail - error handling is in useChromecast
        });
      }
    }
  }, [song.id, song.url, isChromecastActive, chromecast]);

  // Track if user is manually changing volume to prevent sync loop
  const isVolumeChangingRef = useRef(false);
  const volumeChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUserVolumeRef = useRef<number | null>(null);
  const lastUserMuteRef = useRef<boolean | null>(null);
  const volumeChangeTimeRef = useRef<number>(0);

  // Sync Chromecast state with local state (except volume/mute which user controls)
  useEffect(() => {
    if (isChromecastActive) {
      // Update current time from Chromecast - sync more frequently
      setCurrentTime(chromecast.state.currentTime);
      
      // Update duration from Chromecast
      if (chromecast.state.duration > 0) {
        setDuration(chromecast.state.duration);
      }
      
      // DON'T sync isPlaying here - it's handled in Index.tsx to avoid loops
      // DON'T sync volume/mute from Chromecast - user controls it directly
      // Volume and mute are ONE-WAY: user -> Chromecast, NOT Chromecast -> user
    }
  }, [isChromecastActive, chromecast.state.currentTime, chromecast.state.duration]);
  
  // Sync volume/mute ONLY on initial connection (one time)
  const hasSyncedVolumeRef = useRef(false);
  useEffect(() => {
    if (isChromecastActive && chromecast.state.isConnected && !hasSyncedVolumeRef.current) {
      // Only sync once when first connected
      hasSyncedVolumeRef.current = true;
      // Set initial volume/mute from Chromecast
      if (chromecast.state.volume > 0) {
        setVolume(chromecast.state.volume);
      }
      if (chromecast.state.isMuted !== undefined) {
        setIsMuted(chromecast.state.isMuted);
      }
    } else if (!isChromecastActive || !chromecast.state.isConnected) {
      // Reset flag when disconnected
      hasSyncedVolumeRef.current = false;
    }
  }, [isChromecastActive, chromecast.state.isConnected]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (volumeChangeTimeoutRef.current) {
        clearTimeout(volumeChangeTimeoutRef.current);
      }
    };
  }, []);

  // Load song and set up audio element with optimized streaming
  useEffect(() => {
    if (!audioRef.current || !song.url) return;
    
    // Skip local audio setup if Chromecast is active
    if (isChromecastActive) {
      // Stop local audio when Chromecast is active
      const audio = audioRef.current;
      if (!audio.paused) {
        audio.pause();
      }
      return;
    }

    const audio = audioRef.current;
    
    // Helper function to refresh token if needed
    const refreshTokenIfNeeded = async (): Promise<string | null> => {
      let accessToken = sessionStorage.getItem('gd_access_token');
      const expiresAt = sessionStorage.getItem('gd_token_expires_at');
      
      // Check if token is expired - if so, try to refresh it
      if (accessToken && expiresAt && parseInt(expiresAt) <= Date.now()) {
        // Token expired, try to refresh using Google Token Client
        console.log('Token expired, attempting to refresh...');
        const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
        if (GOOGLE_CLIENT_ID && (window as any).google?.accounts?.oauth2) {
          // Use a promise to wait for token refresh
          try {
            await new Promise<void>((resolve, reject) => {
              const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: 'https://www.googleapis.com/auth/drive.readonly',
                prompt: '', // Use cached consent
                callback: (resp: any) => {
                  if (resp.access_token) {
                    const expiresIn = resp.expires_in || 3600;
                    const newExpiresAt = Date.now() + (expiresIn - 60) * 1000;
                    sessionStorage.setItem('gd_access_token', resp.access_token);
                    sessionStorage.setItem('gd_token_expires_at', newExpiresAt.toString());
                    accessToken = resp.access_token;
                    console.log('Token refreshed successfully');
                    resolve();
                  } else if (resp.error) {
                    console.error('Token refresh error:', resp.error);
                    // Show toast notification for disconnection
                    if (resp.error === 'popup_blocked' || resp.error === 'popup_closed_by_user') {
                      toast({
                        title: 'התנתקות מ-Google Drive',
                        description: 'לא הצלחנו לרענן את החיבור. נא להתחבר מחדש.',
                        variant: 'destructive',
                        duration: 5000,
                      });
                    } else {
                      toast({
                        title: 'התנתקות מ-Google Drive',
                        description: 'החיבור ל-Google Drive פג. נא להתחבר מחדש.',
                        variant: 'destructive',
                        duration: 5000,
                      });
                    }
                    // Clear invalid token
                    sessionStorage.removeItem('gd_access_token');
                    sessionStorage.removeItem('gd_token_expires_at');
                    sessionStorage.removeItem('gd_is_authenticated');
                    accessToken = null;
                    reject(new Error(resp.error));
                  } else {
                    resolve();
                  }
                },
              });
              tokenClient.requestAccessToken({ prompt: '' });
            });
          } catch (error) {
            console.error('Token refresh failed:', error);
            toast({
              title: 'התנתקות מ-Google Drive',
              description: 'החיבור ל-Google Drive פג. נא להתחבר מחדש.',
              variant: 'destructive',
              duration: 5000,
            });
            accessToken = null;
          }
        } else {
          console.warn('Cannot refresh token: Google OAuth not available');
          toast({
            title: 'התנתקות מ-Google Drive',
            description: 'לא ניתן לרענן את החיבור. נא להתחבר מחדש.',
            variant: 'destructive',
            duration: 5000,
          });
          accessToken = null;
        }
      }
      
      return accessToken;
    };
    // Only set loading if it's a new song (not resuming) AND we're playing
    // Don't set loading when pausing/stopping
    const savedPosition = sessionStorage.getItem(`song_position_${song.id}`);
    const isNewSong = !savedPosition && audio.readyState === 0; // New song = no saved position AND audio not loaded yet
    
    if (isNewSong && isPlaying) {
      // Only show loading when starting a new song that's actually playing
    setIsLoading(true);
    setIsBuffering(false);
    setDuration(0);
      // Don't reset currentTime here - let it be restored from savedPosition if exists
    } else if (!isPlaying) {
      // When pausing/stopping, don't show loading
      setIsLoading(false);
    }
    
    // Build URL with token if needed
    // Only set src if it's a new song or if audio hasn't loaded yet
    // Don't reset src when pausing/resuming the same song (this causes position to reset)
    const isNewSongOrNotLoaded = !audio.src || audio.readyState === 0 || !audio.src.includes(song.url.split('?')[0]);
    
    if (isNewSongOrNotLoaded) {
      const isNetlify = song.url.includes('.netlify.app') || song.url.includes('netlify/functions');
      
      // Refresh token if needed and build URL
      refreshTokenIfNeeded().then((accessToken) => {
        if (!accessToken) {
          // Token refresh failed - stop loading
          setIsLoading(false);
          setIsBuffering(false);
          return;
        }
        
        let finalUrl = song.url;
        if (isNetlify && accessToken) {
          // Check if URL already has query parameters
          const separator = song.url.includes('?') ? '&' : '?';
          finalUrl = `${song.url}${separator}token=${encodeURIComponent(accessToken)}`;
        } else if (!isNetlify && accessToken && !song.url.includes('token=')) {
          // For non-Netlify URLs, also add token if not present
          const separator = song.url.includes('?') ? '&' : '?';
          finalUrl = `${song.url}${separator}token=${encodeURIComponent(accessToken)}`;
        }
        
        // Only set src if it's different from current src (avoid resetting position)
        const currentSrcBase = audio.src ? audio.src.split('?')[0] : '';
        const newSrcBase = finalUrl.split('?')[0];
        if (currentSrcBase !== newSrcBase) {
          // Optimize audio element for streaming
          audio.preload = 'none'; // Don't preload - stream on demand
          audio.src = finalUrl;
        }
      }).catch((error) => {
        console.error('Error refreshing token:', error);
        setIsLoading(false);
        setIsBuffering(false);
      });
    }
    
    // Restore saved position if exists (for resume after pause)
    // Don't reset position if audio is already loaded and paused (normal pause, not new song)
    if (savedPosition) {
      const position = parseFloat(savedPosition);
      if (!isNaN(position) && position > 0) {
        // Wait for metadata to load before setting position
        if (audio.duration > 0 && position < audio.duration) {
          audio.currentTime = position;
          setCurrentTime(position);
        } else {
          // If metadata not loaded yet, set position after it loads
          const handleMetadataLoad = () => {
            if (audio.duration > 0 && position < audio.duration) {
              audio.currentTime = position;
              setCurrentTime(position);
            }
            audio.removeEventListener('loadedmetadata', handleMetadataLoad);
          };
          audio.addEventListener('loadedmetadata', handleMetadataLoad);
        }
      }
    } else if (isNewSong && isPlaying && audio.readyState === 0 && !savedPosition) {
      // Only reset to 0 if it's a new song AND we're playing AND audio hasn't loaded yet AND no saved position
      // Don't reset if audio is already loaded (normal pause/resume) or if there's a saved position
    audio.currentTime = 0;
      setCurrentTime(0);
    }
    // If audio is already loaded and paused, keep current position (don't reset)
    
    // Set up streaming optimization
    audio.setAttribute('preload', 'none');
    
    // Add error handler for audio loading errors
    const handleAudioError = (e: any) => {
      console.error('Audio loading error:', e);
      setIsLoading(false);
      setIsBuffering(false);
      
      // Check if it's an authentication error (401/403)
      const target = e.target as HTMLAudioElement;
      if (target.error) {
        const errorCode = target.error.code;
        if (errorCode === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED || errorCode === MediaError.MEDIA_ERR_NETWORK) {
          toast({
            title: 'שגיאה בטעינת השיר',
            description: 'לא הצלחנו לטעון את השיר. נא לבדוק את החיבור ל-Google Drive.',
            variant: 'destructive',
            duration: 5000,
          });
        }
      }
    };
    
    audio.addEventListener('error', handleAudioError);
    
    // Only load when user wants to play AND it's a new song (not resuming)
    // Don't call load() when resuming - it resets the position to 0!
    if (isPlaying && isNewSongOrNotLoaded) {
      audio.load();
    }
    
    return () => {
      audio.removeEventListener('error', handleAudioError);
    };
  }, [song.id, song.url, isPlaying, toast]);

  // Stop local audio when external speaker is active
  useEffect(() => {
    if ((isExternalSpeakerActive || isChromecastActive) && audioRef.current) {
      const audio = audioRef.current;
      if (!audio.paused) {
        audio.pause();
      }
    }
  }, [isExternalSpeakerActive, isChromecastActive, selectedSpeaker]);

  // Handle play/pause with better buffering
  useEffect(() => {
    if (!audioRef.current) return;
    
    const audio = audioRef.current;
    
    // If Chromecast is active, control it instead of local audio
    if (isChromecastActive) {
      if (isPlaying) {
        chromecast.play();
      } else {
        chromecast.pause();
      }
      return; // Don't control local audio when Chromecast is active
    }
    
    // If external speaker is active, control it instead of local audio
    if (isExternalSpeakerActive) {
      if (isPlaying) {
        controlExternalSpeaker('play');
      } else {
        controlExternalSpeaker('pause');
      }
      return; // Don't control local audio when external speaker is active
    }
    
    // Save position before any state changes
    const saveCurrentPosition = () => {
      if (audio.readyState > 0 && !audio.paused) {
        // Save position while playing (before pause)
        const position = audio.currentTime || currentTime || 0;
        if (position > 0) {
          sessionStorage.setItem(`song_position_${song.id}`, position.toString());
        }
      }
    };
    
    if (isPlaying) {
      // Restore saved position if exists (for resume after pause)
      const savedPosition = sessionStorage.getItem(`song_position_${song.id}`);
      
      // Ensure audio is loaded before playing
      // But don't call load() if we're resuming - it resets position to 0!
      if (!audio.src || audio.readyState === 0) {
        // Only load if there's no saved position (new song)
        if (!savedPosition) {
          audio.load();
        }
      }
      if (savedPosition) {
        const position = parseFloat(savedPosition);
        if (!isNaN(position) && position > 0) {
          // If audio is already loaded, set position immediately
          if (audio.duration > 0 && position < audio.duration) {
            audio.currentTime = position;
            setCurrentTime(position);
          } else if (audio.readyState > 0) {
            // Wait for metadata to load
            const handleMetadataLoad = () => {
              if (audio.duration > 0 && position < audio.duration) {
                audio.currentTime = position;
                setCurrentTime(position);
              }
              audio.removeEventListener('loadedmetadata', handleMetadataLoad);
            };
            audio.addEventListener('loadedmetadata', handleMetadataLoad);
          }
        }
      }
      
      // If audio is already loaded and paused, try to play immediately (resume)
      if (audio.readyState >= 2 && audio.paused) {
        // Audio is already loaded - restore position FIRST, then play
        if (savedPosition) {
          const position = parseFloat(savedPosition);
          if (!isNaN(position) && position > 0) {
            console.log(`Resuming from saved position: ${position} seconds`);
            // Set position immediately if duration is available
            if (audio.duration > 0 && position < audio.duration) {
              // Set position multiple times to ensure it sticks
              audio.currentTime = position;
              setCurrentTime(position);
              // Verify position was set
              setTimeout(() => {
                if (Math.abs(audio.currentTime - position) > 1) {
                  // Position wasn't set correctly, try again
                  console.log(`Position not set correctly, retrying. Current: ${audio.currentTime}, Target: ${position}`);
                  audio.currentTime = position;
                  setCurrentTime(position);
                }
                // Use a longer delay to ensure position is set before playing
                setTimeout(() => {
                  console.log(`Playing from position: ${audio.currentTime}`);
                  audio.play().then(() => {
                    setIsLoading(false);
                  }).catch(err => {
                    console.error('Play error:', err);
                    setIsLoading(false);
                  });
                }, 100);
              }, 50);
              return; // Don't continue
            } else {
              // Wait for duration to load, then set position and play
              const handleDurationLoad = () => {
                if (audio.duration > 0 && position < audio.duration) {
                  audio.currentTime = position;
                  setCurrentTime(position);
                  // Delay to ensure position is set before playing
                  setTimeout(() => {
                    audio.play().then(() => {
                      setIsLoading(false);
                    }).catch(err => {
                      console.error('Play error:', err);
                      setIsLoading(false);
                    });
                  }, 200);
                }
                audio.removeEventListener('loadedmetadata', handleDurationLoad);
                audio.removeEventListener('durationchange', handleDurationLoad);
              };
              audio.addEventListener('loadedmetadata', handleDurationLoad);
              audio.addEventListener('durationchange', handleDurationLoad);
              return; // Don't continue
            }
          }
        }
        
        // No saved position, just play from current position
        audio.play().then(() => {
          setIsLoading(false);
        }).catch(err => {
          console.error('Play error:', err);
          setIsLoading(false);
        });
        return; // Don't continue with tryPlay logic
      }
      
      // Wait for enough data before playing to prevent stuttering
      const tryPlay = async () => {
        // Wait for at least some data to be buffered
        // For better streaming, we want HAVE_FUTURE_DATA (readyState >= 3)
        if (audio.readyState >= 3) { // HAVE_FUTURE_DATA - best for streaming
          try {
            await audio.play();
            setIsLoading(false);
          } catch (err) {
            console.error('Play error:', err);
            setIsLoading(false);
          }
        } else if (audio.readyState >= 2) { // HAVE_CURRENT_DATA - acceptable
          try {
            await audio.play();
            setIsLoading(false);
          } catch (err) {
            console.error('Play error:', err);
            setIsLoading(false);
          }
        } else {
          // Wait a bit and try again, but limit retries
          const maxRetries = 50; // 5 seconds max wait
          let retries = 0;
          const checkAndPlay = () => {
            if (audio.readyState >= 3) { // Prefer HAVE_FUTURE_DATA
              audio.play().catch(err => {
                console.error('Play error:', err);
                setIsLoading(false);
              });
            } else if (audio.readyState >= 2) { // Accept HAVE_CURRENT_DATA
              audio.play().catch(err => {
        console.error('Play error:', err);
        setIsLoading(false);
      });
            } else if (retries < maxRetries) {
              retries++;
              setTimeout(checkAndPlay, 100);
            } else {
              // Force play even if not ready (browser will buffer)
              audio.play().catch(err => {
                console.error('Play error after retries:', err);
                setIsLoading(false);
              });
            }
          };
          checkAndPlay();
        }
      };
      
      tryPlay();
    } else {
      // When pausing, save current position IMMEDIATELY before pausing
      // This ensures we capture the exact position where the user paused
      // IMPORTANT: Always read the position from BOTH audio.currentTime AND state
      // Use the most recent value - state is updated via handleTimeUpdate in real-time
      if (audio.readyState > 0) {
        // Read from both sources to get the most accurate value
        const audioPosition = audio.currentTime || 0;
        const statePosition = currentTime || 0;
        
        // Use the LARGER value - this is the most recent position
        // When pausing multiple times, we want the latest position, not the first one
        let position = 0;
        if (audioPosition > 0 && statePosition > 0) {
          // Use the larger value (more recent)
          position = Math.max(audioPosition, statePosition);
        } else if (audioPosition > 0) {
          position = audioPosition;
        } else if (statePosition > 0) {
          position = statePosition;
        }
        
        // CRITICAL: Always save the position, even if it seems the same
        // This ensures we always have the latest position when pausing multiple times
        // The position will be different each time the user pauses
        if (position >= 0) {
          sessionStorage.setItem(`song_position_${song.id}`, position.toString());
          console.log(`Saved position for pause: ${position} seconds (audio: ${audioPosition}, state: ${statePosition}, using: ${position})`);
        }
      }
      
      // Don't set isLoading to true when pausing - allow user to resume
      setIsLoading(false); // Make sure loading is false when pausing
      audio.pause();
    }
  }, [isPlaying, song.id]);

  // Handle stop - reset position when saved position is cleared
  useEffect(() => {
    if (!audioRef.current) return;
    
    const audio = audioRef.current;
    const savedPosition = sessionStorage.getItem(`song_position_${song.id}`);
    
    // If saved position was cleared (stop was called) and audio is paused, reset to 0
    if (savedPosition === null && !isPlaying && audio.readyState > 0) {
      audio.currentTime = 0;
      setCurrentTime(0);
      setIsLoading(false); // Make sure loading is false when stopping
    }
  }, [isPlaying, song.id]);

  // Update duration when metadata loads
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      const duration = audio.duration || 0;
      setDuration(duration);
      setIsLoading(false);
      
      // Save duration to sessionStorage for display in song list
      if (duration > 0 && song.id) {
        const durations = JSON.parse(sessionStorage.getItem('song_durations') || '{}');
        durations[song.id] = duration;
        sessionStorage.setItem('song_durations', JSON.stringify(durations));
      }
    };

    const handleCanPlay = () => {
      setIsLoading(false);
      setIsBuffering(false);
    };

    const handleCanPlayThrough = () => {
      // Enough data buffered to play through
      setIsBuffering(false);
      setIsLoading(false);
    };

    const handleWaiting = () => {
      setIsBuffering(true);
    };

    const handlePlaying = () => {
      setIsBuffering(false);
      setIsLoading(false);
    };

    const handleProgress = () => {
      // Update buffering state based on readyState and buffered amount
      const buffered = audio.buffered;
      const currentTime = audio.currentTime;
      const duration = audio.duration || 0;
      
      // Check if we have enough buffered data ahead
      // For long songs (over 1 hour), we need more buffer
      let requiredBuffer = 3; // Default 3 seconds
      if (duration > 3600) { // Over 1 hour
        requiredBuffer = 10; // Need 10 seconds for long songs
      } else if (duration > 1800) { // Over 30 minutes
        requiredBuffer = 5; // Need 5 seconds for medium songs
      }
      
      let hasEnoughBuffer = false;
      if (buffered.length > 0) {
        const bufferedEnd = buffered.end(buffered.length - 1);
        // Need at least requiredBuffer seconds of buffer ahead
        hasEnoughBuffer = bufferedEnd - currentTime > requiredBuffer;
      }
      
      if (audio.readyState >= 3 && hasEnoughBuffer) { // HAVE_FUTURE_DATA and enough buffer
        setIsBuffering(false);
      } else if (audio.readyState < 2 || !hasEnoughBuffer) {
        setIsBuffering(true);
      }
    };

    const handleError = (e: any) => {
      console.error('Audio error:', e);
      setIsLoading(false);
      setIsBuffering(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('canplaythrough', handleCanPlayThrough);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('progress', handleProgress);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('canplaythrough', handleCanPlayThrough);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('progress', handleProgress);
      audio.removeEventListener('error', handleError);
    };
  }, [song.url]);

  // Handle song end
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      if (repeatMode === 'one') {
        // Repeat current song
        audio.currentTime = 0;
        audio.play();
      } else if (repeatMode === 'all') {
        // Continue to next song
        onNext();
      } else {
        // Default: continue to next
        onNext();
      }
    };

    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('ended', handleEnded);
    };
  }, [repeatMode, onNext]);

  // Debounce volume changes to avoid too many calls
  const volumeDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // If Chromecast is active, send volume command to it
    if (isChromecastActive) {
      // Skip if this is the initial sync (already handled by separate effect)
      if (hasSyncedVolumeRef.current && volumeChangeTimeRef.current === 0) {
        // This is initial sync, don't send command
        volumeChangeTimeRef.current = Date.now();
        return;
      }
      
      // Clear any existing debounce timeout
      if (volumeDebounceRef.current) {
        clearTimeout(volumeDebounceRef.current);
      }
      
      // Debounce volume changes - wait 100ms before sending
      volumeDebounceRef.current = setTimeout(() => {
        // Mark that we're changing volume to prevent any sync
        isVolumeChangingRef.current = true;
        lastUserVolumeRef.current = volume;
        volumeChangeTimeRef.current = Date.now();
        
        // Send volume command to Chromecast
        chromecast.setVolume(volume).catch(() => {
          // Silent fail
        });
      }, 100);
      
      return;
    }
    
    // If external speaker is active, send volume command to it
    if (isExternalSpeakerActive) {
      controlExternalSpeaker('volume', volume);
      return;
    }
    
    // Otherwise, control local audio
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume, isExternalSpeakerActive, isChromecastActive]);

  useEffect(() => {
    // If Chromecast is active, send mute command to it
    if (isChromecastActive) {
      // Skip if this is the initial sync (already handled by separate effect)
      if (hasSyncedVolumeRef.current && volumeChangeTimeRef.current === 0) {
        // This is initial sync, don't send command
        return;
      }
      
      // Mark that we're changing mute to prevent any sync
      isVolumeChangingRef.current = true;
      lastUserMuteRef.current = isMuted;
      volumeChangeTimeRef.current = Date.now();
      
      // Clear any existing timeout
      if (volumeChangeTimeoutRef.current) {
        clearTimeout(volumeChangeTimeoutRef.current);
      }
      
      // Send mute command to Chromecast
      chromecast.setMuted(isMuted).catch((e) => {
        console.log('Error setting mute:', e);
      });
      
      // Keep flag true - we don't want to sync mute back from Chromecast
      // Mute is one-way: user -> Chromecast
      
      return;
    }
    
    // Otherwise, control local audio
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted, isChromecastActive]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleSeek = (value: number[]) => {
    const seekTime = value[0];
    
    // If Chromecast is active, send seek command to it
    if (isChromecastActive) {
      // Update optimistically for better UX
      setCurrentTime(seekTime);
      // Send seek command - don't wait for it to complete
      chromecast.seek(seekTime).catch(() => {
        // Silent fail - error handling is in useChromecast
      });
      return;
    }
    
    // If external speaker is active, send seek command to it
    if (isExternalSpeakerActive) {
      controlExternalSpeaker('seek', seekTime);
      setCurrentTime(seekTime);
      return;
    }
    
    // Otherwise, control local audio
    if (audioRef.current && duration > 0) {
      audioRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleRepeatModeClick = () => {
    if (!onRepeatModeChange) return;
    const modes: ('none' | 'one' | 'all')[] = ['none', 'one', 'all'];
    const currentIndex = modes.indexOf(repeatMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    onRepeatModeChange(modes[nextIndex]);
  };

  return (
    <>
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        crossOrigin="anonymous"
        preload="none"
      />

      <div className="fixed bottom-0 left-0 right-0 bg-[hsl(var(--player-bg))] border-t border-border backdrop-blur-xl z-50">
        <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-4">
          {/* Progress Bar */}
          <div className="mb-2 sm:mb-4">
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={1}
              onValueChange={handleSeek}
              className="w-full cursor-pointer touch-manipulation"
              disabled={duration === 0 || isLoading}
            />
            <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration || song.duration)}</span>
            </div>
            {(isLoading || isBuffering) && (
              <div className="flex items-center justify-center gap-2 mt-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">
                  {isLoading ? 'טוען...' : 'מוריד...'}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
            {/* Song Info */}
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              <div 
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0 shadow-lg cursor-pointer hover:scale-105 transition-transform touch-manipulation"
                onClick={() => setIsFullscreen(true)}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  setIsFullscreen(true);
                }}
                title="פתח במסך מלא"
              >
                {song.coverUrl ? (
                  <img
                    src={song.coverUrl}
                    alt={song.title}
                    className="w-full h-full rounded-lg object-cover"
                  />
                ) : (
                  <span className="text-lg sm:text-xl md:text-2xl">🎵</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-xs sm:text-sm md:text-base text-foreground truncate">
                  {song.title}
                </h3>
                <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground truncate">
                  {song.artist}
                </p>
                {selectedSpeaker && (
                  <p className="text-[9px] sm:text-[10px] md:text-xs text-primary flex items-center gap-1 mt-0.5">
                    <span className="w-1 h-1 rounded-full bg-primary animate-pulse flex-shrink-0" />
                    <span className="truncate">
                      {isChromecastActive && chromecast.state.device 
                        ? (chromecast.state.device.name || chromecast.state.device.friendlyName || 'Chromecast')
                        : selectedSpeaker}
                    </span>
                  </p>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-1 sm:gap-2 flex-shrink-0">
              {onRepeatModeChange && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRepeatModeClick}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    handleRepeatModeClick();
                  }}
                  className="w-9 h-9 sm:w-10 sm:h-10 hover:bg-secondary/80 active:scale-95 transition-all touch-manipulation"
                  title={
                    repeatMode === 'none' ? 'לא חוזר' :
                    repeatMode === 'one' ? 'חוזר על שיר אחד' :
                    'חוזר על כל השירים'
                  }
                >
                  {repeatMode === 'none' && (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  {repeatMode === 'one' && (
                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      <text x="12" y="16" textAnchor="middle" fontSize="8" fill="currentColor">1</text>
                    </svg>
                  )}
                  {repeatMode === 'all' && (
                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={onPrevious}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  onPrevious();
                }}
                className="w-10 h-10 sm:w-10 sm:h-10 md:w-12 md:h-12 hover:bg-secondary/80 active:scale-95 transition-all touch-manipulation"
              >
                <SkipBack className="w-5 h-5" />
              </Button>
              <Button
                variant="default"
                size="icon"
                onClick={onPlayPause}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  onPlayPause();
                }}
                className="w-16 h-16 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-primary to-accent hover:scale-105 active:scale-90 transition-all shadow-[var(--shadow-player)] touch-manipulation"
                disabled={isLoading && !isPlaying}
              >
                {(isLoading && !isPlaying) ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-6 h-6" fill="currentColor" />
                ) : (
                  <Play className="w-6 h-6" fill="currentColor" />
                )}
              </Button>
              {onStop && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onStop}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    onStop();
                  }}
                  className="w-10 h-10 sm:w-10 sm:h-10 md:w-12 md:h-12 hover:bg-secondary/80 active:scale-95 transition-all touch-manipulation"
                  title="עצירה לגמרי"
                >
                  <Square className="w-5 h-5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={onNext}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  onNext();
                }}
                className="w-10 h-10 sm:w-10 sm:h-10 md:w-12 md:h-12 hover:bg-secondary/80 active:scale-95 transition-all touch-manipulation"
              >
                <SkipForward className="w-5 h-5" />
              </Button>
            </div>

            {/* Volume Control */}
            <div className="flex items-center gap-1 sm:gap-2 flex-1 justify-end">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMuted(!isMuted)}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  setIsMuted(!isMuted);
                }}
                className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 active:scale-95 transition-all touch-manipulation"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                  <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
              </Button>
              <Slider
                value={[volume]}
                max={100}
                step={1}
                onValueChange={(v) => {
                  setVolume(v[0]);
                  // If external speaker is active, send volume command immediately
                  if (isExternalSpeakerActive) {
                    controlExternalSpeaker('volume', v[0]);
                  }
                }}
                className="w-24 sm:w-24 md:w-32 cursor-pointer touch-manipulation"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Player Modal */}
      {isFullscreen && (
        <div 
          className="fixed inset-0 bg-background z-[100] flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 overflow-y-auto"
          onClick={(e) => {
            // Close on background click
            if (e.target === e.currentTarget) {
              setIsFullscreen(false);
            }
          }}
        >
          {/* Close Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullscreen(false)}
            onTouchEnd={(e) => {
              e.preventDefault();
              setIsFullscreen(false);
            }}
            className="absolute top-2 right-2 sm:top-4 sm:right-4 md:top-8 md:right-8 z-10 w-10 h-10 sm:w-12 sm:h-12 touch-manipulation"
            title="סגור"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </Button>

          <div className="w-full max-w-4xl flex flex-col items-center gap-6 md:gap-8">
            {/* Album Art - Large */}
            <div className="w-full max-w-md aspect-square rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shadow-2xl overflow-hidden">
              {song.coverUrl ? (
                <img
                  src={song.coverUrl}
                  alt={song.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-8xl md:text-9xl">🎵</span>
              )}
            </div>

            {/* Song Info */}
            <div className="text-center space-y-2 px-4">
              <h2 className="text-xl sm:text-2xl md:text-4xl font-bold text-foreground break-words">
                {song.title}
              </h2>
              <p className="text-base sm:text-lg md:text-xl text-muted-foreground break-words">
                {song.artist}
              </p>
              {selectedSpeaker && (
                <p className="text-[10px] sm:text-xs md:text-sm text-primary flex items-center justify-center gap-1.5 sm:gap-2 mt-2 max-w-[90vw] mx-auto">
                  <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-primary animate-pulse flex-shrink-0" />
                  <span className="line-clamp-2 text-center">
                    מנגן ב-{isChromecastActive && chromecast.state.device 
                      ? (chromecast.state.device.name || chromecast.state.device.friendlyName || 'Chromecast')
                      : selectedSpeaker}
                  </span>
                </p>
              )}
            </div>

            {/* Progress Bar */}
            <div className="w-full max-w-2xl space-y-2">
              <Slider
                value={[currentTime]}
                max={duration || 100}
                step={1}
                onValueChange={handleSeek}
                className="w-full cursor-pointer"
                disabled={duration === 0 || isLoading}
              />
              <div className="flex justify-between text-sm md:text-base text-muted-foreground">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration || song.duration)}</span>
              </div>
              {(isLoading || isBuffering) && (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">
                    {isLoading ? 'טוען...' : 'מוריד...'}
                  </span>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex flex-col items-center gap-6 w-full">
              {/* Main Controls */}
              <div className="flex items-center gap-4 md:gap-6">
                {onRepeatModeChange && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRepeatModeClick}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      handleRepeatModeClick();
                    }}
                    className="w-10 h-10 md:w-12 md:h-12 hover:bg-secondary/80 transition-colors touch-manipulation"
                    title={
                      repeatMode === 'none' ? 'לא חוזר' :
                      repeatMode === 'one' ? 'חוזר על שיר אחד' :
                      'חוזר על כל השירים'
                    }
                  >
                    {repeatMode === 'none' && (
                      <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                    {repeatMode === 'one' && (
                      <svg className="w-5 h-5 md:w-6 md:h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        <text x="12" y="16" textAnchor="middle" fontSize="8" fill="currentColor">1</text>
                      </svg>
                    )}
                    {repeatMode === 'all' && (
                      <svg className="w-5 h-5 md:w-6 md:h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onPrevious}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    onPrevious();
                  }}
                  className="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 hover:bg-secondary/80 transition-colors touch-manipulation"
                >
                  <SkipBack className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                </Button>
                <Button
                  variant="default"
                  size="icon"
                  onClick={onPlayPause}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    onPlayPause();
                  }}
                  className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-primary to-accent hover:scale-105 active:scale-95 transition-all shadow-[var(--shadow-player)] touch-manipulation"
                  disabled={isLoading && !isPlaying}
                >
                  {(isLoading && !isPlaying) ? (
                    <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10" fill="currentColor" />
                  ) : (
                    <Play className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10" fill="currentColor" />
                  )}
                </Button>
                {onStop && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onStop}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      onStop();
                    }}
                    className="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 hover:bg-secondary/80 transition-colors touch-manipulation"
                    title="עצירה לגמרי"
                  >
                    <Square className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onNext}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    onNext();
                  }}
                  className="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 hover:bg-secondary/80 transition-colors touch-manipulation"
                >
                  <SkipForward className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                </Button>
              </div>

              {/* Volume Control */}
              <div className="flex items-center gap-2 sm:gap-3 md:gap-4 w-full max-w-xs">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMuted(!isMuted)}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    setIsMuted(!isMuted);
                  }}
                  className="w-10 h-10 md:w-12 md:h-12 hover:bg-secondary/80 transition-colors touch-manipulation flex-shrink-0"
                >
                  {isMuted ? (
                    <VolumeX className="w-5 h-5 md:w-6 md:h-6" />
                  ) : (
                    <Volume2 className="w-5 h-5 md:w-6 md:h-6" />
                  )}
                </Button>
                <Slider
                  value={[volume]}
                  max={100}
                  step={1}
                  onValueChange={(v) => {
                    setVolume(v[0]);
                    // If external speaker is active, send volume command immediately
                    if (isExternalSpeakerActive) {
                      controlExternalSpeaker('volume', v[0]);
                    }
                  }}
                  className="flex-1 cursor-pointer touch-manipulation"
                />
                <span className="text-sm md:text-base text-muted-foreground w-12 text-center flex-shrink-0">
                  {volume}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MusicPlayer;
