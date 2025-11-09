import { useState, useEffect, useRef } from "react";
import { Radio, Check, Loader2, RefreshCw, Cast, Airplay, Bluetooth, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useChromecastContext } from "@/contexts/ChromecastContext";
import { Badge } from "@/components/ui/badge";

interface UnifiedSpeakerSelectorProps {
  selectedSpeaker: string | null;
  onSpeakerChange: (speaker: string | null) => void;
  mediaUrl?: string;
  contentType?: string;
  title?: string;
}

interface Speaker {
  id: string;
  name: string;
  type: 'Chromecast' | 'AirPlay' | 'DLNA' | 'Sonos' | 'Bluetooth' | 'Browser';
  url?: string;
  friendlyName?: string;
}

const UnifiedSpeakerSelector = ({
  selectedSpeaker,
  onSpeakerChange,
  mediaUrl,
  contentType = "audio/mpeg",
  title = "Track",
}: UnifiedSpeakerSelectorProps) => {
  const { toast } = useToast();
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chromecast = useChromecastContext();

  useEffect(() => {
    // Get audio element reference
    audioRef.current = document.querySelector('audio') as HTMLAudioElement;
    
    // Initialize Cast API callback
    (window as any).__onGCastApiAvailable = function(isAvailable: boolean) {
      console.log('Chromecast API available:', isAvailable);
      if (isAvailable) {
        // Initialize Cast Context
        try {
          const ctx = (window as any).cast?.framework?.CastContext?.getInstance();
          if (ctx) {
            ctx.setOptions({
              receiverApplicationId: (window as any).chrome?.cast?.media?.DEFAULT_MEDIA_RECEIVER_APP_ID,
              autoJoinPolicy: (window as any).chrome?.cast?.AutoJoinPolicy?.ORIGIN_SCOPED,
            });
            console.log('Chromecast Context initialized');
          }
        } catch (e) {
          console.error('Error initializing Chromecast:', e);
        }
        discoverSpeakers();
      }
    };
    
    // Check if Cast API is already loaded
    if ((window as any).cast?.framework) {
      console.log('Chromecast framework already loaded');
      const ctx = (window as any).cast?.framework?.CastContext?.getInstance();
      if (ctx) {
        ctx.setOptions({
          receiverApplicationId: (window as any).chrome?.cast?.media?.DEFAULT_MEDIA_RECEIVER_APP_ID,
          autoJoinPolicy: (window as any).chrome?.cast?.AutoJoinPolicy?.ORIGIN_SCOPED,
        });
      }
      discoverSpeakers();
    }
    
    // Initial discovery
    discoverSpeakers();
    
    // Monitor Chromecast state changes for automatic updates
    const checkCastState = () => {
      const ctx = (window as any).cast?.framework?.CastContext?.getInstance();
      if (ctx) {
        const castState = ctx.getCastState();
        const CastState = (window as any).cast?.framework?.CastState;
        console.log('Chromecast state:', castState, CastState);
        
        const onCastStateChanged = () => {
          // Refresh speakers when Cast state changes
          console.log('Chromecast state changed, refreshing speakers...');
          discoverSpeakers();
        };
        
        ctx.addEventListener(
          (window as any).cast.framework.CastContextEventType.CAST_STATE_CHANGED,
          onCastStateChanged
        );
        
        ctx.addEventListener(
          (window as any).cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
          onCastStateChanged
        );
        
        return () => {
          ctx.removeEventListener(
            (window as any).cast.framework.CastContextEventType.CAST_STATE_CHANGED,
            onCastStateChanged
          );
          ctx.removeEventListener(
            (window as any).cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
            onCastStateChanged
          );
        };
      }
    };
    
    // Try to check Cast state after a delay (in case SDK is still loading)
    const timeout = setTimeout(() => {
      checkCastState();
    }, 1000);
    
    return () => {
      clearTimeout(timeout);
    };
  }, []);

  const discoverSpeakers = async (): Promise<number> => {
    setIsScanning(true);
    const discoveredSpeakers: Speaker[] = [];

    try {
      // 1. Chromecast / Google Cast - תמיד להוסיף אם SDK זמין
      // Google Cast SDK תמיד זמין בדפדפן Chrome/Edge
      // גם אם לא נמצאו מכשירים, נוסיף את האפשרות - ה-picker יראה את כל המכשירים
      if ((window as any).cast?.framework || (window as any).chrome?.cast) {
        try {
          const ctx = (window as any).cast?.framework?.CastContext?.getInstance();
          if (ctx) {
            // Initialize Cast Context
            try {
              ctx.setOptions({
                receiverApplicationId: (window as any).chrome?.cast?.media?.DEFAULT_MEDIA_RECEIVER_APP_ID,
                autoJoinPolicy: (window as any).chrome?.cast?.AutoJoinPolicy?.ORIGIN_SCOPED,
              });
            } catch (e) {
              console.log('Error setting Cast options:', e);
            }
            
            // Check if already connected
            if (chromecast.state.isConnected && chromecast.state.device) {
              discoveredSpeakers.push({
                id: `chromecast-${chromecast.state.device.id}`,
                name: chromecast.state.device.name || chromecast.state.device.friendlyName || 'Chromecast',
                type: 'Chromecast'
              });
            } else {
              // Always show Chromecast option if Cast SDK is available
              // The picker will show all available devices when clicked
              const session = ctx.getCurrentSession();
              if (session) {
                const receiver = session.getReceiver();
                discoveredSpeakers.push({
                  id: `chromecast-${receiver.friendlyName || 'connected'}`,
                  name: receiver.friendlyName || 'Chromecast',
                  type: 'Chromecast'
                });
              } else {
                // Show option to connect - when clicked, will show picker with all devices
                // This includes Chromecast devices, Smart TVs, and other Cast-enabled devices
                // Google Cast SDK will show ALL available devices in the picker
                discoveredSpeakers.push({
                  id: 'chromecast-connect',
                  name: 'Chromecast / Smart TV / Google Cast',
                  type: 'Chromecast'
                });
              }
            }
          } else {
            // Cast SDK loaded but Context not available yet
            // Still add the option - it will work when clicked
            discoveredSpeakers.push({
              id: 'chromecast-connect',
              name: 'Chromecast / Smart TV / Google Cast',
              type: 'Chromecast'
            });
          }
        } catch (e) {
          console.error('Chromecast error:', e);
          // Even if there's an error, try to add the option
          discoveredSpeakers.push({
            id: 'chromecast-connect',
            name: 'Chromecast / Smart TV / Google Cast',
            type: 'Chromecast'
          });
        }
      } else {
        // Cast SDK not loaded - check if we're in Chrome/Edge
        const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
        const isEdge = /Edg/.test(navigator.userAgent);
        if (isChrome || isEdge) {
          // Cast SDK should be available in Chrome/Edge
          // Wait a bit and try again
          console.log('Waiting for Chromecast SDK to load...');
        }
      }

      // 2. AirPlay (Safari)
      if ('WebKitPlaybackTargetAvailabilityEvent' in window) {
        discoveredSpeakers.push({
          id: 'airplay-default',
          name: 'AirPlay',
          type: 'AirPlay'
        });
      }

      // 3. DLNA/UPnP Discovery (only in local development)
      // Note: UPnP/DLNA discovery requires local network access
      // It doesn't work from Netlify or other cloud services
      const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isLocalDev) {
        try {
          const dlnaSpeakers = await discoverDLNASpeakers();
          discoveredSpeakers.push(...dlnaSpeakers);
        } catch (e) {
          console.log('DLNA discovery error:', e);
        }

        // 4. Sonos Discovery (via UPnP) - only in local development
        try {
          const sonosSpeakers = await discoverSonosSpeakers();
          discoveredSpeakers.push(...sonosSpeakers);
        } catch (e) {
          console.log('Sonos discovery error:', e);
        }
      }

      // 5. Bluetooth (if available)
      // Note: Web Bluetooth API requires user interaction to select devices
      // We can't automatically discover all Bluetooth speakers
      // Instead, we'll add a generic "Bluetooth" option that prompts the user when selected
      if (navigator.bluetooth) {
        discoveredSpeakers.push({
          id: 'bluetooth-generic',
          name: 'Bluetooth',
          type: 'Bluetooth'
        });
      }

      // 6. Browser (default)
      discoveredSpeakers.push({
        id: 'browser-default',
        name: 'מכשיר זה',
        type: 'Browser'
      });

      setSpeakers(discoveredSpeakers);
      
      // Store speakers list in sessionStorage for MusicPlayer to access
      sessionStorage.setItem('available_speakers', JSON.stringify(discoveredSpeakers));
      
      // Don't show toast on every discovery - only on manual refresh or errors
      return discoveredSpeakers.length;
    } catch (error) {
      console.error('Error discovering speakers:', error);
      // Add default option if discovery fails
      setSpeakers([{
        id: 'browser-default',
        name: 'מכשיר זה',
        type: 'Browser'
      }]);
      return 1; // At least browser is available
    } finally {
      setIsScanning(false);
    }
  };

  // DLNA/UPnP Discovery - כמו BubbleUPnP
  const discoverDLNASpeakers = async (): Promise<Speaker[]> => {
    const dlnaSpeakers: Speaker[] = [];
    
    try {
      // Check if we're in local development (has local server)
      const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      
      if (isLocalDev) {
        // Try to discover via local backend service
        const discoveryUrl = `http://${window.location.hostname}:3001/api/discover-speakers?type=dlna`;
        
        try {
          const response = await fetch(discoveryUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(6000),
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.speakers && Array.isArray(data.speakers)) {
              dlnaSpeakers.push(...data.speakers.map((s: any) => ({
                id: s.id || `dlna-${s.name || s.address}`,
                name: s.name || s.friendlyName || `DLNA Device (${s.address})`,
                type: 'DLNA' as const,
                url: s.url,
                friendlyName: s.friendlyName || s.name,
                address: s.address,
              })));
            }
          }
        } catch (fetchError: any) {
          // If backend service is not available, log but don't fail
          if (fetchError.name !== 'AbortError') {
            console.log('DLNA discovery service not available - make sure to run: npm run dev:all');
          }
        }
      } else {
        // In production (Netlify), UPnP/DLNA discovery doesn't work
        // because it requires local network access
        // We'll rely on Chromecast SDK instead
        console.log('DLNA discovery not available in production - use Chromecast SDK instead');
      }
      
    } catch (e) {
      console.log('DLNA discovery error:', e);
    }
    
    return dlnaSpeakers;
  };

  // Sonos Discovery - גם דרך UPnP
  const discoverSonosSpeakers = async (): Promise<Speaker[]> => {
    const sonosSpeakers: Speaker[] = [];
    
    try {
      // Check if we're in local development
      const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      
      if (isLocalDev) {
        // Sonos uses UPnP for discovery
        const discoveryUrl = `http://${window.location.hostname}:3001/api/discover-speakers?type=sonos`;
        
        try {
          const response = await fetch(discoveryUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(6000),
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.speakers && Array.isArray(data.speakers)) {
              sonosSpeakers.push(...data.speakers.map((s: any) => ({
                id: s.id || `sonos-${s.name || s.address}`,
                name: s.name || s.friendlyName || 'Sonos Speaker',
                type: 'Sonos' as const,
                url: s.url,
                friendlyName: s.friendlyName || s.name,
                address: s.address,
              })));
            }
          }
        } catch (fetchError: any) {
          if (fetchError.name !== 'AbortError') {
            console.log('Sonos discovery service not available - make sure to run: npm run dev:all');
          }
        }
      } else {
        // In production, Sonos discovery doesn't work
        console.log('Sonos discovery not available in production - use Chromecast SDK instead');
      }
      
    } catch (e) {
      console.log('Sonos discovery error:', e);
    }
    
    return sonosSpeakers;
  };

  // Bluetooth Discovery
  const discoverBluetoothSpeakers = async (): Promise<Speaker[]> => {
    const bluetoothSpeakers: Speaker[] = [];
    
    try {
      if (navigator.bluetooth) {
        // Bluetooth Web API has limitations - we can't discover devices automatically
        // We can only request a device when user explicitly chooses one
        // So we'll add a placeholder option that prompts the user to select a device
        
        // Note: The Web Bluetooth API requires user interaction to select a device
        // We can't automatically discover all Bluetooth speakers
        // Instead, we'll add a generic "Bluetooth" option that will prompt the user
        
        // For now, we'll skip automatic discovery and just add a generic option
        // The user will need to select their Bluetooth device when they choose this option
        
        // If you want to try to request a device, you need valid UUIDs:
        // A2DP (Advanced Audio Distribution Profile) uses these UUIDs:
        // - Audio Sink: 0000110b-0000-1000-8000-00805f9b34fb
        // - Audio Source: 0000110a-0000-1000-8000-00805f9b34fb
        
        // But even with valid UUIDs, requestDevice requires user interaction
        // and can't be called automatically during discovery
        
        // For now, we'll return empty and handle Bluetooth selection differently
        // when the user actually selects the Bluetooth option
        
      }
    } catch (e) {
      // User cancelled or Bluetooth not available
      console.log('Bluetooth discovery:', e);
    }
    
    return bluetoothSpeakers;
  };

  const handleSpeakerSelect = async (speakerId: string) => {
    const speaker = speakers.find((s) => s.id === speakerId);
    if (!speaker) return;

    try {
      // Stop local audio before connecting to external speaker
      const audio = audioRef.current || document.querySelector('audio') as HTMLAudioElement;
      if (audio && speaker.type !== 'Browser') {
        audio.pause();
        audio.currentTime = 0;
      }

      switch (speaker.type) {
        case 'Chromecast':
          // Connect to Chromecast - this will show the native picker
          // But we'll handle it gracefully
          if (chromecast.state.isConnected) {
            // Already connected, just load media if needed
            if (mediaUrl) {
              await chromecast.loadMedia(mediaUrl, title, contentType);
            }
          } else {
            // Connect - this will show the native picker
            try {
              const connected = await chromecast.connect();
              if (connected && mediaUrl) {
                // Load media after connection
                await chromecast.loadMedia(mediaUrl, title, contentType);
              }
              // Refresh speakers list after connection
              setTimeout(() => discoverSpeakers(), 1000);
            } catch (error: any) {
              // User cancelled - don't show error
              if (error.code !== 'cancel' && error.name !== 'AbortError') {
                throw error;
              }
            }
          }
          break;
        case 'AirPlay':
          castToAirPlay();
          break;
        case 'DLNA':
          await castToDLNA(speaker);
          break;
        case 'Sonos':
          await castToSonos(speaker);
          break;
        case 'Bluetooth':
          await castToBluetooth(speaker);
          break;
        case 'Browser':
        default:
          // Disconnect Chromecast if switching to browser
          if (chromecast.state.isConnected) {
            await chromecast.disconnect();
          }
          break;
      }
      
      // Store speakers list in sessionStorage for MusicPlayer to access
      sessionStorage.setItem('available_speakers', JSON.stringify(speakers));
      
      onSpeakerChange(speakerId);
      toast({
        title: "רמקול מחובר",
        description: `מנגן כעת ב-${speaker.name}`,
      });
    } catch (error: any) {
      console.error('Error connecting to speaker:', error);
      toast({
        title: "שגיאה",
        description: error?.message || "לא ניתן להתחבר לרמקול",
        variant: "destructive",
      });
    }
  };

  const castToChromecast = async () => {
    try {
      // Connect to Chromecast if not already connected
      if (!chromecast.state.isConnected) {
        const connected = await chromecast.connect();
        if (!connected) {
          throw new Error("לא ניתן להתחבר ל-Chromecast");
        }
      }

      // Load media if URL provided
      if (mediaUrl) {
        const loaded = await chromecast.loadMedia(mediaUrl, title, contentType);
        if (!loaded) {
          throw new Error("לא ניתן לשדר ל-Chromecast");
        }
      }
    } catch (e: any) {
      throw new Error(e?.message || "לא ניתן לשדר ל-Chromecast");
    }
  };

  const castToAirPlay = () => {
    const audio = audioRef.current || document.querySelector('audio') as HTMLAudioElement;
    if (!audio) {
      throw new Error("לא נמצא נגן אודיו פעיל");
    }

    if ('webkitShowPlaybackTargetPicker' in audio) {
      (audio as any).webkitShowPlaybackTargetPicker();
    } else {
      throw new Error("AirPlay זמין רק ב-Safari");
    }
  };

  const castToDLNA = async (speaker: Speaker) => {
    if (!mediaUrl || !speaker.url) {
      throw new Error("אין שיר נבחר או URL של רמקול");
    }

    try {
      // Check if we're in local development
      const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      
      if (!isLocalDev) {
        throw new Error("DLNA casting דורש שרת מקומי. הרץ: npm run dev:all");
      }

      // Cast to DLNA device via backend
      const castUrl = `http://${window.location.hostname}:3001/api/cast-dlna`;
      const response = await fetch(castUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceUrl: speaker.url,
          mediaUrl: mediaUrl,
          title: title || 'Track',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'לא ניתן לשדר ל-DLNA');
      }

      toast({
        title: "שידור ל-DLNA",
        description: `משדר "${title}" ל-${speaker.name}`,
      });
    } catch (error: any) {
      throw new Error(error.message || "לא ניתן לשדר ל-DLNA");
    }
  };

  const castToSonos = async (speaker: Speaker) => {
    if (!mediaUrl || !speaker.url) {
      throw new Error("אין שיר נבחר או URL של רמקול");
    }

    // Sonos uses UPnP/DLNA, so we can use the same casting method
    await castToDLNA(speaker);
  };

  const castToBluetooth = async (speaker: Speaker) => {
    // Bluetooth audio is handled by the browser/OS
    // We don't need an audio element - just guide the user
    try {
      // Web Bluetooth API requires user interaction to select devices
      // We can't automatically discover all Bluetooth speakers
      // When user selects "Bluetooth", we'll prompt them to choose a device
      if (navigator.bluetooth && speaker.id === 'bluetooth-generic') {
        try {
          // Valid Bluetooth UUIDs for A2DP (Advanced Audio Distribution Profile):
          // Audio Sink: 0000110b-0000-1000-8000-00805f9b34fb
          // Audio Source: 0000110a-0000-1000-8000-00805f9b34fb
          
          const device = await navigator.bluetooth.requestDevice({
            filters: [
              { services: ['0000110b-0000-1000-8000-00805f9b34fb'] }, // A2DP Audio Sink
              { namePrefix: 'Speaker' },
              { namePrefix: 'Audio' },
              { namePrefix: 'BT' },
            ],
            optionalServices: ['0000110b-0000-1000-8000-00805f9b34fb']
          });
          
          if (device) {
            toast({
              title: "Bluetooth מחובר",
              description: `מחובר ל-${device.name || 'Bluetooth Device'}`,
            });
            // Note: Web Bluetooth API doesn't directly route audio
            // The user still needs to select the device in OS settings
            // But we've established the connection
          }
        } catch (bluetoothError: any) {
          // User cancelled or device not found
          if (bluetoothError.name === 'NotFoundError') {
            throw new Error("לא נמצא מכשיר Bluetooth");
          } else if (bluetoothError.name === 'SecurityError') {
            throw new Error("נדרשות הרשאות Bluetooth");
          } else if (bluetoothError.name === 'AbortError') {
            // User cancelled - don't show error, just return silently
            return;
          } else {
            // Other errors - show message
            throw new Error(bluetoothError.message || "שגיאה בחיבור Bluetooth");
          }
        }
      } else {
        // Bluetooth audio routing is handled by the OS
        // The user needs to select the Bluetooth device in their OS settings
        toast({
          title: "Bluetooth",
          description: "בחר רמקול Bluetooth בהגדרות המכשיר או במערכת ההפעלה",
        });
      }
    } catch (error: any) {
      // Re-throw to be handled by the caller
      throw error;
    }
  };

  const getSpeakerIcon = (type: Speaker['type']) => {
    switch (type) {
      case 'Chromecast':
        return <Cast className="w-4 h-4" />;
      case 'AirPlay':
        return <Airplay className="w-4 h-4" />;
      case 'Bluetooth':
        return <Bluetooth className="w-4 h-4" />;
      case 'DLNA':
      case 'Sonos':
        return <Wifi className="w-4 h-4" />;
      default:
        return <Radio className="w-4 h-4" />;
    }
  };

  const selectedSpeakerData = speakers.find(
    (s) => s.id === selectedSpeaker
  );

  // Check if Chromecast is connected
  const isChromecastConnected = selectedSpeakerData?.type === 'Chromecast' && chromecast.state.isConnected;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={selectedSpeaker ? "default" : "outline"}
          size="sm"
          className="gap-2 relative"
        >
          {isScanning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              מחפש...
            </>
          ) : (
            <>
              {selectedSpeakerData ? getSpeakerIcon(selectedSpeakerData.type) : <Radio className="w-4 h-4" />}
              {selectedSpeakerData ? selectedSpeakerData.name : "בחר רמקול"}
              {isChromecastConnected && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                  מחובר
                </Badge>
              )}
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center justify-between">
          רמקולים זמינים
          <Button
            variant="ghost"
            size="sm"
            onClick={async (e) => {
              e.stopPropagation();
              const count = await discoverSpeakers();
              toast({
                title: "סריקה הושלמה",
                description: `נמצאו ${count} רמקולים`,
              });
            }}
            className="h-6 px-2"
            disabled={isScanning}
            title="רענון - חיפוש רמקולים ברשת"
          >
            <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
          </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {speakers.length === 0 && !isScanning ? (
          <DropdownMenuItem disabled className="flex flex-col gap-1 items-start">
            <span>לא נמצאו רמקולים</span>
            <span className="text-xs text-muted-foreground">
              ודא שהמכשירים באותה רשת WiFi
            </span>
            <span className="text-xs text-muted-foreground">
              Chromecast SDK: {((window as any).cast?.framework || (window as any).chrome?.cast) ? '✅ זמין' : '❌ לא זמין'}
            </span>
            {((window as any).cast?.framework || (window as any).chrome?.cast) && (
              <span className="text-xs text-yellow-500">
                💡 נסה לבחור "Chromecast / Smart TV" כדי לראות את כל המכשירים
              </span>
            )}
          </DropdownMenuItem>
        ) : (
          speakers.map((speaker) => (
            <DropdownMenuItem
              key={speaker.id}
              onClick={() => handleSpeakerSelect(speaker.id)}
              className="flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2 flex-1">
                {getSpeakerIcon(speaker.type)}
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{speaker.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {speaker.type}
                    {speaker.type === 'Chromecast' && (
                      <>
                        {chromecast.state.isConnected && chromecast.state.device && (
                          <span className="text-green-500 mr-1"> • מחובר</span>
                        )}
                        {!chromecast.state.isConnected && speaker.id === 'chromecast-connect' && (
                          <span className="text-yellow-500 mr-1"> • לחץ לחיבור</span>
                        )}
                      </>
                    )}
                  </span>
                </div>
              </div>
              {selectedSpeaker === speaker.id && (
                <Check className="w-4 h-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))
        )}
        {selectedSpeaker && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                const speaker = speakers.find((s) => s.id === selectedSpeaker);
                if (speaker?.type === 'Chromecast' && chromecast.state.isConnected) {
                  await chromecast.disconnect();
                }
                onSpeakerChange(null);
                toast({
                  title: "רמקול מנותק",
                  description: "מנגן כעת במכשיר זה",
                });
              }}
              className="text-destructive cursor-pointer"
            >
              נתק רמקול
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UnifiedSpeakerSelector;

