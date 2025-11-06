import { useEffect, useState } from "react";
import { Cast, Airplay } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

declare global {
  interface Window {
    cast: any;
    chrome: any;
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
    webkit?: any;
  }
}

interface CastButtonProps {
  mediaUrl: string;
  contentType?: string;
  title?: string;
}

const CastButton = ({ mediaUrl, contentType = "audio/mpeg", title = "Track" }: CastButtonProps) => {
  const [castAvailable, setCastAvailable] = useState(false);
  const [airplayAvailable, setAirplayAvailable] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // The Cast SDK is loaded once in index.html; just detect availability
    (window as any).__onGCastApiAvailable = (isAvailable: boolean) => {
      if (isAvailable) setCastAvailable(true);
    };
    if ((window as any).cast?.framework) {
      setCastAvailable(true);
    }
    // AirPlay (Safari)
    if ('WebKitPlaybackTargetAvailabilityEvent' in window) {
      setAirplayAvailable(true);
    }
  }, []);

  async function castToChromecast() {
    try {
      const ctx = window.cast?.framework?.CastContext?.getInstance();
      if (!ctx) {
        toast({
          title: "שגיאה",
          description: "Chromecast לא זמין",
          variant: "destructive",
        });
        return;
      }

      ctx.setOptions({
        receiverApplicationId: window.chrome?.cast?.media?.DEFAULT_MEDIA_RECEIVER_APP_ID,
      });

      const session = ctx.getCurrentSession() || (await ctx.requestSession().catch(() => null));
      if (!session) {
        toast({
          title: "שגיאה",
          description: "לא ניתן להתחבר ל-Chromecast",
          variant: "destructive",
        });
        return;
      }

      // Get token for Netlify functions
      const accessToken = sessionStorage.getItem('gd_access_token');
      const finalUrl = accessToken && mediaUrl.includes('netlify') 
        ? `${mediaUrl}?token=${encodeURIComponent(accessToken)}`
        : mediaUrl;

      const mediaInfo = new window.chrome.cast.media.MediaInfo(finalUrl, contentType);
      mediaInfo.metadata = new window.chrome.cast.media.MusicTrackMediaMetadata();
      mediaInfo.metadata.title = title;
      mediaInfo.streamType = window.chrome.cast.media.StreamType.BUFFERED;

      const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
      await session.loadMedia(request);

      toast({
        title: "שידור ל-Chromecast",
        description: `משדר "${title}" ל-Chromecast`,
      });
    } catch (e: any) {
      console.error('Cast error:', e);
      toast({
        title: "שגיאה בשידור",
        description: e?.message || "לא ניתן לשדר ל-Chromecast",
        variant: "destructive",
      });
    }
  }

  function castToAirPlay() {
    try {
      const audio = document.querySelector('audio') as HTMLAudioElement;
      if (!audio) {
        toast({
          title: "שגיאה",
          description: "לא נמצא נגן אודיו פעיל",
          variant: "destructive",
        });
        return;
      }

      // AirPlay is handled natively by Safari
      // We just need to ensure the audio element is set up correctly
      if ('webkitShowPlaybackTargetPicker' in audio) {
        (audio as any).webkitShowPlaybackTargetPicker();
        toast({
          title: "שידור ל-AirPlay",
          description: "בחר מכשיר AirPlay",
        });
      } else {
        toast({
          title: "AirPlay לא זמין",
          description: "AirPlay זמין רק ב-Safari",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      console.error('AirPlay error:', e);
      toast({
        title: "שגיאה בשידור",
        description: e?.message || "לא ניתן לשדר ל-AirPlay",
        variant: "destructive",
      });
    }
  }

  if (!castAvailable && !airplayAvailable) {
    return null;
  }

  return (
    <div className="flex gap-2">
      {castAvailable && (
        <Button
          variant="outline"
          size="sm"
          onClick={castToChromecast}
          className="gap-2"
        >
          <Cast className="w-4 h-4" />
          Chromecast
        </Button>
      )}
      {airplayAvailable && (
        <Button
          variant="outline"
          size="sm"
          onClick={castToAirPlay}
          className="gap-2"
        >
          <Airplay className="w-4 h-4" />
          AirPlay
        </Button>
      )}
    </div>
  );
};

export default CastButton;
