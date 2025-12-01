import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { log } from '../utils/logger'
import { cleanSongName } from '../utils/songNameCleaner'
import { FolderStructure, DriveFile } from '../types/drive'
import EnhancedMusicPlayer from '../components/EnhancedMusicPlayer'
import FolderGrid from '../components/FolderGrid'

const FOLDER_ID = '1EhS3EzpK0dRK62v2V4YZuCLbcCrk6SN9'

export default function HomePage() {
  const { accessToken, logout } = useAuth()
  const navigate = useNavigate()
  const [folderStructure, setFolderStructure] = useState<FolderStructure | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [folderId, setFolderId] = useState(FOLDER_ID)
  const [showFolderInput, setShowFolderInput] = useState(false)
  const [playlist, setPlaylist] = useState<{ id: string; name: string; file: DriveFile }[]>([])
  const [currentSongIndex, setCurrentSongIndex] = useState(-1)
  const [currentSong, setCurrentSong] = useState<{ id: string; name: string; streamUrl: string; albumArt?: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!accessToken) {
      log('No access token, redirecting to login', 'warn')
      navigate('/login')
      return
    }

    // Prevent multiple simultaneous loads
    if (isLoading) {
      log('Already loading, skipping...', 'info')
      return
    }

    // Only load if folderId changed or on mount
    loadFolderStructure()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, folderId])

  const loadFolderStructure = async (targetFolderId: string = folderId, path: string[] = []) => {
    if (!accessToken) return

    // Prevent multiple simultaneous loads
    if (isLoading) {
      log('Already loading folder structure, skipping...', 'info')
      return
    }

    try {
      setIsLoading(true)
      log(`Loading folder structure: ${targetFolderId}`, 'info')
      setLoading(true)
      setError(null)

      // Get folder info
      const folderResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${targetFolderId}?fields=id,name,mimeType`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      )

      if (!folderResponse.ok) {
        throw new Error('Failed to load folder')
      }

      const folderData = await folderResponse.json()
      log(`Folder found: ${folderData.name}`, 'info')

      // Get all items in folder (include thumbnailLink for images)
      const query = `'${targetFolderId}' in parents and trashed=false`
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,webViewLink,thumbnailLink)&pageSize=1000&orderBy=name`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error('Failed to load folder contents')
      }

      const data = await response.json()
      const items = data.files || []

      // Separate folders and files
      const folders = items.filter((item: any) => item.mimeType === 'application/vnd.google-apps.folder')
      const files = items.filter((item: any) => item.mimeType !== 'application/vnd.google-apps.folder')
        .filter((file: DriveFile) => {
          const name = file.name.toLowerCase()
          const mimeType = file.mimeType?.toLowerCase() || ''
          return mimeType.includes('audio/') || 
                 name.endsWith('.mp3') || 
                 name.endsWith('.wav') || 
                 name.endsWith('.m4a') || 
                 name.endsWith('.flac') || 
                 name.endsWith('.ogg') || 
                 name.endsWith('.aac')
        })

      log(`Found ${folders.length} folders and ${files.length} audio files`, 'info')

      // Build structure recursively
      const structure: FolderStructure = {
        id: targetFolderId,
        name: folderData.name,
        folders: [],
        files: files.map((file: DriveFile) => ({
          ...file,
          name: cleanSongName(file.name), // Clean song names
        })),
        path: path,
      }

      // Load subfolders recursively
      for (const folder of folders) {
        try {
          const subStructure = await loadFolderStructureRecursive(folder.id, [...path, folder.name], accessToken)
          structure.folders.push(subStructure)
        } catch (err) {
          log(`Error loading subfolder ${folder.name}: ${err}`, 'warn')
        }
      }

      setFolderStructure(structure)
      
      // Build flat playlist from structure
      const flatPlaylist = collectAllSongs(structure)
      setPlaylist(flatPlaylist)
      log(`Created playlist with ${flatPlaylist.length} songs`, 'info')
      
      setLoading(false)
      setIsLoading(false)
    } catch (err: any) {
      log(`Error loading folder structure: ${err.message}`, 'error')
      setError(err.message)
      setLoading(false)
      setIsLoading(false)
    }
  }

  const loadFolderStructureRecursive = async (
    targetFolderId: string,
    path: string[],
    token: string
  ): Promise<FolderStructure> => {
    // Get folder info
    const folderResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${targetFolderId}?fields=id,name,mimeType`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    )

    if (!folderResponse.ok) {
      throw new Error('Failed to load folder')
    }

    const folderData = await folderResponse.json()

      // Get all items in folder (include thumbnailLink for images)
      const query = `'${targetFolderId}' in parents and trashed=false`
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,webViewLink,thumbnailLink)&pageSize=1000&orderBy=name`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error('Failed to load folder contents')
    }

    const data = await response.json()
    const items = data.files || []

    // Separate folders and files
    const folders = items.filter((item: any) => item.mimeType === 'application/vnd.google-apps.folder')
    const files = items.filter((item: any) => item.mimeType !== 'application/vnd.google-apps.folder')
      .filter((file: DriveFile) => {
        const name = file.name.toLowerCase()
        const mimeType = file.mimeType?.toLowerCase() || ''
        return mimeType.includes('audio/') || 
               name.endsWith('.mp3') || 
               name.endsWith('.wav') || 
               name.endsWith('.m4a') || 
               name.endsWith('.flac') || 
               name.endsWith('.ogg') || 
               name.endsWith('.aac')
      })

    const structure: FolderStructure = {
      id: targetFolderId,
      name: folderData.name,
      folders: [],
      files: files.map((file: DriveFile) => ({
        ...file,
        name: cleanSongName(file.name), // Clean song names
      })),
      path: path,
    }

    // Load subfolders recursively (limit depth to avoid too many requests)
    if (path.length < 5) {
      for (const folder of folders) {
        try {
          const subStructure = await loadFolderStructureRecursive(folder.id, [...path, folder.name], token)
          structure.folders.push(subStructure)
        } catch (err) {
          log(`Error loading subfolder ${folder.name}: ${err}`, 'warn')
        }
      }
    }

    return structure
  }

  // Collect all songs from folder structure into flat playlist
  const collectAllSongs = (folder: FolderStructure): { id: string; name: string; file: DriveFile }[] => {
    const songs: { id: string; name: string; file: DriveFile }[] = []
    
    // Add files from current folder
    folder.files.forEach(file => {
      songs.push({
        id: file.id,
        name: file.name,
        file: file,
      })
    })
    
    // Recursively add songs from subfolders
    folder.folders.forEach(subFolder => {
      songs.push(...collectAllSongs(subFolder))
    })
    
    return songs
  }

  const handleLogout = () => {
    log('Logout clicked', 'info')
    logout()
    navigate('/login')
  }

  const loadSongAsBlob = async (file: DriveFile): Promise<string> => {
    if (!accessToken) throw new Error('No access token')
    
    log('Loading audio file...', 'info')
    
    // Use direct URL with access_token - this works better for audio streaming
    // Google Drive API supports this for media files
    const directUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&access_token=${accessToken}`
    
    log(`Using direct URL for streaming: ${directUrl.substring(0, 80)}...`, 'info')
    return directUrl
    
    /* Blob approach (commented out - has compatibility issues)
    log('Fetching audio file as blob...', 'info')
    
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`)
    }

    log('Converting response to blob...', 'info')
    
    // Get the content type from response or infer from file name
    let contentType = response.headers.get('content-type')
    
    // If no content-type header, infer from file extension
    if (!contentType || contentType === 'application/octet-stream') {
      const ext = file.name.toLowerCase().split('.').pop()
      const mimeTypes: Record<string, string> = {
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'm4a': 'audio/mp4',
        'flac': 'audio/flac',
        'ogg': 'audio/ogg',
        'aac': 'audio/aac',
      }
      contentType = mimeTypes[ext || ''] || 'audio/mpeg'
      log(`Inferred content type: ${contentType}`, 'info')
    }
    
    log(`Content type: ${contentType}`, 'info')
    
    // Read the response as array buffer first to ensure full download
    const arrayBuffer = await response.arrayBuffer()
    log(`Downloaded ${arrayBuffer.byteLength} bytes`, 'info')
    
    // Verify we got data
    if (arrayBuffer.byteLength === 0) {
      throw new Error('Downloaded file is empty')
    }
    
    // Create a blob with correct MIME type from array buffer
    const blob = new Blob([arrayBuffer], { 
      type: contentType 
    })
    
    // Verify blob was created correctly
    if (blob.size === 0) {
      throw new Error('Blob is empty after creation')
    }
    
    log(`Blob created: ${blob.size} bytes, type: ${blob.type}`, 'info')
    
    // Create a blob URL that the audio element can use
    const blobUrl = URL.createObjectURL(blob)
    
    log(`Blob URL created: ${blobUrl}`, 'info')
    
    return blobUrl
    */
  }

  const handleFileClick = async (file: DriveFile) => {
    if (!accessToken) return
    
    // Find index in playlist
    const index = playlist.findIndex(song => song.file.id === file.id)
    if (index === -1) {
      log(`File not found in playlist: ${file.name}`, 'warn')
      return
    }
    
    setCurrentSongIndex(index)
    log(`Playing song ${index + 1}/${playlist.length}: ${file.name}`, 'info')
    
    try {
      const blobUrl = await loadSongAsBlob(file)
      // Try to get thumbnail for album art (if available)
      const albumArt = file.thumbnailLink 
        ? `${file.thumbnailLink}&access_token=${accessToken}`
        : undefined
      
      setCurrentSong({
        id: file.id,
        name: file.name,
        streamUrl: blobUrl,
        albumArt: albumArt,
      })
    } catch (error: any) {
      log(`Error loading file: ${error.message}`, 'error')
      alert(`שגיאה בטעינת הקובץ: ${error.message}`)
    }
  }

  const handleSongChange = async (song: { id: string; name: string; streamUrl: string; albumArt?: string }) => {
    const index = playlist.findIndex(s => s.id === song.id)
    if (index === -1) return
    
    setCurrentSongIndex(index)
    
    // If streamUrl is already a blob, use it directly
    if (song.streamUrl.startsWith('blob:')) {
      setCurrentSong(song)
      return
    }
    
    // Otherwise, find the file and load it
    const playlistItem = playlist[index]
    try {
      const blobUrl = await loadSongAsBlob(playlistItem.file)
      // Try to get thumbnail for album art (if available)
      const albumArt = playlistItem.file.thumbnailLink && accessToken
        ? `${playlistItem.file.thumbnailLink}&access_token=${accessToken}`
        : undefined
      
      setCurrentSong({
        id: playlistItem.id,
        name: playlistItem.name,
        streamUrl: blobUrl,
        albumArt: albumArt,
      })
    } catch (error: any) {
      log(`Error loading song: ${error.message}`, 'error')
    }
  }

  const handleNext = async () => {
    if (currentSongIndex < playlist.length - 1) {
      const nextIndex = currentSongIndex + 1
      const nextSong = playlist[nextIndex]
      await handleSongChange({
        id: nextSong.id,
        name: nextSong.name,
        streamUrl: '', // Will be loaded
        albumArt: nextSong.file.thumbnailLink && accessToken
          ? `${nextSong.file.thumbnailLink}&access_token=${accessToken}`
          : undefined,
      })
    }
  }

  const handlePrevious = async () => {
    if (currentSongIndex > 0) {
      const prevIndex = currentSongIndex - 1
      const prevSong = playlist[prevIndex]
      await handleSongChange({
        id: prevSong.id,
        name: prevSong.name,
        streamUrl: '', // Will be loaded
        albumArt: prevSong.file.thumbnailLink && accessToken
          ? `${prevSong.file.thumbnailLink}&access_token=${accessToken}`
          : undefined,
      })
    }
  }

  // Only one folder can be expanded at a time
  const [expandedFolderId, setExpandedFolderId] = useState<string | null>(null)

  const toggleFolder = (folderId: string) => {
    // If clicking the same folder, close it. Otherwise, open the new one and close the old one
    setExpandedFolderId(expandedFolderId === folderId ? null : folderId)
  }


  const countAllSongs = (folder: FolderStructure): number => {
    let count = folder.files.length
    folder.folders.forEach(subFolder => {
      count += countAllSongs(subFolder)
    })
    return count
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#121212',
      color: '#fff',
      padding: '20px',
      paddingBottom: currentSong ? '120px' : '20px', // Space for music player
      maxWidth: '1400px',
      margin: '0 auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h1>Music Player</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShowFolderInput(!showFolderInput)}
            style={{
              padding: '10px 20px',
              background: '#555',
              color: '#fff',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            {showFolderInput ? 'הסתר' : 'שנה תיקייה'}
          </button>
        <button
          onClick={handleLogout}
          style={{
            padding: '10px 20px',
            background: '#333',
            color: '#fff',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          התנתק
        </button>
      </div>
      </div>

      {showFolderInput && (
        <div style={{ 
          padding: '15px', 
          background: '#1e1e1e', 
          borderRadius: '8px', 
          marginBottom: '20px',
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <label style={{ color: '#fff', fontWeight: 'bold' }}>Folder ID:</label>
          <input
            type="text"
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
            placeholder="הזן Folder ID"
            style={{
              flex: 1,
              minWidth: '200px',
              padding: '8px 12px',
              background: '#333',
              color: '#fff',
              border: '1px solid #555',
              borderRadius: '5px',
              fontSize: '14px',
            }}
          />
          <button
            onClick={() => loadFolderStructure()}
            style={{
              padding: '8px 20px',
              background: '#4285f4',
              color: '#fff',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            טען שירים
          </button>
        </div>
      )}

      {loading && <p>טוען מבנה תיקיות...</p>}
      {error && (
        <div style={{ color: '#ff6b6b', marginBottom: '20px' }}>
          שגיאה: {error}
          <button onClick={() => loadFolderStructure()} style={{ marginRight: '10px', padding: '5px 10px' }}>
            נסה שוב
          </button>
        </div>
      )}

      {!loading && !error && folderStructure && (
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <h2 style={{ 
              margin: 0,
              fontSize: '24px',
              fontWeight: '600',
              color: '#fff'
            }}>
              {folderStructure.name}
            </h2>
            <span style={{ 
              fontSize: '14px', 
              color: '#aaa',
              background: '#1e1e1e',
              padding: '6px 12px',
              borderRadius: '8px',
            }}>
              {countAllSongs(folderStructure)} שירים
            </span>
          </div>
          <div style={{ marginTop: '20px' }}>
            <FolderGrid
              folder={folderStructure}
              onFileClick={handleFileClick}
              expandedFolderId={expandedFolderId}
              onFolderToggle={toggleFolder}
            />
          </div>
        </div>
      )}

      {/* Enhanced Music Player */}
      {currentSong && (
        <EnhancedMusicPlayer 
          currentSong={{
            id: currentSong.id,
            name: currentSong.name,
            streamUrl: currentSong.streamUrl,
          }}
          playlist={playlist.map(s => ({ 
            id: s.id, 
            name: s.name, 
            streamUrl: currentSong?.id === s.id ? currentSong.streamUrl : '',
            albumArt: currentSong?.id === s.id ? currentSong.albumArt : undefined,
          }))}
          currentIndex={currentSongIndex}
          onClose={() => {
            setCurrentSong(null)
            setCurrentSongIndex(-1)
          }}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onSongChange={handleSongChange}
        />
      )}
    </div>
  )
}
