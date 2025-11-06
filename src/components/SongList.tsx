import { Play, Pause, Folder, ChevronRight, ChevronDown, Grid3x3, List, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Song } from "@/pages/Index";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState, useMemo, useEffect, useRef } from "react";

interface SongListProps {
  songs: Song[];
  currentSong: Song | null;
  onSongSelect: (song: Song) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

interface FolderNode {
  name: string;
  fullPath: string;
  songs: Song[];
  subfolders: Map<string, FolderNode>;
}

type ViewMode = 'grid' | 'list';

const SongList = ({ songs, currentSong, onSongSelect, onRefresh, isRefreshing }: SongListProps) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const stored = sessionStorage.getItem('song_view_mode') as ViewMode | null;
    return stored === 'grid' || stored === 'list' ? stored : 'grid';
  });
  // Load durations from sessionStorage (saved when songs are played)
  const songDurations = useMemo(() => {
    const durations = new Map<string, number>();
    try {
      const stored = sessionStorage.getItem('song_durations');
      if (stored) {
        const parsed = JSON.parse(stored);
        Object.entries(parsed).forEach(([id, duration]) => {
          durations.set(id, duration as number);
        });
      }
    } catch (e) {
      console.warn('Failed to load durations from storage:', e);
    }
    return durations;
  }, [currentSong?.id]); // Update when current song changes (duration might be loaded)

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds === 0 || isNaN(seconds)) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatFileSize = (bytes?: string) => {
    if (!bytes) return '';
    const size = parseInt(bytes);
    if (isNaN(size)) return '';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  // Build folder tree structure
  const folderTree = useMemo(() => {
    const root: FolderNode = {
      name: '',
      fullPath: '',
      songs: [],
      subfolders: new Map(),
    };

    songs.forEach(song => {
      const path = song.folderPath || '';
      if (!path) {
        root.songs.push(song);
        return;
      }

      // Split path by " / " to get folder hierarchy
      const parts = path.split(' / ').filter(p => p);
      let current = root;

      parts.forEach((part, index) => {
        if (!current.subfolders.has(part)) {
          const fullPath = parts.slice(0, index + 1).join(' / ');
          current.subfolders.set(part, {
            name: part,
            fullPath,
            songs: [],
            subfolders: new Map(),
          });
        }
        current = current.subfolders.get(part)!;
      });

      current.songs.push(song);
    });

    return root;
  }, [songs]);

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  // Render folder recursively
  const renderFolder = (folder: FolderNode, level: number = 0) => {
    const hasContent = folder.songs.length > 0 || folder.subfolders.size > 0;
    if (!hasContent) return null;

    const isExpanded = expandedFolders.has(folder.fullPath);
    const indentStyle = level > 0 ? { marginRight: `${level * 1}rem` } : {};

    return (
      <div key={folder.fullPath || 'root'} style={indentStyle}>
        {folder.name && (
          <Collapsible
            open={isExpanded}
            onOpenChange={() => toggleFolder(folder.fullPath)}
          >
            <CollapsibleTrigger asChild>
              <div className="p-3 sm:p-4 hover:bg-secondary/30 cursor-pointer transition-colors flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <Folder className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm sm:text-base text-foreground truncate">
                      {folder.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {folder.songs.length} שירים
                      {folder.subfolders.size > 0 && ` • ${folder.subfolders.size} תיקיות`}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </span>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-r-2 border-border/50 mr-4 sm:mr-6">
                {/* Render subfolders first */}
                {Array.from(folder.subfolders.values())
                  .sort((a, b) => a.name.localeCompare(b.name, 'he-IL'))
                  .map(subfolder => renderFolder(subfolder, level + 1))}
                
                {/* Render songs in this folder */}
                {folder.songs.length > 0 && (
                  <div className="divide-y divide-border/50">
                    {folder.songs.map((song, index) => {
                      const isCurrentSong = currentSong?.id === song.id;
                      return (
                        <div
                          key={song.id}
                          className={`group flex items-center gap-2 sm:gap-4 p-2 sm:p-4 hover:bg-secondary/50 transition-all cursor-pointer ${
                            isCurrentSong ? "bg-secondary/70" : ""
                          }`}
                          onClick={() => onSongSelect(song)}
                        >
                          {/* Index / Play Button */}
                          <div className="w-6 sm:w-8 text-center flex-shrink-0">
                            {isCurrentSong ? (
                              <div className="flex items-center justify-center">
                                <div className="w-3 sm:w-4 flex gap-0.5 items-end">
                                  <span className="w-0.5 sm:w-1 bg-primary animate-[wave_0.8s_ease-in-out_infinite] h-2 sm:h-3" />
                                  <span className="w-0.5 sm:w-1 bg-primary animate-[wave_0.8s_ease-in-out_0.1s_infinite] h-3 sm:h-4" />
                                  <span className="w-0.5 sm:w-1 bg-primary animate-[wave_0.8s_ease-in-out_0.2s_infinite] h-1.5 sm:h-2" />
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground group-hover:hidden text-xs">
                                {index + 1}
                              </span>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`w-6 h-6 sm:w-8 sm:h-8 hidden group-hover:inline-flex ${
                                isCurrentSong ? "inline-flex" : ""
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSongSelect(song);
                              }}
                            >
                              {isCurrentSong ? (
                                <Pause className="w-3 h-3 sm:w-4 sm:h-4" />
                              ) : (
                                <Play className="w-3 h-3 sm:w-4 sm:h-4" />
                              )}
                            </Button>
                          </div>

                          {/* Album Art */}
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                            {song.coverUrl ? (
                              <img
                                src={song.coverUrl}
                                alt={song.title}
                                className="w-full h-full rounded-lg object-cover"
                              />
                            ) : (
                              <span className="text-lg sm:text-xl">🎵</span>
                            )}
                          </div>

                          {/* Song Info */}
                          <div className="flex-1 min-w-0">
                            <h3
                              className={`font-medium truncate text-sm sm:text-base ${
                                isCurrentSong ? "text-primary" : "text-foreground"
                              }`}
                            >
                              {song.title}
                            </h3>
                            <div className="flex items-center gap-1 sm:gap-2 text-xs text-muted-foreground mt-0.5 sm:mt-1 flex-wrap">
                              {song.artist && <span className="truncate">{song.artist}</span>}
                              {song.fileSize && (
                                <>
                                  {song.artist && <span className="hidden sm:inline">•</span>}
                                  <span className="hidden sm:inline">{formatFileSize(song.fileSize)}</span>
                                </>
                              )}
                              {songDurations.get(song.id) || song.duration ? (
                                <>
                                  {(song.artist || song.fileSize) && <span className="hidden sm:inline">•</span>}
                                  <span className="hidden sm:inline">{formatDuration(songDurations.get(song.id) || song.duration || 0)}</span>
                                </>
                              ) : null}
                            </div>
                          </div>

                          {/* Duration */}
                          <div className="text-xs sm:text-sm text-muted-foreground flex-shrink-0">
                            {formatDuration(songDurations.get(song.id) || song.duration || 0)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
        
        {/* Render root level songs if any */}
        {!folder.name && folder.songs.length > 0 && (
          <div className="divide-y divide-border/50">
            {folder.songs.map((song, index) => {
              const isCurrentSong = currentSong?.id === song.id;
              return (
                <div
                  key={song.id}
                  className={`group flex items-center gap-2 sm:gap-4 p-2 sm:p-4 hover:bg-secondary/50 transition-all cursor-pointer ${
                    isCurrentSong ? "bg-secondary/70" : ""
                  }`}
                  onClick={() => onSongSelect(song)}
                >
                  <div className="w-6 sm:w-8 text-center flex-shrink-0">
                    {isCurrentSong ? (
                      <div className="flex items-center justify-center">
                        <div className="w-3 sm:w-4 flex gap-0.5 items-end">
                          <span className="w-0.5 sm:w-1 bg-primary animate-[wave_0.8s_ease-in-out_infinite] h-2 sm:h-3" />
                          <span className="w-0.5 sm:w-1 bg-primary animate-[wave_0.8s_ease-in-out_0.1s_infinite] h-3 sm:h-4" />
                          <span className="w-0.5 sm:w-1 bg-primary animate-[wave_0.8s_ease-in-out_0.2s_infinite] h-1.5 sm:h-2" />
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground group-hover:hidden text-xs">
                        {index + 1}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`w-6 h-6 sm:w-8 sm:h-8 hidden group-hover:inline-flex ${
                        isCurrentSong ? "inline-flex" : ""
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSongSelect(song);
                      }}
                    >
                      {isCurrentSong ? (
                        <Pause className="w-3 h-3 sm:w-4 sm:h-4" />
                      ) : (
                        <Play className="w-3 h-3 sm:w-4 sm:h-4" />
                      )}
                    </Button>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                    {song.coverUrl ? (
                      <img src={song.coverUrl} alt={song.title} className="w-full h-full rounded-lg object-cover" />
                    ) : (
                      <span className="text-lg sm:text-xl">🎵</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-medium truncate text-sm sm:text-base ${isCurrentSong ? "text-primary" : "text-foreground"}`}>
                      {song.title}
                    </h3>
                    <div className="flex items-center gap-1 sm:gap-2 text-xs text-muted-foreground mt-0.5 sm:mt-1 flex-wrap">
                      {song.artist && <span className="truncate">{song.artist}</span>}
                      {song.fileSize && (
                        <>
                          {song.artist && <span className="hidden sm:inline">•</span>}
                          <span className="hidden sm:inline">{formatFileSize(song.fileSize)}</span>
                        </>
                      )}
                      {songDurations.get(song.id) || song.duration ? (
                        <>
                          {(song.artist || song.fileSize) && <span className="hidden sm:inline">•</span>}
                          <span className="hidden sm:inline">{formatDuration(songDurations.get(song.id) || song.duration || 0)}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground flex-shrink-0">
                    {formatDuration(songDurations.get(song.id) || song.duration || 0)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Save view mode to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('song_view_mode', viewMode);
  }, [viewMode]);

  // Don't expand folders by default - keep them collapsed
  // User must click to open folders

  // Don't preload durations - it causes too much data usage
  // Duration will be shown when song is played (from MusicPlayer)
  
  // Force re-render when current song changes to update durations
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    // Trigger re-render to update durations from sessionStorage
    forceUpdate(prev => prev + 1);
  }, [currentSong?.id]);

  // Get all songs from all folders for grid view
  const allSongs = useMemo(() => {
    const collectSongs = (folder: FolderNode): Song[] => {
      const result: Song[] = [...folder.songs];
      folder.subfolders.forEach(subfolder => {
        result.push(...collectSongs(subfolder));
      });
      return result;
    };
    return collectSongs(folderTree);
  }, [folderTree]);

  // Render grid view with collapsible folders
  const renderGridView = () => {
    // Render folder card for grid view
    const renderFolderCard = (folder: FolderNode) => {
      const isExpanded = expandedFolders.has(folder.fullPath);
      const totalSongs = (() => {
        const countSongs = (f: FolderNode): number => {
          let count = f.songs.length;
          f.subfolders.forEach(subfolder => {
            count += countSongs(subfolder);
          });
          return count;
        };
        return countSongs(folder);
      })();

      return (
        <div
          key={folder.fullPath}
          className="group relative bg-secondary/30 rounded-lg p-4 hover:bg-secondary/50 transition-all cursor-pointer border border-border/50"
          onClick={() => toggleFolder(folder.fullPath)}
        >
          {/* Folder Icon */}
          <div className="relative aspect-square w-full mb-3 rounded-lg overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <Folder className="w-16 h-16 sm:w-20 sm:h-20 text-primary" />
            {/* Expand/Collapse Indicator */}
            <div className="absolute top-2 right-2">
              {isExpanded ? (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
          </div>
          {/* Folder Info */}
          <div className="min-w-0">
            <h4 className="font-medium truncate text-sm sm:text-base text-foreground">
              {folder.name}
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              {totalSongs} שירים
              {folder.subfolders.size > 0 && ` • ${folder.subfolders.size} תיקיות`}
            </p>
          </div>
        </div>
      );
    };

    // Render folder tree recursively for grid view
    const renderFolderGrid = (folder: FolderNode, level: number = 0): JSX.Element | null => {
      // Skip root folder display (empty name means root)
      if (!folder.name && level === 0) {
        // Render top-level folders as grid, skip root folder name
        // Also filter out "all music" folder if it exists
        const topLevelFolders = Array.from(folder.subfolders.values())
          .filter(subfolder => {
            // Remove "all music" folder from display
            const folderName = subfolder.name.toLowerCase();
            return !folderName.includes('all music') && !folderName.includes('allmusic');
          })
          .sort((a, b) => a.name.localeCompare(b.name, 'he-IL'));
        
        // If "all music" folder exists, get its contents instead
        const allMusicFolder = Array.from(folder.subfolders.values())
          .find(subfolder => {
            const folderName = subfolder.name.toLowerCase();
            return folderName.includes('all music') || folderName.includes('allmusic');
          });
        
        // If we found "all music" folder, use its contents as top-level folders
        const foldersToDisplay = allMusicFolder 
          ? Array.from(allMusicFolder.subfolders.values())
              .sort((a, b) => a.name.localeCompare(b.name, 'he-IL'))
          : topLevelFolders;

        return (
          <>
            {/* Render top-level folders as grid */}
            {foldersToDisplay.length > 0 && (
              <div className="mb-8">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                  {foldersToDisplay.map((subfolder) => renderFolderCard(subfolder))}
                </div>
              </div>
            )}
            {/* Render expanded folder contents - only show if folder is expanded */}
            {foldersToDisplay.map((subfolder) => {
              const isExpanded = expandedFolders.has(subfolder.fullPath);
              // Don't render content if folder is not expanded
              if (!isExpanded) return null;
              
              return (
                <div key={subfolder.fullPath} className="mb-8">
                  {/* Render subfolders as grid */}
                  {subfolder.subfolders.size > 0 && (
                    <div className="mb-6">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                        {Array.from(subfolder.subfolders.values())
                          .sort((a, b) => a.name.localeCompare(b.name, 'he-IL'))
                          .map(subsubfolder => renderFolderCard(subsubfolder))}
                      </div>
                    </div>
                  )}
                  {/* Render expanded subfolders contents */}
                  {Array.from(subfolder.subfolders.values())
                    .sort((a, b) => a.name.localeCompare(b.name, 'he-IL'))
                    .map(subsubfolder => {
                      const isSubExpanded = expandedFolders.has(subsubfolder.fullPath);
                      if (!isSubExpanded) return null;
                      
                      return (
                        <div key={subsubfolder.fullPath} className="mb-6">
                          <div className="flex items-center gap-2 mb-4">
                            <Folder className="w-5 h-5 text-primary" />
                            <h3 className="text-lg font-semibold">{subsubfolder.name}</h3>
                            <span className="text-sm text-muted-foreground">
                              ({subsubfolder.songs.length} שירים
                              {subsubfolder.subfolders.size > 0 && `, ${subsubfolder.subfolders.size} תיקיות`})
                            </span>
                          </div>
                          {/* Render nested subfolders as grid */}
                          {subsubfolder.subfolders.size > 0 && (
                            <div className="mb-4">
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                                {Array.from(subsubfolder.subfolders.values())
                                  .sort((a, b) => a.name.localeCompare(b.name, 'he-IL'))
                                  .map(nestedFolder => renderFolderCard(nestedFolder))}
                              </div>
                            </div>
                          )}
                          {/* Render expanded nested subfolders */}
                          {Array.from(subsubfolder.subfolders.values())
                            .sort((a, b) => a.name.localeCompare(b.name, 'he-IL'))
                            .map(nestedFolder => {
                              const isNestedExpanded = expandedFolders.has(nestedFolder.fullPath);
                              if (!isNestedExpanded) return null;
                              
                              return (
                                <div key={nestedFolder.fullPath} className="mb-4">
                                  <div className="flex items-center gap-2 mb-3">
                                    <Folder className="w-4 h-4 text-primary" />
                                    <h4 className="text-base font-semibold">{nestedFolder.name}</h4>
                                    <span className="text-xs text-muted-foreground">
                                      ({nestedFolder.songs.length} שירים)
                                    </span>
                                  </div>
                                  {nestedFolder.songs.length > 0 && (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 mb-4">
                                      {nestedFolder.songs.map((song) => renderSongCard(song))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          {/* Render songs in this subfolder */}
                          {subsubfolder.songs.length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 mb-4">
                              {subsubfolder.songs.map((song) => renderSongCard(song))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  {/* Render songs in this folder */}
                  {subfolder.songs.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 mb-4">
                      {subfolder.songs.map((song) => renderSongCard(song))}
                    </div>
                  )}
                </div>
              );
            })}
            {/* Don't render root level songs - they should be inside folders */}
          </>
        );
      }
      
      // For nested folders (level > 1), render as collapsible sections
      const isExpanded = expandedFolders.has(folder.fullPath);
      const hasContent = folder.songs.length > 0 || folder.subfolders.size > 0;
      
      if (!hasContent) return null;
      
      return (
        <div key={folder.fullPath} className="mb-8 last:mb-0">
          {/* Folder Header - Collapsible */}
          <Collapsible
            open={isExpanded}
            onOpenChange={() => toggleFolder(folder.fullPath)}
          >
            <CollapsibleTrigger asChild>
              <div className="flex items-center gap-2 mb-4 cursor-pointer hover:bg-secondary/30 p-2 rounded-lg transition-colors">
                <Folder className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">{folder.name}</h3>
                <span className="text-sm text-muted-foreground">({folder.songs.length} שירים</span>
                {folder.subfolders.size > 0 && (
                  <span className="text-sm text-muted-foreground">, {folder.subfolders.size} תיקיות</span>
                )}
                <span className="text-sm text-muted-foreground">)</span>
                <span className="mr-auto">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </span>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {/* Render subfolders recursively */}
              {Array.from(folder.subfolders.values())
                .sort((a, b) => a.name.localeCompare(b.name, 'he-IL'))
                .map(subfolder => renderFolderGrid(subfolder, level + 1))}
              
              {/* Render songs in this folder */}
              {folder.songs.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 mb-4">
                  {folder.songs.map((song) => renderSongCard(song))}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      );
    };
    
    // Render song card
    const renderSongCard = (song: Song) => {
      const isCurrentSong = currentSong?.id === song.id;
      // Get duration from cache or song object
      const songDuration = songDurations.get(song.id) || song.duration || 0;
      return (
        <div
          key={song.id}
          className={`group relative bg-secondary/30 rounded-lg p-3 sm:p-4 hover:bg-secondary/50 transition-all cursor-pointer ${
            isCurrentSong ? "ring-2 ring-primary bg-secondary/70" : ""
          }`}
          onClick={() => onSongSelect(song)}
        >
          {/* Album Art / Cover */}
          <div className="relative aspect-square w-full mb-3 rounded-lg overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20">
            {song.coverUrl ? (
              <img
                src={song.coverUrl}
                alt={song.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-4xl sm:text-5xl">🎵</span>
              </div>
            )}
            {/* Play Button Overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Button
                variant="ghost"
                size="icon"
                className="w-12 h-12 rounded-full bg-primary/90 hover:bg-primary text-primary-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onSongSelect(song);
                }}
              >
                {isCurrentSong ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6 ml-0.5" />
                )}
              </Button>
            </div>
            {/* Current Song Indicator */}
            {isCurrentSong && (
              <div className="absolute top-2 right-2 w-3 h-3 bg-primary rounded-full animate-pulse" />
            )}
          </div>
          {/* Song Info */}
          <div className="min-w-0">
            <h4 className={`font-medium truncate text-sm sm:text-base ${
              isCurrentSong ? "text-primary" : "text-foreground"
            }`}>
              {song.title}
            </h4>
            {song.artist && (
              <p className="text-xs text-muted-foreground truncate mt-1">
                {song.artist}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {formatDuration(songDuration)}
            </p>
          </div>
        </div>
      );
    };

    return (
      <div className="p-4 sm:p-6">
        {renderFolderGrid(folderTree)}
      </div>
    );
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-[var(--shadow-card)]">
      <div className="p-3 sm:p-4 border-b border-border bg-secondary/30">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
        <h2 className="text-lg sm:text-xl font-semibold">השירים שלי</h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          {songs.length} שירים
        </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('grid')}
                title="תצוגת רשת"
              >
                <Grid3x3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('list')}
                title="תצוגת רשימה"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
            {/* Refresh Button */}
            {onRefresh && (
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={onRefresh}
                disabled={isRefreshing}
                title="רענון שירים"
              >
                {isRefreshing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-4 h-4"
                  >
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                    <path d="M3 21v-5h5" />
                  </svg>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {viewMode === 'grid' ? (
        renderGridView()
      ) : (
      <div className="divide-y divide-border">
        {(() => {
          // Filter out "all music" folder and use its contents instead
          const allMusicFolder = Array.from(folderTree.subfolders.values())
            .find(subfolder => {
              const folderName = subfolder.name.toLowerCase();
              return folderName.includes('all music') || folderName.includes('allmusic');
            });
          
          const foldersToDisplay = allMusicFolder
            ? Array.from(allMusicFolder.subfolders.values())
          .sort((a: FolderNode, b: FolderNode) => a.name.localeCompare(b.name, 'he-IL'))
            : Array.from(folderTree.subfolders.values())
                .filter(subfolder => {
                  const folderName = subfolder.name.toLowerCase();
                  return !folderName.includes('all music') && !folderName.includes('allmusic');
                })
                .sort((a: FolderNode, b: FolderNode) => a.name.localeCompare(b.name, 'he-IL'));
          
          const songsToDisplay = allMusicFolder
            ? allMusicFolder.songs
            : folderTree.songs;
          
          return (
            <>
              {foldersToDisplay.map((folder: FolderNode) => renderFolder(folder))}
              {songsToDisplay.length > 0 && (
                <div className="divide-y divide-border/50">
                  {songsToDisplay.map((song, index) => {
                    const isCurrentSong = currentSong?.id === song.id;
                    return (
                      <div
                        key={song.id}
                        className={`group flex items-center gap-2 sm:gap-4 p-2 sm:p-4 hover:bg-secondary/50 transition-all cursor-pointer ${
                          isCurrentSong ? "bg-secondary/70" : ""
                        }`}
                        onClick={() => onSongSelect(song)}
                      >
                        {/* Index / Play Button */}
                        <div className="w-6 sm:w-8 text-center flex-shrink-0">
                          {isCurrentSong ? (
                            <div className="flex items-center justify-center">
                              <div className="w-3 sm:w-4 flex gap-0.5 items-end">
                                <span className="w-0.5 sm:w-1 bg-primary animate-[wave_0.8s_ease-in-out_infinite] h-2 sm:h-3" />
                                <span className="w-0.5 sm:w-1 bg-primary animate-[wave_0.8s_ease-in-out_0.1s_infinite] h-3 sm:h-4" />
                                <span className="w-0.5 sm:w-1 bg-primary animate-[wave_0.8s_ease-in-out_0.2s_infinite] h-1.5 sm:h-2" />
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground group-hover:hidden text-xs">
                              {index + 1}
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`w-6 h-6 sm:w-8 sm:h-8 hidden group-hover:inline-flex ${
                              isCurrentSong ? "inline-flex" : ""
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSongSelect(song);
                            }}
                          >
                            {isCurrentSong ? (
                              <Pause className="w-3 h-3 sm:w-4 sm:h-4" />
                            ) : (
                              <Play className="w-3 h-3 sm:w-4 sm:h-4" />
                            )}
                          </Button>
                        </div>
                        {/* Album Art */}
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                          {song.coverUrl ? (
                            <img
                              src={song.coverUrl}
                              alt={song.title}
                              className="w-full h-full rounded-lg object-cover"
                            />
                          ) : (
                            <span className="text-lg sm:text-xl">🎵</span>
                          )}
                        </div>
                        {/* Song Info */}
                        <div className="flex-1 min-w-0">
                          <h3
                            className={`font-medium truncate text-sm sm:text-base ${
                              isCurrentSong ? "text-primary" : "text-foreground"
                            }`}
                          >
                            {song.title}
                          </h3>
                          <div className="flex items-center gap-1 sm:gap-2 text-xs text-muted-foreground mt-0.5 sm:mt-1 flex-wrap">
                            {song.artist && <span className="truncate">{song.artist}</span>}
                            {song.fileSize && (
                              <>
                                {song.artist && <span className="hidden sm:inline">•</span>}
                                <span className="hidden sm:inline">{formatFileSize(song.fileSize)}</span>
                              </>
                            )}
                            {songDurations.get(song.id) || song.duration ? (
                              <>
                                {(song.artist || song.fileSize) && <span className="hidden sm:inline">•</span>}
                                <span className="hidden sm:inline">{formatDuration(songDurations.get(song.id) || song.duration || 0)}</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                        {/* Duration */}
                        <div className="text-xs sm:text-sm text-muted-foreground flex-shrink-0">
                          {formatDuration(songDurations.get(song.id) || song.duration || 0)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          );
        })()}
      </div>
      )}
    </div>
  );
};

export default SongList;
