import { useState, useEffect } from "react";
import { Cloud, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Song } from "@/pages/Index";

interface GoogleDriveConnectProps {
  onSongsLoaded: (songs: Song[]) => void;
}

const GOOGLE_CLIENT_ID = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || "");
const REDIRECT_URI = String(import.meta.env.VITE_GOOGLE_REDIRECT_URI || `${window.location.origin}/auth/callback`);
const GDRIVE_FOLDER_ID = String(import.meta.env.VITE_GDRIVE_FOLDER_ID || "");
const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive.readonly",
].join(" ");

const LS = {
  accessToken: "gd_access_token",
  tokenExpiresAt: "gd_token_expires_at",
  codeVerifier: "gd_code_verifier",
  songs: "gd_songs",
  userEmail: "gd_user_email",
  isAuthenticated: "gd_is_authenticated",
};

function base64UrlEncode(buffer: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// no-op (left if needed later)
async function sha256(_input: string) { return ""; }

export async function loadSongsFromDrive(accessToken: string): Promise<Song[]> {
  if (!GDRIVE_FOLDER_ID) throw new Error("Missing VITE_GDRIVE_FOLDER_ID in environment");

  const headers = { Authorization: `Bearer ${accessToken}` } as const;
  const isNetlify = window.location.hostname.includes('netlify.app');
  const proxyBase = isNetlify
    ? `${window.location.origin}/.netlify/functions/stream`
    : `http://${window.location.hostname}:3001/api/stream`;

  const audioExtensions = [
    '.mp3', '.m4a', '.aac', '.wav', '.flac', '.ogg', '.opus', '.wma', '.aiff'
  ];

  function looksLikeAudio(name?: string, mimeType?: string) {
    if (!name && !mimeType) return false;
    if (mimeType && mimeType.startsWith('audio/')) return true;
    const lower = (name || '').toLowerCase();
    return audioExtensions.some(ext => lower.endsWith(ext));
  }

  function looksLikeImage(name?: string, mimeType?: string) {
    if (!name && !mimeType) return false;
    if (mimeType && mimeType.startsWith('image/')) return true;
    const lower = (name || '').toLowerCase();
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    return imageExtensions.some(ext => lower.endsWith(ext));
  }

  const imageNames = ['cover', 'album', 'artwork', 'folder', 'thumb', 'thumbnail', 'img', 'image'];

  async function listFilesPage(q: string, pageToken?: string) {
    const params = new URLSearchParams({
      q,
      fields: 'nextPageToken, files(id,name,mimeType,size,modifiedTime,shortcutDetails,thumbnailLink,imageMediaMetadata)',
      orderBy: 'name',
      pageSize: '1000',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
      ...(pageToken ? { pageToken } : {}),
    });
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, { headers });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(`Failed to list Drive files: ${errorData.error?.message || res.statusText}`);
    }
    return res.json();
  }

  async function listAll(q: string) {
    let pageToken: string | undefined;
    const all: any[] = [];
    do {
      const data = await listFilesPage(q, pageToken);
      all.push(...(data.files || []));
      pageToken = data.nextPageToken as string | undefined;
    } while (pageToken);
    return all as Array<{ id: string; name: string; mimeType?: string; shortcutDetails?: { targetId?: string }; thumbnailLink?: string }>;
  }

  // BFS over folders starting from the root folder ID
  // Track folder names for path building
  const folderMap = new Map<string, string>(); // folderId -> folderName
  const folderPaths = new Map<string, string>(); // folderId -> full path
  folderPaths.set(GDRIVE_FOLDER_ID, '');
  
  // Get root folder name
  try {
    const rootRes = await fetch(`https://www.googleapis.com/drive/v3/files/${GDRIVE_FOLDER_ID}?fields=name`, { headers });
    if (rootRes.ok) {
      const rootData = await rootRes.json();
      folderMap.set(GDRIVE_FOLDER_ID, rootData.name || '');
      folderPaths.set(GDRIVE_FOLDER_ID, rootData.name || '');
    }
  } catch (e) {
    console.warn('Could not fetch root folder name:', e);
  }

  const queue: Array<{ id: string; path: string }> = [{ id: GDRIVE_FOLDER_ID, path: folderPaths.get(GDRIVE_FOLDER_ID) || '' }];
  const visited = new Set<string>();
  const foundFiles: Array<{ 
    id: string; 
    name: string; 
    mimeType?: string; 
    size?: string;
    modifiedTime?: string;
    folderPath: string;
    thumbnailLink?: string; // For embedded album art
  }> = [];
  const folderImages = new Map<string, string>(); // folderPath -> imageUrl
  const fileThumbnails = new Map<string, string>(); // fileId -> thumbnailUrl

  while (queue.length) {
    const { id: folderId, path: currentPath } = queue.shift()!;
    if (visited.has(folderId)) continue;
    visited.add(folderId);

    // Get children (files/folders/shortcuts)
    const children = await listAll(`'${folderId}' in parents and trashed=false`);

    // Look for images in this folder
    let folderImageId: string | null = null;
    for (const item of children) {
      if (item.mimeType === 'application/vnd.google-apps.folder') {
        // Enqueue subfolder with updated path
        const folderName = item.name;
        folderMap.set(item.id, folderName);
        const newPath = currentPath ? `${currentPath} / ${folderName}` : folderName;
        folderPaths.set(item.id, newPath);
        queue.push({ id: item.id, path: newPath });
        continue;
      }

      // Check for images (cover art)
      if (looksLikeImage(item.name, item.mimeType)) {
        const lowerName = (item.name || '').toLowerCase();
        // Prefer images with common cover art names
        if (!folderImageId || imageNames.some(name => lowerName.includes(name))) {
          folderImageId = item.id;
          // Store thumbnail link if available
          if ((item as any).thumbnailLink && currentPath) {
            folderImages.set(currentPath, (item as any).thumbnailLink);
          }
        }
      }
    }

    // Store folder image URL if found (if not already set from thumbnailLink)
    if (folderImageId && currentPath && !folderImages.has(currentPath)) {
      try {
        // Use Google Drive API thumbnail endpoint with access token
        const imageUrl = `https://www.googleapis.com/drive/v3/files/${folderImageId}?alt=media`;
        folderImages.set(currentPath, imageUrl);
      } catch (e) {
        console.warn('Could not create image URL for folder:', currentPath, e);
      }
    }

    // Process audio files
    for (const item of children) {
      if (item.mimeType === 'application/vnd.google-apps.folder') {
        continue; // Already processed
      }

      if (item.mimeType === 'application/vnd.google-apps.shortcut' && item.shortcutDetails?.targetId) {
        // Resolve shortcut target
        const targetId = item.shortcutDetails.targetId;
        if (looksLikeAudio(item.name)) {
          const fileData: any = {
            id: targetId, 
            name: item.name, 
            mimeType: undefined,
            size: undefined,
            modifiedTime: undefined,
            folderPath: currentPath
          };
          
          // Check if shortcut has thumbnailLink
          if ((item as any).thumbnailLink) {
            fileData.thumbnailLink = (item as any).thumbnailLink;
            fileThumbnails.set(targetId, (item as any).thumbnailLink);
          }
          
          foundFiles.push(fileData);
        }
        continue;
      }

      if (looksLikeAudio(item.name, item.mimeType)) {
        const fileData: any = {
          id: item.id, 
          name: item.name, 
          mimeType: item.mimeType,
          size: (item as any).size,
          modifiedTime: (item as any).modifiedTime,
          folderPath: currentPath
        };
        
        // Check if file has thumbnailLink (embedded album art from Google Drive)
        // Note: thumbnailLink might not always be available in listFilesPage
        // We'll check each file individually later
        if ((item as any).thumbnailLink) {
          fileData.thumbnailLink = (item as any).thumbnailLink;
          // Store thumbnail URL for this file with size parameter
          const thumbnailUrl = (item as any).thumbnailLink.includes('=') 
            ? (item as any).thumbnailLink 
            : `${(item as any).thumbnailLink}=s800`; // Default to 800px
          fileThumbnails.set(item.id, thumbnailUrl);
        }
        
        foundFiles.push(fileData);
      }
    }
  }

  // Get thumbnails for ALL audio files (Google Drive extracts embedded album art)
  // Process in batches to avoid rate limits
  const BATCH_SIZE = 20; // Process 20 files at a time
  const allFiles = foundFiles.filter(f => !fileThumbnails.has(f.id));
  
  console.log(`Checking thumbnails for ${allFiles.length} audio files...`);
  
  for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
    const batch = allFiles.slice(i, i + BATCH_SIZE);
    
    // Fetch thumbnails for this batch in parallel
    const thumbnailPromises = batch.map(async (f) => {
      try {
        // Try multiple methods to get thumbnail from Google Drive API
        // Method 1: Try thumbnailLink endpoint (works for files with embedded album art)
        let fileInfoResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files/${f.id}?fields=thumbnailLink,thumbnailVersion,hasThumbnail`,
          { headers }
        );
        
        if (fileInfoResponse.ok) {
          const fileInfo = await fileInfoResponse.json();
          
          // Check if file has thumbnail (embedded album art)
          // Google Drive extracts embedded album art from audio files automatically
          if (fileInfo.thumbnailLink) {
            // Use thumbnailLink with size parameter for better quality
            // s220 = 220px, s320 = 320px, s640 = 640px, s800 = 800px
            let thumbnailUrl = fileInfo.thumbnailLink;
            
            // Add size parameter if not present
            if (!thumbnailUrl.includes('=')) {
              thumbnailUrl = `${thumbnailUrl}=s800`; // Default to 800px for high quality
            }
            
            fileThumbnails.set(f.id, thumbnailUrl);
            console.log(`✓ Found thumbnail for: ${f.name}`);
            return; // Success, exit early
          }
        }
        
        // Method 2: Try using the thumbnail endpoint directly with different sizes
        // Google Drive API thumbnail endpoint: /files/{fileId}/thumbnail?sz={size}
        // Size can be: 220, 320, 640, 800, 1000, 1200, 1600, 2000
        const thumbnailSizes = [800, 640, 320, 220, 1000, 1200];
        for (const size of thumbnailSizes) {
          try {
            const thumbnailEndpoint = `https://www.googleapis.com/drive/v3/files/${f.id}/thumbnail?sz=${size}`;
            const thumbnailResponse = await fetch(thumbnailEndpoint, { 
              headers,
              method: 'GET' // Try to actually get the image
            });
            
            // Check if we got an image (status 200 and content-type is image)
            if (thumbnailResponse.ok && 
                thumbnailResponse.status === 200 &&
                thumbnailResponse.headers.get('content-type')?.startsWith('image/')) {
              // Thumbnail exists, construct the URL
              const thumbnailUrl = `https://www.googleapis.com/drive/v3/files/${f.id}/thumbnail?sz=${size}`;
              fileThumbnails.set(f.id, thumbnailUrl);
              console.log(`✓ Found thumbnail (size ${size}) for: ${f.name}`);
              return; // Success, exit early
            }
          } catch (e) {
            // Continue to next size
          }
        }
        
        // No thumbnail found
        console.log(`✗ No thumbnail found for: ${f.name}`);
      } catch (e) {
        // Silent fail - will use folder image or default
        console.warn(`Error getting thumbnail for file ${f.id} (${f.name}):`, e);
      }
    });
    
    // Wait for this batch to complete before starting next batch
    await Promise.allSettled(thumbnailPromises);
    
    // Small delay between batches to avoid rate limits
    if (i + BATCH_SIZE < allFiles.length) {
      await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
    }
  }
  
  console.log(`Found ${fileThumbnails.size} thumbnails out of ${foundFiles.length} files`);

  // Map to Song objects
  const songs: Song[] = foundFiles.map((f) => {
    // Build URL - for Netlify, token will be added in MusicPlayer
    // For local server, token is in query string
    const url = isNetlify
      ? `${proxyBase}/${encodeURIComponent(f.id)}`
      : `${proxyBase}/${encodeURIComponent(f.id)}?token=${encodeURIComponent(accessToken)}`;
    
    // Priority for cover image:
    // 1. Embedded thumbnail from file (thumbnailLink from Google Drive) - highest priority
    //    Google Drive automatically extracts embedded album art from audio files
    // 2. Folder image (if exists)
    let coverUrl: string | undefined = undefined;
    
    // First, try to get embedded thumbnail from the file itself
    if (f.thumbnailLink) {
      coverUrl = f.thumbnailLink;
    } else if (fileThumbnails.has(f.id)) {
      coverUrl = fileThumbnails.get(f.id);
    }
    
    // If no embedded thumbnail, try folder image
    if (!coverUrl && f.folderPath) {
      coverUrl = folderImages.get(f.folderPath);
    }
    
    return {
      id: f.id,
      title: f.name,
      artist: '',
      duration: 0,
      url,
      coverUrl,
      folderPath: f.folderPath || '',
      fileSize: f.size,
      modifiedTime: f.modifiedTime,
    };
  });

  // Sort by folder path, then by title
  songs.sort((a, b) => {
    const pathCompare = (a.folderPath || '').localeCompare(b.folderPath || '', 'he-IL');
    if (pathCompare !== 0) return pathCompare;
    return a.title.localeCompare(b.title, 'he-IL');
  });
  
  return songs;
}

const GoogleDriveConnect = ({ onSongsLoaded }: GoogleDriveConnectProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingStored, setIsLoadingStored] = useState(true);
  const { toast } = useToast();

  // Check if user is already logged in on mount
  useEffect(() => {
    const checkStoredAuth = async () => {
      try {
        const isAuthenticated = sessionStorage.getItem(LS.isAuthenticated) === 'true';
        const userEmail = sessionStorage.getItem(LS.userEmail);
        const REQUIRED_EMAIL = '123123mushh@gmail.com';
        
        // Check if user is authenticated with correct email
        if (!isAuthenticated || userEmail !== REQUIRED_EMAIL) {
          setIsLoadingStored(false);
          return;
        }

        const accessToken = sessionStorage.getItem(LS.accessToken);
        const expiresAt = sessionStorage.getItem(LS.tokenExpiresAt);
        
        if (accessToken && expiresAt && parseInt(expiresAt) > Date.now()) {
          // Token is still valid, load songs
          const storedSongs = sessionStorage.getItem(LS.songs);
          if (storedSongs) {
            try {
              const songs = JSON.parse(storedSongs);
              onSongsLoaded(songs);
            } catch (e) {
              // If stored songs are invalid, reload from Drive
              const songs = await loadSongsFromDrive(accessToken);
              sessionStorage.setItem(LS.songs, JSON.stringify(songs));
              onSongsLoaded(songs);
            }
          } else {
            // Load songs from Drive
            const songs = await loadSongsFromDrive(accessToken);
            sessionStorage.setItem(LS.songs, JSON.stringify(songs));
            onSongsLoaded(songs);
          }
        }
      } catch (error) {
        console.error("Error loading stored auth:", error);
        // Clear invalid tokens
        sessionStorage.removeItem(LS.accessToken);
        sessionStorage.removeItem(LS.tokenExpiresAt);
        sessionStorage.removeItem(LS.songs);
        sessionStorage.removeItem(LS.userEmail);
        sessionStorage.removeItem(LS.isAuthenticated);
      } finally {
        setIsLoadingStored(false);
      }
    };
    
    checkStoredAuth();
  }, [onSongsLoaded]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      if (!GOOGLE_CLIENT_ID) throw new Error("Missing VITE_GOOGLE_CLIENT_ID in environment");
      if (!(window as any).google?.accounts?.oauth2) throw new Error("Google Identity Services not loaded");

      const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        prompt: '', // Empty prompt = use cached consent, don't ask again
        callback: async (resp: any) => {
          try {
            if (resp.error) throw new Error(resp.error);
            const accessToken: string = resp.access_token;
            const expiresIn: number = resp.expires_in || 3600;
            const expiresAt = Date.now() + (expiresIn - 60) * 1000;

            // Get user email from Google
            const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (!userInfoRes.ok) {
              throw new Error('Failed to get user info');
            }

            const userInfo = await userInfoRes.json();
            const userEmail = userInfo.email;

            // Check if email matches required email
            const REQUIRED_EMAIL = '123123mushh@gmail.com';
            if (userEmail !== REQUIRED_EMAIL) {
              toast({ 
                title: 'גישה נדחתה', 
                description: `רק המשתמש ${REQUIRED_EMAIL} יכול להתחבר לאתר`, 
                variant: 'destructive' 
              });
              setIsConnecting(false);
              return;
            }

            // Store authentication info
            sessionStorage.setItem(LS.accessToken, accessToken);
            sessionStorage.setItem(LS.tokenExpiresAt, String(expiresAt));
            sessionStorage.setItem(LS.userEmail, userEmail);
            sessionStorage.setItem(LS.isAuthenticated, 'true');

            const songs = await loadSongsFromDrive(accessToken);
            sessionStorage.setItem(LS.songs, JSON.stringify(songs));
            onSongsLoaded(songs);
            toast({ title: 'התחברות הצליחה!', description: `נמצאו ${songs.length} שירים` });
          } catch (e: any) {
            console.error('Google token error:', e);
            toast({ title: 'שגיאה בהתחברות', description: e?.message || 'לא הצלחנו לקבל טוקן', variant: 'destructive' });
          } finally {
            setIsConnecting(false);
          }
        },
      });

      tokenClient.requestAccessToken();
    } catch (error) {
      console.error("Google Drive connection error:", error);
      toast({
        title: "שגיאה בהתחברות",
        description:
          error instanceof Error ? error.message : "לא הצלחנו להתחבר ל-Google Drive",
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(LS.accessToken);
    sessionStorage.removeItem(LS.tokenExpiresAt);
    sessionStorage.removeItem(LS.codeVerifier);
    sessionStorage.removeItem(LS.songs);
    sessionStorage.removeItem(LS.userEmail);
    sessionStorage.removeItem(LS.isAuthenticated);
    onSongsLoaded([]);
    toast({
      title: "התנתקת",
      description: "התנתקת בהצלחה מ-Google Drive",
    });
  };

  const isAuthenticated = sessionStorage.getItem(LS.isAuthenticated) === 'true';
  const userEmail = sessionStorage.getItem(LS.userEmail);
  const REQUIRED_EMAIL = '123123mushh@gmail.com';
  const hasToken = isAuthenticated && 
                   userEmail === REQUIRED_EMAIL &&
                   sessionStorage.getItem(LS.accessToken) && 
                   sessionStorage.getItem(LS.tokenExpiresAt) &&
                   parseInt(sessionStorage.getItem(LS.tokenExpiresAt) || "0") > Date.now();

  if (isLoadingStored) {
    return (
      <Button size="lg" disabled className="gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        בודק התחברות...
      </Button>
    );
  }

  if (hasToken) {
    return (
      <Button
        onClick={handleLogout}
        size="lg"
        variant="outline"
        className="gap-2"
      >
        <LogOut className="w-5 h-5" />
        התנתק מ-Google Drive
      </Button>
    );
  }

  return (
    <Button
      onClick={handleConnect}
      disabled={isConnecting}
      size="lg"
      className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity shadow-[var(--shadow-player)]"
    >
      {isConnecting ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          מתחבר...
        </>
      ) : (
        <>
          <Cloud className="w-5 h-5" />
          התחבר ל-Google Drive
        </>
      )}
    </Button>
  );
};

export default GoogleDriveConnect;
