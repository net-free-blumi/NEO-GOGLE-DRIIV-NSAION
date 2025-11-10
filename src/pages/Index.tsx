import { useState, useEffect, useRef } from "react";
import { Music, Radio, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MusicPlayer from "@/components/MusicPlayer";
import SongList from "@/components/SongList";
import UnifiedSpeakerSelector from "@/components/UnifiedSpeakerSelector";
import GoogleDriveConnect, { loadSongsFromDrive } from "@/components/GoogleDriveConnect";
import SettingsMenu from "@/components/SettingsMenu";
import { useToast } from "@/hooks/use-toast";
import VersionBadge from "@/components/VersionBadge";
import { useChromecastContext } from "@/contexts/ChromecastContext";

export interface Song {
  id: string;
  title: string;
  name?: string; // Alias for title (used in some places)
  artist: string;
  album?: string;
  duration: number;
  url: string;
  coverUrl?: string;
  folderPath?: string;
  fileSize?: string;
  modifiedTime?: string;
}

type RepeatMode = 'none' | 'one' | 'all';

const Index = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(() => {
    // Load saved song from localStorage
    try {
      const saved = localStorage.getItem('last_song');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.log('Error loading saved song:', e);
    }
    return null;
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpeaker, setSelectedSpeaker] = useState<string | null>(() => {
    // Load saved speaker from localStorage
    try {
      const saved = localStorage.getItem('last_speaker');
      if (saved) {
        return saved;
      }
    } catch (e) {
      console.log('Error loading saved speaker:', e);
    }
    return null;
  });
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('none');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();
  
  // Get Chromecast context for state sync
  const chromecast = useChromecastContext();
  
  // Check if Chromecast is active
  const speakers = JSON.parse(sessionStorage.getItem('available_speakers') || '[]');
  const selectedSpeakerData = speakers.find((s: any) => s.id === selectedSpeaker);
  const isChromecastActive = selectedSpeakerData?.type === 'Chromecast' && chromecast.state.isConnected;
  
  // Sync isPlaying state from Chromecast - CRITICAL for UI sync!
  // Use ref to track if we're updating from user action to avoid loops
  const isUserActionRef = useRef(false);
  
  useEffect(() => {
    if (isChromecastActive && chromecast.state.isPlaying !== isPlaying && !isUserActionRef.current) {
      // Only sync if it's not a user action (to avoid loops)
      setIsPlaying(chromecast.state.isPlaying);
    }
    // Reset flag after sync
    isUserActionRef.current = false;
  }, [isChromecastActive, chromecast.state.isPlaying]);
  
  // Track user actions
  const handlePlayPause = () => {
    isUserActionRef.current = true;
    setIsPlaying(!isPlaying);
  };
  
  // Save current song to localStorage
  useEffect(() => {
    if (currentSong) {
      try {
        localStorage.setItem('last_song', JSON.stringify(currentSong));
      } catch (e) {
        console.log('Error saving song:', e);
      }
    }
  }, [currentSong]);
  
  // Save selected speaker to localStorage
  useEffect(() => {
    if (selectedSpeaker) {
      try {
        localStorage.setItem('last_speaker', selectedSpeaker);
      } catch (e) {
        console.log('Error saving speaker:', e);
      }
    }
  }, [selectedSpeaker]);
  const handleLogout = () => {
    sessionStorage.removeItem("gd_access_token");
    sessionStorage.removeItem("gd_token_expires_at");
    sessionStorage.removeItem("gd_songs");
    sessionStorage.removeItem("gd_user_email");
    sessionStorage.removeItem("gd_is_authenticated");
    setSongs([]);
    setCurrentSong(null);
  };

  // Check for stored songs on mount (after OAuth callback)
  useEffect(() => {
    const isAuthenticated = sessionStorage.getItem('gd_is_authenticated') === 'true';
    const userEmail = sessionStorage.getItem('gd_user_email');
    const REQUIRED_EMAIL = '123123mushh@gmail.com';
    
    // Only load songs if authenticated with correct email
    if (isAuthenticated && userEmail === REQUIRED_EMAIL) {
      const storedSongs = sessionStorage.getItem('gd_songs');
      if (storedSongs) {
        try {
          const parsedSongs = JSON.parse(storedSongs);
          setSongs(parsedSongs);
        } catch (e) {
          console.error('Error parsing stored songs:', e);
          sessionStorage.removeItem('gd_songs');
        }
      }
    }

    // Load repeat mode from sessionStorage
    const storedRepeatMode = sessionStorage.getItem('repeat_mode') as RepeatMode | null;
    if (storedRepeatMode && ['none', 'one', 'all'].includes(storedRepeatMode)) {
      setRepeatMode(storedRepeatMode);
    }
  }, []);

  // Save repeat mode to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('repeat_mode', repeatMode);
  }, [repeatMode]);

  const filteredSongs = songs.filter(
    (song) =>
      song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSongSelect = (song: Song) => {
    setCurrentSong(song);
    setIsPlaying(true);
  };

  const handleStop = () => {
    // Stop completely - clear song, reset position to 0, pause, and clear saved position
    if (currentSong) {
      sessionStorage.removeItem(`song_position_${currentSong.id}`);
      setIsPlaying(false);
      setCurrentSong(null); // Clear the song completely - user needs to select a new one
      // The MusicPlayer component will handle resetting the audio position
    }
  };

  const handleNext = () => {
    if (!currentSong || songs.length === 0) return;
    
    if (repeatMode === 'one') {
      // Repeat current song - handled by MusicPlayer
      return;
    }
    
    const currentIndex = songs.findIndex((s) => s.id === currentSong.id);
    if (repeatMode === 'all') {
      // Loop through all songs
      const nextSong = songs[(currentIndex + 1) % songs.length];
      setCurrentSong(nextSong);
      setIsPlaying(true);
    } else {
      // Continue to next, stop at end
      if (currentIndex < songs.length - 1) {
        const nextSong = songs[currentIndex + 1];
        setCurrentSong(nextSong);
        setIsPlaying(true);
      } else {
        setIsPlaying(false);
      }
    }
  };

  const handlePrevious = () => {
    if (!currentSong) return;
    const currentIndex = songs.findIndex((s) => s.id === currentSong.id);
    const prevSong = songs[(currentIndex - 1 + songs.length) % songs.length];
    setCurrentSong(prevSong);
    setIsPlaying(true);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const accessToken = sessionStorage.getItem('gd_access_token');
      const expiresAt = sessionStorage.getItem('gd_token_expires_at');
      
      if (!accessToken || !expiresAt || parseInt(expiresAt) <= Date.now()) {
        toast({
          title: 'שגיאה',
          description: 'נא להתחבר מחדש ל-Google Drive',
          variant: 'destructive',
        });
        setIsRefreshing(false);
        return;
      }

      const refreshedSongs = await loadSongsFromDrive(accessToken);
      sessionStorage.setItem('gd_songs', JSON.stringify(refreshedSongs));
      setSongs(refreshedSongs);
      
      // If current song was removed, clear it
      if (currentSong && !refreshedSongs.find(s => s.id === currentSong.id)) {
        setCurrentSong(null);
        setIsPlaying(false);
      }
      
      toast({
        title: 'רענון הושלם',
        description: `נמצאו ${refreshedSongs.length} שירים`,
      });
    } catch (error) {
      console.error('Error refreshing songs:', error);
      toast({
        title: 'שגיאה ברענון',
        description: error instanceof Error ? error.message : 'לא הצלחנו לרענן את השירים',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-lg sticky top-0 z-50">
        <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4 flex-wrap">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg flex-shrink-0">
                <Music className="w-4 h-4 sm:w-6 sm:h-6 text-primary-foreground" />
              </div>
              <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                CloudTunes
              </h1>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 flex-wrap flex-1 justify-end">
              <div className="relative w-full sm:w-64 order-3 sm:order-1">
                <Search className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="חפש שירים..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 sm:pl-10 bg-secondary border-border text-sm sm:text-base h-8 sm:h-10"
                />
              </div>
              <div className="flex items-center gap-1 sm:gap-2 order-1 sm:order-2">
                <UnifiedSpeakerSelector
                  selectedSpeaker={selectedSpeaker}
                  onSpeakerChange={setSelectedSpeaker}
                  mediaUrl={currentSong?.url}
                  contentType="audio/mpeg"
                  title={currentSong?.title}
                />
                <SettingsMenu onLogout={handleLogout} isLoggedIn={songs.length > 0} />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 pb-24 sm:pb-32">
        {songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 sm:gap-6 px-2">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center animate-pulse">
              <Music className="w-10 h-10 sm:w-12 sm:h-12 text-primary" />
            </div>
            <div className="text-center space-y-2 px-4">
              <h2 className="text-2xl sm:text-3xl font-bold">ברוכים הבאים ל-CloudTunes</h2>
              <p className="text-sm sm:text-base text-muted-foreground max-w-md">
                חבר את Google Drive שלך כדי להתחיל לנגן את המוזיקה שלך
              </p>
            </div>
            <GoogleDriveConnect onSongsLoaded={setSongs} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:gap-8">
            <SongList
              songs={filteredSongs}
              currentSong={currentSong}
              onSongSelect={handleSongSelect}
              onRefresh={handleRefresh}
              isRefreshing={isRefreshing}
            />
          </div>
        )}
      </main>

      {/* Music Player */}
      {currentSong && (
        <MusicPlayer
          song={currentSong}
          isPlaying={isPlaying}
          onPlayPause={handlePlayPause}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onStop={handleStop}
          selectedSpeaker={selectedSpeaker}
          onSpeakerChange={setSelectedSpeaker}
          repeatMode={repeatMode}
          onRepeatModeChange={setRepeatMode}
        />
      )}

      {/* Version Badge */}
      <VersionBadge />
    </div>
  );
};

export default Index;
