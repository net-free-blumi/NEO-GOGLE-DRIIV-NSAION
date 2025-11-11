import { useEffect, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Loader2, Square, X, Maximize2, Cast, XCircle } from "lucide-react";
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
  onSpeakerChange?: (speaker: string | null) => void;
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
  onSpeakerChange,
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
  
  // Ref to prevent keyboard event conflicts (e.g., when typing in input fields)
  const isInputFocusedRef = useRef(false);

  // Load song to Chromecast if connected
  // Use ref to prevent multiple loads of the same song
  const lastLoadedSongRef = useRef<string | null>(null);
  const lastLoadedTimeRef = useRef<number>(0);
  const isLoadingRef = useRef(false);
  
  useEffect(() => {
    if (isChromecastActive && song.url && !isLoadingRef.current) {
      // Stop local audio immediately when Chromecast becomes active
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      
      // Only load if it's a different song (not when seeking - that's handled in handleSeek)
      if (lastLoadedSongRef.current !== song.id) {
        lastLoadedSongRef.current = song.id;
        lastLoadedTimeRef.current = 0;
        isLoadingRef.current = true;
        setIsLoading(true);
        setIsBuffering(true);
        
        // Ensure local audio is stopped before loading to Chromecast
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        
        // Step 1: Download song locally first (buffer)
        const loadAndCast = async () => {
          try {
            const audio = audioRef.current;
            if (!audio) {
            isLoadingRef.current = false;
              setIsLoading(false);
              setIsBuffering(false);
              return;
            }
            
            // Get token for Netlify functions
            const accessToken = sessionStorage.getItem('gd_access_token');
            let finalUrl = song.url;
            const isNetlify = song.url.includes('.netlify.app') || song.url.includes('netlify/functions');
            
            if (isNetlify && accessToken) {
              const separator = song.url.includes('?') ? '&' : '?';
              finalUrl = `${song.url}${separator}token=${encodeURIComponent(accessToken)}`;
            } else if (!isNetlify && accessToken && !song.url.includes('token=')) {
              const separator = song.url.includes('?') ? '&' : '?';
              finalUrl = `${song.url}${separator}token=${encodeURIComponent(accessToken)}`;
            }
            
            // Set audio source and start downloading
            if (audio.src !== finalUrl) {
              audio.preload = 'auto';
              audio.src = finalUrl;
            }
            
            // Wait for buffer to download (10 MB minimum, or entire file if < 20 MB)
            await waitForBuffer(audio, 0);
            
            // Step 2: Verify stable connection to Chromecast
            if (!chromecast.state.isConnected) {
              const connected = await chromecast.connect();
              if (!connected) {
            isLoadingRef.current = false;
                setIsLoading(false);
                setIsBuffering(false);
                return;
              }
            }
            
            // Step 3: Now load media to Chromecast (after local buffer is ready)
            await chromecast.loadMedia(song.url, song.name || song.title || 'Track', 'audio/mpeg', 0);
            
            // Step 4: Wait a bit for Chromecast to buffer, then play
            setTimeout(async () => {
              try {
                await chromecast.play();
                isLoadingRef.current = false;
                setIsLoading(false);
                setIsBuffering(false);
              } catch (error) {
                isLoadingRef.current = false;
                setIsLoading(false);
                setIsBuffering(false);
              }
            }, 3000); // Wait 3 seconds for Chromecast buffer
            
          } catch (error) {
            isLoadingRef.current = false;
            setIsLoading(false);
            setIsBuffering(false);
            // Reset ref on error so we can retry
            lastLoadedSongRef.current = null;
          }
        };
        
        loadAndCast();
      }
    }
  }, [song.id, song.url, isChromecastActive, chromecast]);

  // Track if user is manually changing volume to prevent sync loop
  const isVolumeChangingRef = useRef(false);
  const volumeChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUserVolumeRef = useRef<number | null>(null);
  const lastUserMuteRef = useRef<boolean | null>(null);
  const volumeChangeTimeRef = useRef<number>(0);
  
  // Track if we're currently seeking to prevent sync conflicts
  const isSeekingRef = useRef(false);
  const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync Chromecast state with local state (except volume/mute which user controls)
  useEffect(() => {
    if (isChromecastActive && !isSeekingRef.current) {
      // Update current time from Chromecast - but skip if we're seeking
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

  // Track loading state to prevent multiple loads
  const loadingSongRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isDownloadingRef = useRef(false); // Track if we're currently downloading
  const currentAudioSrcRef = useRef<string | null>(null); // Track current audio src to prevent changes during download
  
  // Helper function to wait for buffer to download (10 MB minimum, or entire file if < 20 MB)
  const waitForBuffer = async (audio: HTMLAudioElement, startTime: number = 0): Promise<void> => {
    return new Promise<void>((resolve) => {
      // Minimum buffer size: 10 MB (10 * 1024 * 1024 bytes)
      const MIN_BUFFER_SIZE_MB = 10;
      const MIN_BUFFER_SIZE_BYTES = MIN_BUFFER_SIZE_MB * 1024 * 1024;
      
      // Maximum file size to download entirely: 20 MB
      const MAX_FILE_SIZE_MB = 20;
      const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
      
      // Estimate bytes per second (128 kbps MP3 = 16 KB/s)
      const estimatedBytesPerSecond = 16000; // ~128 kbps = 16 KB/s
      
      let isResolved = false;
      let checkCount = 0;
      const MAX_CHECKS = 200; // Maximum 200 checks (100 seconds at 500ms intervals)
      
      // Timeout after 120 seconds (fallback)
      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          resolve();
        }
      }, 120000);
      
      const cleanup = () => {
        audio.removeEventListener('progress', checkBuffer);
        audio.removeEventListener('canplay', checkBuffer);
        audio.removeEventListener('canplaythrough', checkBuffer);
        audio.removeEventListener('loadeddata', checkBuffer);
        audio.removeEventListener('loadedmetadata', checkBuffer);
        if (interval) clearInterval(interval);
      };
      
      let interval: NodeJS.Timeout | null = null;
      
      const checkBuffer = () => {
        if (isResolved) return;
        
        checkCount++;
        if (checkCount > MAX_CHECKS) {
          // Too many checks - resolve anyway to prevent infinite loop
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeout);
            cleanup();
            resolve();
          }
          return;
        }
        
        try {
          // Check if audio has duration (file size can be estimated)
          const duration = audio.duration;
          if (isNaN(duration) || duration === 0) {
            // Duration not available yet, keep waiting
            return;
          }
          
          // Estimate total file size
          const estimatedTotalBytes = duration * estimatedBytesPerSecond;
          
          // Check if file is small (< 20 MB) - if so, download entire file
          const shouldDownloadEntireFile = estimatedTotalBytes < MAX_FILE_SIZE_BYTES;
          
          // Check buffered data
          const buffered = audio.buffered;
          let totalBuffered = 0;
          let hasBufferAtPosition = false;
          let bufferAfterPosition = 0;
          
          for (let i = 0; i < buffered.length; i++) {
            const start = buffered.start(i);
            const end = buffered.end(i);
            const range = end - start;
            totalBuffered += range;
            
            // Check if startTime is within buffered range
            if (startTime >= start - 0.5 && startTime <= end + 0.5) {
              hasBufferAtPosition = true;
              bufferAfterPosition = end - startTime;
            } else if (startTime < start) {
              bufferAfterPosition += range;
            }
          }
          
          // Estimate bytes buffered
          const estimatedBufferedBytes = totalBuffered * estimatedBytesPerSecond;
          
          // Check if position is buffered
          const positionBuffered = hasBufferAtPosition || bufferAfterPosition > 30;
          
          // Check readyState
          const readyStateGood = audio.readyState >= 3; // HAVE_FUTURE_DATA
          
          // Determine if we have enough buffer
          let hasEnoughBuffer = false;
          
          if (shouldDownloadEntireFile) {
            // For small files, wait until entire file is downloaded
            const percentDownloaded = (totalBuffered / duration) * 100;
            hasEnoughBuffer = percentDownloaded >= 95 && readyStateGood; // 95% downloaded
          } else {
            // For larger files, wait for at least 10 MB
            hasEnoughBuffer = estimatedBufferedBytes >= MIN_BUFFER_SIZE_BYTES && 
                             positionBuffered && 
                             readyStateGood;
          }
          
          // Also check if we have canplaythrough (entire file is ready)
          if (audio.readyState >= 4) { // HAVE_ENOUGH_DATA
            hasEnoughBuffer = true;
          }
          
          if (hasEnoughBuffer && positionBuffered) {
            if (!isResolved) {
              isResolved = true;
              clearTimeout(timeout);
              cleanup();
              resolve();
            }
          }
        } catch (error) {
          // If error, continue checking but don't resolve too quickly
          if (checkCount >= 50) {
            // After 50 checks, resolve anyway
            if (!isResolved) {
              isResolved = true;
              clearTimeout(timeout);
              cleanup();
              resolve();
            }
          }
        }
      };
      
      // Start checking immediately
      checkBuffer();
      
      // Listen for buffer events
      audio.addEventListener('progress', checkBuffer);
      audio.addEventListener('canplay', checkBuffer);
      audio.addEventListener('canplaythrough', checkBuffer);
      audio.addEventListener('loadeddata', checkBuffer);
      audio.addEventListener('loadedmetadata', checkBuffer);
      
      // Check periodically (every 500ms) to ensure we catch progress
      interval = setInterval(() => {
        checkBuffer();
      }, 500);
    });
  };

  // Load song and set up audio element with optimized streaming
  useEffect(() => {
    if (!audioRef.current || !song.url) return;
    
    const audio = audioRef.current;
    
    // Cancel previous loading if different song
    if (loadingSongRef.current !== song.id && abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      isDownloadingRef.current = false;
      currentAudioSrcRef.current = null;
    }
    
    // If already loading/downloading this song, don't load again
    if (loadingSongRef.current === song.id || isDownloadingRef.current) {
      return;
    }
    
    // If Chromecast is active, still load audio for buffering (but don't play it)
    if (isChromecastActive) {
      // Pause local audio when Chromecast is active, but keep it loaded for buffering
      if (!audio.paused) {
        audio.pause();
      }
      // Continue to load the audio for buffering purposes (don't return early)
    }
    
    // Create new AbortController for this load
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    loadingSongRef.current = song.id;
    
    // Helper function to refresh token if needed
    const refreshTokenIfNeeded = async (): Promise<string | null> => {
      // Check if aborted
      if (abortController.signal.aborted) return null;
      
      let accessToken = sessionStorage.getItem('gd_access_token');
      const expiresAt = sessionStorage.getItem('gd_token_expires_at');
      
      // Check if token is expired - if so, try to refresh it
      if (accessToken && expiresAt && parseInt(expiresAt) <= Date.now()) {
        // Token expired, try to refresh using Google Token Client
        const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
        if (GOOGLE_CLIENT_ID && (window as any).google?.accounts?.oauth2) {
          // Use a promise to wait for token refresh
          try {
            await new Promise<void>((resolve, reject) => {
              // Check if aborted
              if (abortController.signal.aborted) {
                reject(new Error('Aborted'));
                return;
              }
              
              const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: 'https://www.googleapis.com/auth/drive.readonly',
                prompt: '', // Use cached consent
                callback: (resp: any) => {
                  if (abortController.signal.aborted) {
                    reject(new Error('Aborted'));
                    return;
                  }
                  
                  if (resp.access_token) {
                    const expiresIn = resp.expires_in || 3600;
                    const newExpiresAt = Date.now() + (expiresIn - 60) * 1000;
                    sessionStorage.setItem('gd_access_token', resp.access_token);
                    sessionStorage.setItem('gd_token_expires_at', newExpiresAt.toString());
                    accessToken = resp.access_token;
                    resolve();
                  } else if (resp.error) {
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
          } catch (error: any) {
            if (error.message === 'Aborted') return null;
            toast({
              title: 'התנתקות מ-Google Drive',
              description: 'החיבור ל-Google Drive פג. נא להתחבר מחדש.',
              variant: 'destructive',
              duration: 5000,
            });
            accessToken = null;
          }
        } else {
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
    const savedPosition = sessionStorage.getItem(`song_position_${song.id}`);
    const isNewSong = !savedPosition && audio.readyState === 0;
    
    if (isNewSong && isPlaying) {
      setIsLoading(true);
      setIsBuffering(false);
      setDuration(0);
    } else if (!isPlaying) {
      setIsLoading(false);
    }
    
    // Build URL with token if needed
    // Only set src if it's a new song or if audio hasn't loaded yet
    const isNewSongOrNotLoaded = !audio.src || audio.readyState === 0 || !audio.src.includes(song.url.split('?')[0]);
    
    if (isNewSongOrNotLoaded) {
      const isNetlify = song.url.includes('.netlify.app') || song.url.includes('netlify/functions');
      
      // Refresh token if needed and build URL
      refreshTokenIfNeeded().then((accessToken) => {
        // Check if aborted
        if (abortController.signal.aborted) return;
        
        if (!accessToken) {
          setIsLoading(false);
          setIsBuffering(false);
          loadingSongRef.current = null;
          return;
        }
        
        let finalUrl = song.url;
        if (isNetlify && accessToken) {
          const separator = song.url.includes('?') ? '&' : '?';
          finalUrl = `${song.url}${separator}token=${encodeURIComponent(accessToken)}`;
        } else if (!isNetlify && accessToken && !song.url.includes('token=')) {
          const separator = song.url.includes('?') ? '&' : '?';
          finalUrl = `${song.url}${separator}token=${encodeURIComponent(accessToken)}`;
        }
        
        // Only set src if it's different from current src (avoid resetting position)
        const currentSrcBase = audio.src ? audio.src.split('?')[0] : '';
        const newSrcBase = finalUrl.split('?')[0];
        if (currentSrcBase !== newSrcBase) {
          // Check if aborted before setting src
          if (abortController.signal.aborted) return;
          
          // Mark that we're downloading to prevent multiple requests
          isDownloadingRef.current = true;
          currentAudioSrcRef.current = finalUrl;
          
          // Optimize audio element for streaming
          audio.preload = 'auto'; // Use 'auto' to ensure download starts
          audio.src = finalUrl;
          
          // Prevent src from changing during download
          const originalSrc = finalUrl;
          const checkSrc = () => {
            if (audio.src !== originalSrc && isDownloadingRef.current) {
              // Restore src if it was changed during download
              audio.src = originalSrc;
            }
          };
          
          // Check src periodically to prevent changes
          const srcCheckInterval = setInterval(() => {
            if (!isDownloadingRef.current) {
              clearInterval(srcCheckInterval);
              return;
            }
            checkSrc();
          }, 100);
          
          // Clear interval when download completes
          audio.addEventListener('canplaythrough', () => {
            clearInterval(srcCheckInterval);
          }, { once: true });
        }
      }).catch((error: any) => {
        if (error.message === 'Aborted') return;
        setIsLoading(false);
        setIsBuffering(false);
        loadingSongRef.current = null;
      });
    }
    
    // Restore saved position if exists
    if (savedPosition) {
      const position = parseFloat(savedPosition);
      if (!isNaN(position) && position > 0) {
        if (audio.duration > 0 && position < audio.duration) {
          audio.currentTime = position;
          setCurrentTime(position);
        } else {
          const handleMetadataLoad = () => {
            if (abortController.signal.aborted) return;
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
      audio.currentTime = 0;
      setCurrentTime(0);
    }
    
    // Set up streaming optimization - use 'auto' to ensure download starts
    audio.setAttribute('preload', 'auto');
    
    // Add error handler for audio loading errors
    const handleAudioError = (e: any) => {
      if (abortController.signal.aborted) return;
      
      setIsLoading(false);
      setIsBuffering(false);
      
      const target = e.target as HTMLAudioElement;
      if (target.error) {
        const errorCode = target.error.code;
        if (errorCode === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED || errorCode === MediaError.MEDIA_ERR_NETWORK) {
          const accessToken = sessionStorage.getItem('gd_access_token');
          if (!accessToken) {
            toast({
              title: 'מנותק מחשבון Google',
              description: 'נא להתחבר מחדש ל-Google Drive כדי להמשיך להאזין למוזיקה.',
              variant: 'destructive',
              duration: 5000,
            });
          } else {
            const src = target.src || '';
            if (src.includes('netlify') || src.includes('504')) {
              toast({
                title: 'שגיאת זמן המתנה',
                description: 'השרת לא הגיב בזמן. נסה שוב או בדוק את החיבור לאינטרנט.',
                variant: 'destructive',
                duration: 5000,
              });
            } else {
              toast({
                title: 'שגיאה בטעינת השיר',
                description: 'לא הצלחנו לטעון את השיר. נא לבדוק את החיבור ל-Google Drive.',
                variant: 'destructive',
                duration: 5000,
              });
            }
          }
        }
      }
      loadingSongRef.current = null;
      isDownloadingRef.current = false;
      currentAudioSrcRef.current = null;
    };
    
    audio.addEventListener('error', handleAudioError);
    
    // Mark download as complete when audio is ready
    const handleCanPlayThrough = () => {
      isDownloadingRef.current = false;
      audio.removeEventListener('canplaythrough', handleCanPlayThrough);
    };
    audio.addEventListener('canplaythrough', handleCanPlayThrough);
    
    // Only load when user wants to play AND it's a new song (not resuming)
    if (isPlaying && isNewSongOrNotLoaded) {
      if (!abortController.signal.aborted && !isDownloadingRef.current) {
        // Show downloading state
        setIsLoading(true);
        setIsBuffering(true);
        
        // Mark that we're downloading to prevent multiple requests
        isDownloadingRef.current = true;
        
        // Load the audio first - ONLY ONCE
        if (audio.src && !audio.src.includes('blob:')) {
          // Only load if src is set and not a blob
          audio.load();
        }
        
        // Wait for buffer to download BEFORE playing (10 MB minimum, or entire file if < 20 MB)
        waitForBuffer(audio, 0).then(() => {
          // Mark download as complete
          isDownloadingRef.current = false;
          
          // Double check: make sure we're still supposed to play and not aborted
          // Also check that Chromecast is not active - don't play local audio if Chromecast is active
          if (!abortController.signal.aborted && isPlaying && audio.paused && !isChromecastActive && !isExternalSpeakerActive) {
            // Buffer is ready, now play
            audio.play().then(() => {
              setIsLoading(false);
              setIsBuffering(false);
            }).catch((err) => {
              console.error('Play error after buffer:', err);
              setIsLoading(false);
              setIsBuffering(false);
            });
          } else {
            setIsLoading(false);
            setIsBuffering(false);
          }
        }).catch((err) => {
          console.error('Buffer wait error:', err);
          isDownloadingRef.current = false;
          setIsLoading(false);
          setIsBuffering(false);
        });
      }
    }
    
    return () => {
      audio.removeEventListener('error', handleAudioError);
      // Cleanup on unmount or song change
      if (loadingSongRef.current === song.id) {
        loadingSongRef.current = null;
      }
    };
  }, [song.id, song.url, isPlaying, toast, isChromecastActive]);

  // Stop local audio immediately when external speaker is active
  useEffect(() => {
    if ((isExternalSpeakerActive || isChromecastActive) && audioRef.current) {
      const audio = audioRef.current;
      if (!audio.paused) {
        audio.pause();
        audio.currentTime = 0; // Reset position when switching to external speaker
      }
    }
  }, [isExternalSpeakerActive, isChromecastActive, selectedSpeaker]);
  
  // Stop local audio immediately when speaker changes to Chromecast
  useEffect(() => {
    const selectedSpeakerData = speakers.find((s: any) => s.id === selectedSpeaker);
    const isSwitchingToChromecast = selectedSpeakerData?.type === 'Chromecast';
    
    if (isSwitchingToChromecast && audioRef.current) {
      // Stop local audio immediately when switching to Chromecast
      const audio = audioRef.current;
      audio.pause();
      audio.currentTime = 0;
    }
  }, [selectedSpeaker, speakers]);

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
      
      // If audio is already loaded and paused, wait for buffer before playing (resume)
      if (audio.readyState >= 2 && audio.paused) {
        // Audio is already loaded - restore position FIRST, then wait for buffer, then play
        if (savedPosition) {
          const position = parseFloat(savedPosition);
          if (!isNaN(position) && position > 0) {
            // Set position immediately if duration is available
            if (audio.duration > 0 && position < audio.duration) {
              // Set position
              audio.currentTime = position;
              setCurrentTime(position);
              
              // Wait for buffer to download before playing
              waitForBuffer(audio, position).then(() => {
                // Double check: make sure we're still supposed to play
              // Also check that Chromecast is not active - don't play local audio if Chromecast is active
              if (isPlaying && audio.paused && !isChromecastActive && !isExternalSpeakerActive) {
                  // Buffer is ready, now play
                  audio.play().then(() => {
                    setIsLoading(false);
                  }).catch(err => {
                    console.error('Play error:', err);
                    setIsLoading(false);
                  });
                } else {
                  setIsLoading(false);
                }
              }).catch((err) => {
                console.error('Buffer wait error:', err);
                setIsLoading(false);
              });
              return; // Don't continue
            } else {
              // Wait for duration to load, then set position, wait for buffer, then play
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
        
        // No saved position - wait for buffer before playing
        waitForBuffer(audio, 0).then(() => {
          // Double check: make sure we're still supposed to play
          if (isPlaying && audio.paused) {
            audio.play().then(() => {
              setIsLoading(false);
            }).catch(err => {
              console.error('Play error:', err);
              setIsLoading(false);
            });
          } else {
            setIsLoading(false);
          }
        }).catch((err) => {
          console.error('Buffer wait error:', err);
          setIsLoading(false);
        });
        return; // Don't continue with tryPlay logic
      }
      
      // Wait for enough data before playing to prevent stuttering
      const tryPlay = async () => {
        // Don't play local audio if Chromecast or external speaker is active
        if (isChromecastActive || isExternalSpeakerActive) {
          setIsLoading(false);
          return;
        }
        
        // Wait for at least some data to be buffered
        // For better streaming, we want HAVE_FUTURE_DATA (readyState >= 3)
        if (audio.readyState >= 3) { // HAVE_FUTURE_DATA - best for streaming
          try {
            // Double check before playing
            if (!isChromecastActive && !isExternalSpeakerActive) {
            await audio.play();
            }
            setIsLoading(false);
          } catch (err) {
            console.error('Play error:', err);
            setIsLoading(false);
          }
        } else if (audio.readyState >= 2) { // HAVE_CURRENT_DATA - acceptable
          try {
            // Double check before playing
            if (!isChromecastActive && !isExternalSpeakerActive) {
            await audio.play();
            }
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
            // Don't play if Chromecast or external speaker is active
            if (isChromecastActive || isExternalSpeakerActive) {
              setIsLoading(false);
              return;
            }
            
            if (audio.readyState >= 3) { // Prefer HAVE_FUTURE_DATA
              if (!isChromecastActive && !isExternalSpeakerActive) {
              audio.play().catch(err => {
                console.error('Play error:', err);
                setIsLoading(false);
              });
              }
            } else if (audio.readyState >= 2) { // Accept HAVE_CURRENT_DATA
              if (!isChromecastActive && !isExternalSpeakerActive) {
              audio.play().catch(err => {
        console.error('Play error:', err);
        setIsLoading(false);
      });
              }
            } else if (retries < maxRetries) {
              retries++;
              setTimeout(checkAndPlay, 100);
            } else {
              // Force play even if not ready (browser will buffer)
              // But only if Chromecast/external speaker is not active
              if (!isChromecastActive && !isExternalSpeakerActive) {
              audio.play().catch(err => {
                console.error('Play error after retries:', err);
                setIsLoading(false);
              });
              } else {
                setIsLoading(false);
              }
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
      // Don't handle ended event if Chromecast or external speaker is active
      if (isChromecastActive || isExternalSpeakerActive) {
        return;
      }
      
      if (repeatMode === 'one') {
        // Repeat current song
        audio.currentTime = 0;
        if (!isChromecastActive && !isExternalSpeakerActive) {
        audio.play();
        }
      } else if (repeatMode === 'all') {
        // Continue to next song
        onNext();
      } else {
        // Default: continue to next
        onNext();
      }
    };

    audio.addEventListener('ended', handleEnded);
    
    // Sync audio play/pause state with React state
    // This handles cases where audio is controlled externally (e.g., media keys, other tabs)
    const handleAudioPlay = () => {
      if (!isPlaying && !isChromecastActive && !isExternalSpeakerActive) {
        // Audio started playing externally, sync state
        onPlayPause();
      }
    };
    
    const handleAudioPause = () => {
      if (isPlaying && !isChromecastActive && !isExternalSpeakerActive) {
        // Audio paused externally, sync state
        onPlayPause();
      }
    };
    
    audio.addEventListener('play', handleAudioPlay);
    audio.addEventListener('pause', handleAudioPause);
    
    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handleAudioPlay);
      audio.removeEventListener('pause', handleAudioPause);
    };
  }, [repeatMode, onNext, isPlaying, isChromecastActive, isExternalSpeakerActive, onPlayPause]);

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

  const handleSeek = async (value: number[]) => {
    const seekTime = value[0];
    
    // If Chromecast is active, reload media with new currentTime (like loading new song)
    if (isChromecastActive && song.url) {
      // Mark that we're seeking to prevent sync conflicts
      isSeekingRef.current = true;
      
      // Clear any existing seek timeout
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current);
      }
      
      // Show loading state immediately - user needs to see what's happening
      setIsLoading(true);
      setIsBuffering(true);
      
      // Update optimistically for better UX - show where we're seeking to
      setCurrentTime(seekTime);
      
      // First, buffer the new position locally (same as loading new song)
      const audio = audioRef.current;
      if (audio && song.url && !isDownloadingRef.current) {
        try {
          // Mark that we're downloading to prevent multiple requests
          isDownloadingRef.current = true;
          
          // Get token for Netlify functions
          const accessToken = sessionStorage.getItem('gd_access_token');
          let finalUrl = song.url;
          const isNetlify = song.url.includes('.netlify.app') || song.url.includes('netlify/functions');
          
          if (isNetlify && accessToken) {
            const separator = song.url.includes('?') ? '&' : '?';
            finalUrl = `${song.url}${separator}token=${encodeURIComponent(accessToken)}`;
          } else if (!isNetlify && accessToken && !song.url.includes('token=')) {
            const separator = song.url.includes('?') ? '&' : '?';
            finalUrl = `${song.url}${separator}token=${encodeURIComponent(accessToken)}`;
          }
          
          // Set src if different - ONLY ONCE
          if (audio.src !== finalUrl) {
            currentAudioSrcRef.current = finalUrl;
            audio.preload = 'auto'; // Use 'auto' to ensure download starts
            audio.src = finalUrl;
            
            // Prevent src from changing during download
            const originalSrc = finalUrl;
            const checkSrc = () => {
              if (audio.src !== originalSrc && isDownloadingRef.current) {
                // Restore src if it was changed during download
                audio.src = originalSrc;
              }
            };
            
            // Check src periodically to prevent changes
            const srcCheckInterval = setInterval(() => {
              if (!isDownloadingRef.current) {
                clearInterval(srcCheckInterval);
                return;
              }
              checkSrc();
            }, 100);
            
            // Clear interval when download completes
            audio.addEventListener('canplaythrough', () => {
              clearInterval(srcCheckInterval);
            }, { once: true });
          }
          
          // Set currentTime to seek position to start buffering
          audio.currentTime = seekTime;
          
          // Step 1: Wait for the audio to buffer the new position (10 MB minimum, or entire file if < 20 MB)
          // This ensures we download the relevant part before playing
          await waitForBuffer(audio, seekTime);
          
          // Mark download as complete
          isDownloadingRef.current = false;
          
          // Step 2: Verify stable connection to Chromecast
          if (!chromecast.state.isConnected) {
            const connected = await chromecast.connect();
            if (!connected) {
              isLoadingRef.current = false;
              setIsLoading(false);
              setIsBuffering(false);
              return;
            }
          }
          
          // Step 3: Now load media to Chromecast (after local buffer is ready)
          isLoadingRef.current = true;
          setIsLoading(true);
          setIsBuffering(false); // Buffer is ready, now loading to Chromecast
          
          await chromecast.loadMedia(song.url, song.name || song.title || 'Track', 'audio/mpeg', seekTime);
          
          // Step 4: Wait for Chromecast to buffer and be ready, then play
          // Poll for media to be ready before playing
          let pollCount = 0;
          const maxPolls = 20; // 10 seconds max wait (20 * 500ms)
          const checkAndPlay = async () => {
            try {
              const mediaSession = chromecast.state.mediaSession;
              if (!mediaSession) {
                if (pollCount < maxPolls) {
                  pollCount++;
                  setTimeout(checkAndPlay, 500);
                  return;
                } else {
                  // Timeout - try to play anyway
            try {
              await chromecast.play();
                  } catch (error) {
                    // Silent fail
                  }
                  isLoadingRef.current = false;
              setIsLoading(false);
              setIsBuffering(false);
                  return;
                }
              }
              
              const PlayerState = (window as any).chrome?.cast?.media?.PlayerState;
              const currentState = mediaSession.playerState;
              
              // Media is ready when it's IDLE or PAUSED (not BUFFERING)
              if (currentState === PlayerState?.IDLE || currentState === PlayerState?.PAUSED) {
                // Wait a bit more to ensure buffer is ready
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Final check before playing
                if (mediaSession && (mediaSession.playerState === PlayerState?.IDLE || mediaSession.playerState === PlayerState?.PAUSED)) {
                  await chromecast.play();
              isLoadingRef.current = false;
                  setIsLoading(false);
                  setIsBuffering(false);
                } else {
                  isLoadingRef.current = false;
                  setIsLoading(false);
                  setIsBuffering(false);
                }
              } else if (pollCount < maxPolls) {
                // Still buffering, check again
                pollCount++;
                setTimeout(checkAndPlay, 500);
              } else {
                // Timeout - try to play anyway
                try {
                  await chromecast.play();
            } catch (error) {
                  // Silent fail
                }
                isLoadingRef.current = false;
              setIsLoading(false);
              setIsBuffering(false);
              }
            } catch (error) {
              isLoadingRef.current = false;
              setIsLoading(false);
              setIsBuffering(false);
            }
          };
          
          // Start checking after initial delay
          setTimeout(checkAndPlay, 2000); // Wait 2 seconds before first check
          
        } catch (error) {
          // Mark download as complete even on error
          isDownloadingRef.current = false;
          
          // If buffering fails, still try to reload (fallback)
          isLoadingRef.current = true;
          setIsLoading(true);
          setIsBuffering(true);
          
          chromecast.loadMedia(song.url, song.name || song.title || 'Track', 'audio/mpeg', seekTime)
            .then(async () => {
              // Wait a bit then play automatically
              setTimeout(async () => {
                try {
                  await chromecast.play();
                  setIsLoading(false);
                  setIsBuffering(false);
                } catch (error) {
                  setIsLoading(false);
                  setIsBuffering(false);
                }
              }, 2000);
            })
            .catch(() => {
              setIsLoading(false);
              setIsBuffering(false);
            })
            .finally(() => {
              isLoadingRef.current = false;
            });
        } finally {
          // Wait before allowing sync again to prevent loops
          seekTimeoutRef.current = setTimeout(() => {
            isSeekingRef.current = false;
          }, 3000);
        }
      } else if (!isDownloadingRef.current) {
        // Fallback: reload media directly if audio element not available
        isDownloadingRef.current = true;
        isLoadingRef.current = true;
        setIsLoading(true);
        setIsBuffering(true);
        
        chromecast.loadMedia(song.url, song.name || song.title || 'Track', 'audio/mpeg', seekTime)
          .then(async () => {
            // Wait a bit then play automatically
            setTimeout(async () => {
              try {
                await chromecast.play();
                setIsLoading(false);
                setIsBuffering(false);
              } catch (error) {
                setIsLoading(false);
                setIsBuffering(false);
              }
            }, 2000);
          })
          .catch(() => {
            setIsLoading(false);
            setIsBuffering(false);
          })
          .finally(() => {
            isDownloadingRef.current = false;
            isLoadingRef.current = false;
            seekTimeoutRef.current = setTimeout(() => {
              isSeekingRef.current = false;
            }, 3000);
          });
      }
      return;
    }
    
    // If external speaker is active, send seek command to it
    if (isExternalSpeakerActive) {
      // Show loading state
      setIsLoading(true);
      setIsBuffering(true);
      
      controlExternalSpeaker('seek', seekTime);
      setCurrentTime(seekTime);
      
      // Wait a bit then play automatically
      setTimeout(() => {
        if (isPlaying) {
          controlExternalSpeaker('play');
        }
        setIsLoading(false);
        setIsBuffering(false);
      }, 1000);
      return;
    }
    
    // Otherwise, seek local audio
    if (audioRef.current && !isDownloadingRef.current) {
      const audio = audioRef.current;
      
      // Mark that we're downloading to prevent multiple requests
      isDownloadingRef.current = true;
      
      // Show loading state
      setIsLoading(true);
      setIsBuffering(true);
      
      // Update optimistically - show where we're seeking to
      setCurrentTime(seekTime);
      
      // Prevent src from changing during download
      const originalSrc = audio.src;
      if (originalSrc) {
        currentAudioSrcRef.current = originalSrc;
        
        const checkSrc = () => {
          if (audio.src !== originalSrc && isDownloadingRef.current) {
            // Restore src if it was changed during download
            audio.src = originalSrc;
          }
        };
        
        // Check src periodically to prevent changes
        const srcCheckInterval = setInterval(() => {
          if (!isDownloadingRef.current) {
            clearInterval(srcCheckInterval);
            return;
          }
          checkSrc();
        }, 100);
        
        // Clear interval when download completes
        audio.addEventListener('canplaythrough', () => {
          clearInterval(srcCheckInterval);
        }, { once: true });
      }
      
      // If audio is loaded, seek immediately
      if (audio.readyState > 0) {
        audio.currentTime = seekTime;
        
        // Wait for buffer to download (10 MB minimum, or entire file if < 20 MB) before playing
        waitForBuffer(audio, seekTime).then(() => {
          // Mark download as complete
          isDownloadingRef.current = false;
          
          // Buffer is ready, now play automatically if we're supposed to play
          if (isPlaying && audio.paused) {
            audio.play().then(() => {
              setIsLoading(false);
              setIsBuffering(false);
            }).catch((err) => {
              console.error('Play error after seek:', err);
              setIsLoading(false);
              setIsBuffering(false);
            });
          } else {
            setIsLoading(false);
            setIsBuffering(false);
          }
        }).catch((err) => {
          console.error('Buffer wait error after seek:', err);
          isDownloadingRef.current = false;
          setIsLoading(false);
          setIsBuffering(false);
        });
      } else {
        // If audio not loaded yet, wait for it to load then seek
        const handleCanSeek = () => {
          audio.removeEventListener('loadedmetadata', handleCanSeek);
          audio.currentTime = seekTime;
          
          // Wait for buffer to download (10 MB minimum, or entire file if < 20 MB) before playing
          waitForBuffer(audio, seekTime).then(() => {
            // Mark download as complete
            isDownloadingRef.current = false;
            
            // Buffer is ready, now play automatically if we're supposed to play
            if (isPlaying && audio.paused) {
              audio.play().then(() => {
                setIsLoading(false);
                setIsBuffering(false);
              }).catch((err) => {
                console.error('Play error after seek:', err);
                setIsLoading(false);
                setIsBuffering(false);
              });
            } else {
              setIsLoading(false);
              setIsBuffering(false);
            }
          }).catch((err) => {
            console.error('Buffer wait error after seek:', err);
            isDownloadingRef.current = false;
            setIsLoading(false);
            setIsBuffering(false);
          });
        };
        audio.addEventListener('loadedmetadata', handleCanSeek);
  
  // Keyboard shortcuts: Spacebar for play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input field
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || 
                      target.tagName === 'TEXTAREA' || 
                      target.isContentEditable ||
                      target.closest('input') ||
                      target.closest('textarea') ||
                      target.closest('[contenteditable="true"]');
      
      // Spacebar for play/pause
      if ((e.code === 'Space' || e.key === ' ') && !isInput) {
        e.preventDefault(); // Prevent page scroll
        e.stopPropagation(); // Stop event bubbling
        onPlayPause();
        return false;
      }
    };
    
    // Use capture phase to catch the event early
    document.addEventListener('keydown', handleKeyDown, true);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onPlayPause]);
  
  // Sync with Chromecast state changes (when Chromecast is controlled externally)
  useEffect(() => {
    if (isChromecastActive && chromecast.state.isPlaying !== undefined) {
      // If Chromecast playing state doesn't match our state, sync it
      if (chromecast.state.isPlaying !== isPlaying) {
        // This will trigger play/pause in the parent component
        if (chromecast.state.isPlaying && !isPlaying) {
          onPlayPause(); // Play
        } else if (!chromecast.state.isPlaying && isPlaying) {
          onPlayPause(); // Pause
        }
      }
    }
  }, [isChromecastActive, chromecast.state.isPlaying, isPlaying, onPlayPause]);
      }
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
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-sm font-medium text-foreground">
                  {isLoading ? 'טוען שיר...' : 'מוריד...'}
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
                    onError={(e) => {
                      // If image fails to load, hide it and show emoji
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent && !parent.querySelector('span')) {
                        const emoji = document.createElement('span');
                        emoji.className = 'text-lg sm:text-xl md:text-2xl';
                        emoji.textContent = '🎵';
                        parent.appendChild(emoji);
                      }
                    }}
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
                  <div className="flex items-center gap-1 mt-0.5 min-w-0">
                    <p className="text-[9px] sm:text-[10px] md:text-xs text-primary flex items-center gap-1 flex-1 min-w-0">
                      <span className="w-1 h-1 rounded-full bg-primary animate-pulse flex-shrink-0" />
                      <span className="truncate">
                        מחובר: {isChromecastActive && chromecast.state.device 
                          ? (chromecast.state.device.name || chromecast.state.device.friendlyName || 'רמקול')
                          : (selectedSpeakerData?.name || selectedSpeaker)}
                      </span>
                    </p>
                    {onSpeakerChange && (
                      <button
                        onClick={async () => {
                          if (isChromecastActive && chromecast.state.isConnected) {
                            await chromecast.disconnect();
                          }
                          onSpeakerChange(null);
                          toast({
                            title: "רמקול מנותק",
                            description: "מנגן כעת במכשיר זה",
                          });
                        }}
                        className="flex-shrink-0 p-0.5 hover:bg-destructive/20 rounded transition-colors touch-manipulation"
                        title="נתק רמקול"
                      >
                        <XCircle className="w-3 h-3 text-destructive" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>


              {/* כפתור עצירה - באמצע */}
              {onStop && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onStop}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    onStop();
                  }}
                  className="w-9 h-9 sm:w-10 sm:h-10 hover:bg-secondary/80 active:scale-95 transition-all touch-manipulation"
                  title="עצור"
                >
                  <Square className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
              )}
            {/* Controls - סידור בעברית: קודם משמאל, עצירה באמצע, הבא מימין, כפתור מרובה אחרי */}
            <div className="flex items-center justify-center gap-1 sm:gap-2 flex-shrink-0">
            
              
              
              {/* כפתור שיר הבא - מימין */}
              <Button
                variant="ghost"
                size="icon"
                onClick={onNext}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  onNext();
                }}
                className="w-10 h-10 sm:w-10 sm:h-10 md:w-12 md:h-12 hover:bg-secondary/80 active:scale-95 transition-all touch-manipulation"
                title="שיר הבא"
              >
                <SkipForward className="w-5 h-5" />
              </Button>


              {/* כפתור נגינה/השהה - באמצע */}
              <Button
                variant="default"
                size="icon"
                onClick={onPlayPause}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  onPlayPause();
                }}
                className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-primary to-accent hover:scale-105 active:scale-95 transition-all shadow-[var(--shadow-player)] touch-manipulation"
                disabled={isLoading && !isPlaying}
                title={isPlaying ? "השהה" : "נגן"}
              >
                {(isLoading && !isPlaying) ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-6 h-6" fill="currentColor" />
                ) : (
                  <Play className="w-6 h-6" fill="currentColor" />
                )}
              </Button>
              

                {/* כפתור שיר קודם - משמאל */}
                <Button
                variant="ghost"
                size="icon"
                onClick={onPrevious}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  onPrevious();
                }}
                className="w-10 h-10 sm:w-10 sm:h-10 md:w-12 md:h-12 hover:bg-secondary/80 active:scale-95 transition-all touch-manipulation"
                title="שיר קודם"
              >
                <SkipBack className="w-5 h-5" />
              </Button>
              
              {/* כפתור מרובה - אחרי הכפתורים */}
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
                  onError={(e) => {
                    // If image fails to load, hide it and show emoji
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent && !parent.querySelector('span')) {
                      const emoji = document.createElement('span');
                      emoji.className = 'text-8xl md:text-9xl';
                      emoji.textContent = '🎵';
                      parent.appendChild(emoji);
                    }
                  }}
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
                <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-2 max-w-[90vw] mx-auto">
                  <p className="text-[10px] sm:text-xs md:text-sm text-primary flex items-center justify-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                    <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-primary animate-pulse flex-shrink-0" />
                    <span className="line-clamp-2 text-center">
                      מחובר: {isChromecastActive && chromecast.state.device 
                        ? (chromecast.state.device.name || chromecast.state.device.friendlyName || 'רמקול')
                        : (selectedSpeakerData?.name || selectedSpeaker)}
                    </span>
                  </p>
                  {onSpeakerChange && (
                    <button
                      onClick={async () => {
                        if (isChromecastActive && chromecast.state.isConnected) {
                          await chromecast.disconnect();
                        }
                        onSpeakerChange(null);
                        toast({
                          title: "רמקול מנותק",
                          description: "מנגן כעת במכשיר זה",
                        });
                      }}
                      className="flex-shrink-0 p-1 hover:bg-destructive/20 rounded transition-colors touch-manipulation"
                      title="נתק רמקול"
                    >
                      <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" />
                    </button>
                  )}
                </div>
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
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-sm font-medium text-foreground">
                    {isLoading ? 'טוען שיר...' : 'מוריד...'}
                  </span>
                </div>
              )}
            </div>


            {/* Controls - סידור בעברית: קודם משמאל, עצירה באמצע, הבא מימין, כפתור מרובה אחרי */}
            <div className="flex flex-col items-center gap-6 w-full">
              {/* Main Controls */}
              <div className="flex items-center gap-4 md:gap-6">

                {/* כפתור עצירה - באמצע */}
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
                    title="עצור"
                  >
                    <Square className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                  </Button>
                )}
                
                {/* כפתור שיר הבא - מימין */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onNext}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    onNext();
                  }}
                  className="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 hover:bg-secondary/80 transition-colors touch-manipulation"
                  title="שיר הבא"
                >
                  <SkipForward className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                </Button>
                
                
                {/* כפתור נגינה/השהה - באמצע */}
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
                  title={isPlaying ? "השהה" : "נגן"}
                >
                  {(isLoading && !isPlaying) ? (
                    <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10" fill="currentColor" />
                  ) : (
                    <Play className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10" fill="currentColor" />
                  )}
                </Button>




                 {/* כפתור שיר קודם - משמאל */}
                 <Button
                  variant="ghost"
                  size="icon"
                  onClick={onPrevious}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    onPrevious();
                  }}
                  className="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 hover:bg-secondary/80 transition-colors touch-manipulation"
                  title="שיר קודם"
                >
                  <SkipBack className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                </Button>
                
                {/* כפתור מרובה - אחרי הכפתורים */}
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
