import { useState, useEffect } from "react";
import { Radio, Check, Loader2 } from "lucide-react";
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

interface SpeakerSelectorProps {
  selectedSpeaker: string | null;
  onSpeakerChange: (speaker: string | null) => void;
}

interface Speaker {
  id: string;
  name: string;
  type: string;
}

const SpeakerSelector = ({
  selectedSpeaker,
  onSpeakerChange,
}: SpeakerSelectorProps) => {
  const { toast } = useToast();
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    (window as any).__onGCastApiAvailable = function(isAvailable: boolean) {
      if (isAvailable) discoverSpeakers();
    };
    discoverSpeakers();
  }, []);

  const discoverSpeakers = async () => {
    setIsScanning(true);
    const discoveredSpeakers: Speaker[] = [];

    try {
      // Detect Chromecast availability (sender SDK)
      if ((window as any).cast && (window as any).chrome?.cast) {
        discoveredSpeakers.push({
          id: 'chromecast-default',
          name: 'Chromecast',
          type: 'Chromecast'
        });
      }

      // Detect AirPlay devices (Safari only)
      if ('WebKitPlaybackTargetAvailabilityEvent' in window) {
        discoveredSpeakers.push({
          id: 'airplay-default',
          name: 'AirPlay',
          type: 'AirPlay'
        });
      }

      // Check for media session API support
      if ('mediaSession' in navigator) {
        discoveredSpeakers.push({
          id: 'browser-default',
          name: 'מכשיר זה',
          type: 'Browser'
        });
      }

      setSpeakers(discoveredSpeakers);
      
      if (discoveredSpeakers.length === 0) {
        toast({
          title: "לא נמצאו רמקולים",
          description: "ודא שהרמקולים באותה רשת WiFi",
          variant: "destructive",
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

  const handleSpeakerSelect = (speakerId: string) => {
    const speaker = speakers.find((s) => s.id === speakerId);
    onSpeakerChange(speakerId);
    toast({
      title: "רמקול מחובר",
      description: `מנגן כעת ב-${speaker?.name}`,
    });
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
              <Radio className="w-4 h-4" />
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
          >
            רענן
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
              <div className="flex flex-col gap-1">
                <span className="font-medium">{speaker.name}</span>
                <span className="text-xs text-muted-foreground">
                  {speaker.type}
                </span>
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

export default SpeakerSelector;
