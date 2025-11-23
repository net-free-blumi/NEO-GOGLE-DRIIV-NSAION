import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { log } from '../utils/logger'

const FOLDER_ID = '1EhS3EzpK0dRK62v2V4YZuCLbcCrk6SN9'

interface Song {
  id: string
  name: string
  mimeType: string
  size: string
  webViewLink: string
}

export default function HomePage() {
  const { accessToken, logout } = useAuth()
  const navigate = useNavigate()
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) {
      log('No access token, redirecting to login', 'warn')
      navigate('/login')
      return
    }

    loadSongs()
  }, [accessToken, navigate])

  const loadSongs = async () => {
    if (!accessToken) return

    try {
      log('Loading songs from Google Drive...', 'info')
      setLoading(true)
      setError(null)

      const query = `'${FOLDER_ID}' in parents and (mimeType='audio/mpeg' or mimeType='audio/mp3' or mimeType='audio/wav' or mimeType='audio/ogg' or mimeType='audio/flac')`
      
      log(`Query: ${query}`, 'info')
      
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,webViewLink)`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      )

      log(`Drive API response status: ${response.status}`, 'info')

      if (!response.ok) {
        const errorData = await response.json()
        log(`Drive API error: ${JSON.stringify(errorData)}`, 'error')
        throw new Error(errorData.error?.message || 'Failed to load songs')
      }

      const data = await response.json()
      log(`Received ${data.files?.length || 0} songs`, 'info')
      
      setSongs(data.files || [])
      setLoading(false)
    } catch (err: any) {
      log(`Error loading songs: ${err.message}`, 'error')
      setError(err.message)
      setLoading(false)
    }
  }

  const handleLogout = () => {
    log('Logout clicked', 'info')
    logout()
    navigate('/login')
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#121212',
      color: '#fff',
      padding: '20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Music Player</h1>
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

      {loading && <p>טוען שירים...</p>}
      {error && (
        <div style={{ color: '#ff6b6b', marginBottom: '20px' }}>
          שגיאה: {error}
          <button onClick={loadSongs} style={{ marginRight: '10px', padding: '5px 10px' }}>
            נסה שוב
          </button>
        </div>
      )}

      {!loading && !error && (
        <div>
          <h2>שירים ({songs.length})</h2>
          {songs.length === 0 ? (
            <p>לא נמצאו שירים</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {songs.map((song) => (
                <li
                  key={song.id}
                  style={{
                    padding: '15px',
                    marginBottom: '10px',
                    background: '#1e1e1e',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    log(`Song clicked: ${song.name}`, 'info')
                    const streamUrl = `https://www.googleapis.com/drive/v3/files/${song.id}?alt=media&access_token=${accessToken}`
                    log(`Stream URL: ${streamUrl.substring(0, 100)}...`, 'info')
                    window.open(streamUrl, '_blank')
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{song.name}</div>
                  <div style={{ fontSize: '12px', color: '#aaa' }}>
                    {song.mimeType} • {song.size ? `${(parseInt(song.size) / 1024 / 1024).toFixed(2)} MB` : 'Unknown size'}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

