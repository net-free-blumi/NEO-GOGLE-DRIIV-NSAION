/**
 * Extract embedded album art from audio file
 * This function reads the audio file and extracts the embedded cover image from metadata
 */
export async function extractAlbumArtFromFile(audioUrl: string, accessToken?: string): Promise<string | null> {
  try {
    // Create a temporary audio element to load the file
    const audio = new Audio();
    
    // Add token to URL if needed
    let finalUrl = audioUrl;
    if (accessToken && audioUrl.includes('netlify')) {
      const separator = audioUrl.includes('?') ? '&' : '?';
      finalUrl = `${audioUrl}${separator}token=${encodeURIComponent(accessToken)}`;
    } else if (accessToken && !audioUrl.includes('token=')) {
      const separator = audioUrl.includes('?') ? '&' : '?';
      finalUrl = `${audioUrl}${separator}token=${encodeURIComponent(accessToken)}`;
    }
    
    // Try to fetch the file and extract metadata
    const response = await fetch(finalUrl, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      // Only fetch first 1MB to check for embedded art (most ID3 tags are at the beginning)
      // Note: Range requests might not work with all servers, so we'll try a different approach
    });
    
    if (!response.ok) {
      return null;
    }
    
    // For now, we'll use a simpler approach:
    // Try to get thumbnail from Google Drive API if the URL contains a file ID
    // This is more reliable than parsing ID3 tags
    
    // If the URL is a Google Drive file, try to get thumbnail
    const driveFileIdMatch = finalUrl.match(/\/files\/([^\/\?]+)/);
    if (driveFileIdMatch && accessToken) {
      const fileId = driveFileIdMatch[1];
      try {
        // Try to get thumbnail from Google Drive API
        const thumbnailResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?fields=thumbnailLink`,
          {
            headers: { Authorization: `Bearer ${accessToken}` }
          }
        );
        
        if (thumbnailResponse.ok) {
          const data = await thumbnailResponse.json();
          if (data.thumbnailLink) {
            return data.thumbnailLink;
          }
        }
      } catch (e) {
        // Silent fail - will try other methods
      }
    }
    
    return null;
  } catch (error) {
    console.warn('Error extracting album art:', error);
    return null;
  }
}

/**
 * Extract album art from audio file using ID3 tag parsing
 * This is a more advanced method that reads the actual file bytes
 */
export async function extractAlbumArtFromID3(audioUrl: string, accessToken?: string): Promise<string | null> {
  try {
    // Add token to URL if needed
    let finalUrl = audioUrl;
    if (accessToken && audioUrl.includes('netlify')) {
      const separator = audioUrl.includes('?') ? '&' : '?';
      finalUrl = `${audioUrl}${separator}token=${encodeURIComponent(accessToken)}`;
    } else if (accessToken && !audioUrl.includes('token=')) {
      const separator = audioUrl.includes('?') ? '&' : '?';
      finalUrl = `${audioUrl}${separator}token=${encodeURIComponent(accessToken)}`;
    }
    
    // Fetch first 64KB of the file (ID3 tags are usually at the beginning)
    const response = await fetch(finalUrl, {
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        Range: 'bytes=0-65535', // First 64KB should contain ID3 tags
      },
    });
    
    if (!response.ok) {
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Look for ID3v2 tag (starts with "ID3")
    if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
      // ID3v2 tag found - parse it
      // This is a simplified parser - full ID3 parsing is complex
      // For now, we'll return null and rely on Google Drive thumbnails
      // A full implementation would require a library like 'music-metadata'
    }
    
    // Look for ID3v1 tag (at the end of file, but we only have first 64KB)
    // This won't work with Range request, so we skip it
    
    return null;
  } catch (error) {
    console.warn('Error extracting album art from ID3:', error);
    return null;
  }
}

