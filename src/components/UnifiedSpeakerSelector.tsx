import { useState, useEffect, useRef } from "react";
import { Radio, Check, Loader2, RefreshCw, Cast, Airplay, Bluetooth, Wifi } from "lucide-react";
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

  useEffect(() => {
    // Get audio element reference
    audioRef.current = document.querySelector('audio') as HTMLAudioElement;
    
    // Initialize Cast API callback
    (window as any).__onGCastApiAvailable = function(isAvailable: boolean) {
      if (isAvailable) {
        discoverSpeakers();
      }
    };
    
    discoverSpeakers();
  }, []);

  const discoverSpeakers = async () => {
    setIsScanning(true);
    const discoveredSpeakers: Speaker[] = [];

    try {
      // 1. Chromecast / Google Cast
      if ((window as any).cast?.framework || (window as any).chrome?.cast) {
        try {
          const ctx = (window as any).cast?.framework?.CastContext?.getInstance();
          if (ctx) {
            discoveredSpeakers.push({
              id: 'chromecast-default',
              name: 'Chromecast / Google Cast',
              type: 'Chromecast'
            });
          }
        } catch (e) {
          console.log('Chromecast not available');
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

      // 3. DLNA/UPnP Discovery
      try {
        const dlnaSpeakers = await discoverDLNASpeakers();
        discoveredSpeakers.push(...dlnaSpeakers);
      } catch (e) {
        console.log('DLNA discovery error:', e);
      }

      // 4. Sonos Discovery (via UPnP)
      try {
        const sonosSpeakers = await discoverSonosSpeakers();
        discoveredSpeakers.push(...sonosSpeakers);
      } catch (e) {
        console.log('Sonos discovery error:', e);
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
      
      if (discoveredSpeakers.length === 0) {
        toast({
          title: "לא נמצאו רמקולים",
          description: "ודא שהרמקולים באותה רשת WiFi",
          variant: "destructive",
        });
      } else {
        toast({
          title: "גילוי הושלם",
          description: `נמצאו ${discoveredSpeakers.length} רמקולים`,
        });
      }
    } catch (error) {
      console.error('Error discovering speakers:', error);
      // Add default option if discovery fails
      setSpeakers([{
        id: 'browser-default',
        name: 'מכשיר זה',
        type: 'Browser'
      }]);
    } finally {
      setIsScanning(false);
    }
  };

  // DLNA/UPnP Discovery
  const discoverDLNASpeakers = async (): Promise<Speaker[]> => {
    const dlnaSpeakers: Speaker[] = [];
    
    try {
      // Try to discover via Netlify function or backend service
      const isNetlify = window.location.hostname.includes('netlify.app');
      const discoveryUrl = isNetlify
        ? `${window.location.origin}/.netlify/functions/discover-speakers?type=dlna`
        : `http://${window.location.hostname}:3001/api/discover-speakers?type=dlna`;
      
      try {
        const response = await fetch(discoveryUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.speakers && Array.isArray(data.speakers)) {
            dlnaSpeakers.push(...data.speakers.map((s: any) => ({
              id: s.id || `dlna-${s.name}`,
              name: s.name || s.friendlyName || 'DLNA Device',
              type: 'DLNA' as const,
              url: s.url,
              friendlyName: s.friendlyName,
            })));
          }
        }
      } catch (fetchError) {
        // If backend service is not available, try WebRTC-based discovery
        // or use a browser extension if available
        console.log('DLNA discovery service not available, trying alternative methods...');
        
        // Alternative: Try to discover via WebRTC or browser extension
        // This would require additional setup
      }
      
      // If no speakers found via service, try local discovery
      // Note: This is limited in browser due to CORS and SSDP requirements
      // For full DLNA support, a backend service or browser extension is recommended
      
    } catch (e) {
      console.log('DLNA discovery error:', e);
    }
    
    return dlnaSpeakers;
  };

  // Sonos Discovery
  const discoverSonosSpeakers = async (): Promise<Speaker[]> => {
    const sonosSpeakers: Speaker[] = [];
    
    try {
      // Sonos uses UPnP for discovery
      // Try to discover via Netlify function or backend service
      const isNetlify = window.location.hostname.includes('netlify.app');
      const discoveryUrl = isNetlify
        ? `${window.location.origin}/.netlify/functions/discover-speakers?type=sonos`
        : `http://${window.location.hostname}:3001/api/discover-speakers?type=sonos`;
      
      try {
        const response = await fetch(discoveryUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.speakers && Array.isArray(data.speakers)) {
            sonosSpeakers.push(...data.speakers.map((s: any) => ({
              id: s.id || `sonos-${s.name}`,
              name: s.name || s.friendlyName || 'Sonos Speaker',
              type: 'Sonos' as const,
              url: s.url,
              friendlyName: s.friendlyName,
            })));
          }
        }
      } catch (fetchError) {
        // If backend service is not available, try alternative methods
        console.log('Sonos discovery service not available, trying alternative methods...');
        
        // Alternative: Try to discover via Sonos API or browser extension
        // Sonos devices typically respond on port 1400
        // This would require additional setup
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
          await castToChromecast();
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
          // Play on current device
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
      const ctx = (window as any).cast?.framework?.CastContext?.getInstance();
      if (!ctx) {
        throw new Error("Chromecast לא זמין");
      }

      ctx.setOptions({
        receiverApplicationId: (window as any).chrome?.cast?.media?.DEFAULT_MEDIA_RECEIVER_APP_ID,
      });

      const session = ctx.getCurrentSession() || (await ctx.requestSession().catch(() => null));
      if (!session) {
        throw new Error("לא ניתן להתחבר ל-Chromecast");
      }

      if (!mediaUrl) {
        throw new Error("אין שיר נבחר");
      }

      // Get token for Netlify functions
      const accessToken = sessionStorage.getItem('gd_access_token');
      const finalUrl = accessToken && mediaUrl.includes('netlify') 
        ? `${mediaUrl}?token=${encodeURIComponent(accessToken)}`
        : mediaUrl;

      const mediaInfo = new (window as any).chrome.cast.media.MediaInfo(finalUrl, contentType);
      mediaInfo.metadata = new (window as any).chrome.cast.media.MusicTrackMediaMetadata();
      mediaInfo.metadata.title = title;
      mediaInfo.streamType = (window as any).chrome.cast.media.StreamType.BUFFERED;

      const request = new (window as any).chrome.cast.media.LoadRequest(mediaInfo);
      await session.loadMedia(request);
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

    // DLNA casting requires sending the media URL to the device
    // This typically requires a backend service or direct UPnP control
    // For now, we'll use a placeholder that can be extended
    
    // Example: POST to DLNA device's SetAVTransportURI action
    // const response = await fetch(`${speaker.url}/upnp/control/AVTransport`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'text/xml' },
    //   body: `<?xml version="1.0"?>...SetAVTransportURI...`
    // });
    
    throw new Error("DLNA casting דורש שירות backend");
  };

  const castToSonos = async (speaker: Speaker) => {
    if (!mediaUrl || !speaker.url) {
      throw new Error("אין שיר נבחר או URL של רמקול");
    }

    // Sonos uses UPnP for control
    // Similar to DLNA, this requires backend support
    throw new Error("Sonos casting דורש שירות backend");
  };

  const castToBluetooth = async (speaker: Speaker) => {
    // Bluetooth audio is handled by the browser/OS
    // We just need to ensure the audio element is set up correctly
    const audio = audioRef.current || document.querySelector('audio') as HTMLAudioElement;
    if (!audio) {
      throw new Error("לא נמצא נגן אודיו פעיל");
    }
    
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
            // User cancelled - don't show error, just return
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={selectedSpeaker ? "default" : "outline"}
          size="sm"
          className="gap-2"
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
            onClick={(e) => {
              e.stopPropagation();
              discoverSpeakers();
            }}
            className="h-6 px-2"
            disabled={isScanning}
          >
            <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
          </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {speakers.length === 0 && !isScanning ? (
          <DropdownMenuItem disabled>
            לא נמצאו רמקולים
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
              onClick={() => {
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

