import { useEffect, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Song } from "@/pages/Index";

interface MusicPlayerProps {
  song: Song;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
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

  // Load song and set up audio element
  useEffect(() => {
    if (!audioRef.current || !song.url) return;

    const audio = audioRef.current;
    setIsLoading(true);
    setIsBuffering(false);
    setDuration(0);
    setCurrentTime(0);
    
    // Build URL with token if needed
    const isNetlify = song.url.includes('.netlify.app') || song.url.includes('netlify/functions');
    const accessToken = sessionStorage.getItem('gd_access_token');
    
    let finalUrl = song.url;
    if (isNetlify && accessToken) {
      finalUrl = `${song.url}?token=${encodeURIComponent(accessToken)}`;
    }
    
    audio.src = finalUrl;
    audio.currentTime = 0;
    
    // Load metadata
    audio.load();
  }, [song.id, song.url]);

  // Handle play/pause
  useEffect(() => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.play().catch(err => {
        console.error('Play error:', err);
        setIsLoading(false);
      });
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  // Update duration when metadata loads
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      setIsLoading(false);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
      setIsBuffering(false);
    };

    const handleWaiting = () => {
      setIsBuffering(true);
    };

    const handlePlaying = () => {
      setIsBuffering(false);
    };

    const handleError = (e: any) => {
      console.error('Audio error:', e);
      setIsLoading(false);
      setIsBuffering(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('playing', handlePlaying);
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

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current && duration > 0) {
      const seekTime = value[0];
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
        preload="metadata"
      />

      <div className="fixed bottom-0 left-0 right-0 bg-[hsl(var(--player-bg))] border-t border-border backdrop-blur-xl z-50">
        <div className="container mx-auto px-4 py-4">
          {/* Progress Bar */}
          <div className="mb-4">
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={1}
              onValueChange={handleSeek}
              className="w-full cursor-pointer"
              disabled={duration === 0 || isLoading}
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
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

          <div className="flex items-center justify-between gap-4">
            {/* Song Info */}
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0 shadow-lg">
                {song.coverUrl ? (
                  <img
                    src={song.coverUrl}
                    alt={song.title}
                    className="w-full h-full rounded-lg object-cover"
                  />
                ) : (
                  <span className="text-2xl">🎵</span>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground truncate">
                  {song.title}
                </h3>
                <p className="text-sm text-muted-foreground truncate">
                  {song.artist}
                </p>
                {selectedSpeaker && (
                  <p className="text-xs text-primary flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    מנגן ב-{selectedSpeaker}
                  </p>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              {onRepeatModeChange && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRepeatModeClick}
                  className="hover:bg-secondary/80 transition-colors"
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
                className="hover:bg-secondary/80 transition-colors"
              >
                <SkipBack className="w-5 h-5" />
              </Button>
              <Button
                variant="default"
                size="icon"
                onClick={onPlayPause}
                className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent hover:scale-105 transition-all shadow-[var(--shadow-player)]"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-6 h-6" fill="currentColor" />
                ) : (
                  <Play className="w-6 h-6" fill="currentColor" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onNext}
                className="hover:bg-secondary/80 transition-colors"
              >
                <SkipForward className="w-5 h-5" />
              </Button>
            </div>

            {/* Volume Control */}
            <div className="flex items-center gap-2 flex-1 justify-end">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMuted(!isMuted)}
                className="flex-shrink-0"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </Button>
              <Slider
                value={[volume]}
                max={100}
                step={1}
                onValueChange={(v) => setVolume(v[0])}
                className="w-24 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MusicPlayer;
