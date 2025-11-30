import { useState, useRef, useEffect } from 'react'
import { log } from '../utils/logger'

interface Song {
  id: string
  name: string
  streamUrl: string
}

interface MusicPlayerProps {
  currentSong: Song | null
  playlist: Song[]
  currentIndex: number
  onClose: () => void
  onNext: () => void
  onPrevious: () => void
  onSongChange: (song: Song) => void
}

export default function MusicPlayer({ 
  currentSong, 
  playlist, 
  currentIndex,
  onClose, 
  onNext, 
  onPrevious,
  onSongChange 
}: MusicPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const previousBlobUrlRef = useRef<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPlaylist, setShowPlaylist] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateTime = () => setCurrentTime(audio.currentTime)
    const updateDuration = () => {
      if (audio.duration) {
        setDuration(audio.duration)
      }
    }
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
      // Auto-play next song
      if (currentIndex < playlist.length - 1) {
        onNext()
      }
    }
    const handleError = () => {
      const errorCode = audio.error?.code
      let errorMessage = 'שגיאה בטעינת השיר'
      
      if (errorCode === 1) errorMessage = 'MEDIA_ERR_ABORTED - בוטל'
      else if (errorCode === 2) errorMessage = 'MEDIA_ERR_NETWORK - בעיית רשת'
      else if (errorCode === 3) errorMessage = 'MEDIA_ERR_DECODE - שגיאת פענוח'
      else if (errorCode === 4) errorMessage = 'MEDIA_ERR_SRC_NOT_SUPPORTED - פורמט לא נתמך'
      
      log(`Audio error: ${errorMessage} (code: ${errorCode})`, 'error')
      setError(errorMessage)
      setIsPlaying(false)
    }

    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }
  }, [currentIndex, playlist.length, onNext])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentSong) return

    log(`Loading audio: ${currentSong.name}`, 'info')
    log(`Stream URL: ${currentSong.streamUrl.substring(0, 80)}...`, 'info')
    
    // Reset state
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setError(null)
    
    // Cleanup: revoke previous blob URL (but wait a bit to ensure audio element released it)
    const prevBlobUrl = previousBlobUrlRef.current
    if (prevBlobUrl && prevBlobUrl.startsWith('blob:')) {
      // Delay revocation to ensure audio element released the previous blob
      setTimeout(() => {
        try {
          URL.revokeObjectURL(prevBlobUrl)
          log('Revoked previous blob URL', 'info')
        } catch (e) {
          // Ignore if already revoked
        }
      }, 2000)
    }
    
    // Store current blob URL for cleanup (only if it's a blob URL)
    if (currentSong.streamUrl.startsWith('blob:')) {
      previousBlobUrlRef.current = currentSong.streamUrl
    } else {
      previousBlobUrlRef.current = null
    }
    
    // Clear and set new source
    audio.pause()
    audio.src = ''
    audio.removeAttribute('src')
    audio.load()
    
    // Wait a moment before setting new source
    const timeoutId = setTimeout(() => {
      if (!audio || !currentSong) return
      
      log(`Setting audio source: ${currentSong.streamUrl.substring(0, 60)}...`, 'info')
      
      // Set source directly
      audio.src = currentSong.streamUrl
      
      // Add event listeners BEFORE load
      const handleCanPlayThrough = () => {
        log('Audio can play through (fully loaded)', 'info')
      }
      const handleLoadedMetadata = () => {
        log(`Audio metadata loaded: duration=${audio.duration}s`, 'info')
      }
      const handleLoadedData = () => {
        log('Audio data loaded', 'info')
      }
      const handleCanPlay = () => {
        log('Audio can play', 'info')
      }
      const handleError = () => {
        const error = audio.error
        if (error) {
          log(`Audio element error: code=${error.code}, message=${error.message}`, 'error')
          log(`Audio src: ${audio.src}`, 'error')
          log(`Audio networkState: ${audio.networkState}, readyState: ${audio.readyState}`, 'error')
          
          // Try to get more info about the blob
          if (currentSong.streamUrl.startsWith('blob:')) {
            fetch(currentSong.streamUrl)
              .then(res => res.blob())
              .then(blob => {
                log(`Blob test: size=${blob.size}, type=${blob.type}`, 'error')
              })
              .catch(err => {
                log(`Blob fetch test failed: ${err}`, 'error')
              })
          }
        }
      }
      
      audio.addEventListener('canplaythrough', handleCanPlayThrough, { once: true })
      audio.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true })
      audio.addEventListener('loadeddata', handleLoadedData, { once: true })
      audio.addEventListener('canplay', handleCanPlay, { once: true })
      audio.addEventListener('error', handleError, { once: true })
      
      // Now load
      audio.load()
    }, 100)
    
    return () => {
      clearTimeout(timeoutId)
    }
  }, [currentSong])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = isMuted ? 0 : volume
  }, [volume, isMuted])

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (previousBlobUrlRef.current && previousBlobUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(previousBlobUrlRef.current)
      }
    }
  }, [])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play().catch(err => {
        log(`Error playing audio: ${err}`, 'error')
      })
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio) return
    const newTime = parseFloat(e.target.value)
    audio.currentTime = newTime
    setCurrentTime(newTime)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    if (newVolume > 0) {
      setIsMuted(false)
    }
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
  }

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!currentSong) return null

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <>
      {/* Main Player */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(180deg, #1a1a1a 0%, #0f0f0f 100%)',
        borderTop: '1px solid #333',
        padding: '20px',
        zIndex: 1000,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.8)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          {/* Album Art / Icon */}
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
            flexShrink: 0,
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
          }}>
            🎵
          </div>

          {/* Song Info */}
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ 
              fontWeight: 'bold', 
              marginBottom: '5px', 
              color: '#fff',
              fontSize: '16px',
            }}>
              {currentSong.name}
            </div>
            {error ? (
              <div style={{ fontSize: '12px', color: '#ff6b6b' }}>
                {error}
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: '#aaa' }}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            )}
          </div>

          {/* Main Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button
              onClick={onPrevious}
              disabled={currentIndex === 0}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: currentIndex === 0 ? '#333' : '#444',
                border: 'none',
                color: '#fff',
                cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                fontSize: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: currentIndex === 0 ? 0.5 : 1,
              }}
              title="שיר קודם"
            >
              ⏮
            </button>
            
            <button
              onClick={togglePlay}
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: '#4285f4',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 15px rgba(66, 133, 244, 0.4)',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
              }}
              title={isPlaying ? 'השהה' : 'נגן'}
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            
            <button
              onClick={onNext}
              disabled={currentIndex >= playlist.length - 1}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: currentIndex >= playlist.length - 1 ? '#333' : '#444',
                border: 'none',
                color: '#fff',
                cursor: currentIndex >= playlist.length - 1 ? 'not-allowed' : 'pointer',
                fontSize: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: currentIndex >= playlist.length - 1 ? 0.5 : 1,
              }}
              title="שיר הבא"
            >
              ⏭
            </button>
          </div>

          {/* Progress Bar */}
          <div style={{ flex: 2, minWidth: '250px' }}>
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              style={{
                width: '100%',
                height: '6px',
                borderRadius: '3px',
                background: `linear-gradient(to right, #4285f4 0%, #4285f4 ${progressPercent}%, #333 ${progressPercent}%, #333 100%)`,
                outline: 'none',
                cursor: 'pointer',
                WebkitAppearance: 'none',
              }}
            />
          </div>

          {/* Volume Control */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '150px' }}>
            <button
              onClick={toggleMute}
              style={{
                background: 'none',
                border: 'none',
                color: '#aaa',
                cursor: 'pointer',
                fontSize: '20px',
                padding: '5px',
              }}
              title={isMuted ? 'הפעל קול' : 'השתק'}
            >
              {isMuted ? '🔇' : volume > 0.5 ? '🔊' : '🔉'}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              style={{
                flex: 1,
                height: '4px',
                borderRadius: '2px',
                background: `linear-gradient(to right, #4285f4 0%, #4285f4 ${(isMuted ? 0 : volume) * 100}%, #333 ${(isMuted ? 0 : volume) * 100}%, #333 100%)`,
                outline: 'none',
                cursor: 'pointer',
                WebkitAppearance: 'none',
              }}
            />
          </div>

          {/* Playlist & Close */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setShowPlaylist(!showPlaylist)}
              style={{
                padding: '10px 15px',
                background: showPlaylist ? '#4285f4' : '#444',
                color: '#fff',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
              title="רשימת שירים"
            >
              📋
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '10px 15px',
                background: '#333',
                color: '#fff',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
              title="סגור"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {/* Playlist Sidebar */}
      {showPlaylist && (
        <div style={{
          position: 'fixed',
          bottom: '140px',
          right: '20px',
          width: '350px',
          maxHeight: '400px',
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '8px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.8)',
          zIndex: 1001,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            padding: '15px',
            borderBottom: '1px solid #333',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '16px' }}>
              רשימת שירים ({playlist.length})
            </h3>
            <button
              onClick={() => setShowPlaylist(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#aaa',
                cursor: 'pointer',
                fontSize: '18px',
              }}
            >
              ✕
            </button>
          </div>
          <div style={{
            overflowY: 'auto',
            flex: 1,
          }}>
            {playlist.map((song, index) => (
              <div
                key={song.id}
                onClick={() => {
                  onSongChange(song)
                  setShowPlaylist(false)
                }}
                style={{
                  padding: '12px 15px',
                  background: index === currentIndex ? '#4285f4' : 'transparent',
                  color: index === currentIndex ? '#fff' : '#aaa',
                  cursor: 'pointer',
                  borderBottom: '1px solid #222',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (index !== currentIndex) {
                    e.currentTarget.style.background = '#252525'
                  }
                }}
                onMouseLeave={(e) => {
                  if (index !== currentIndex) {
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                <span style={{ fontSize: '14px' }}>
                  {index === currentIndex && isPlaying ? '▶' : index + 1}
                </span>
                <span style={{ flex: 1, fontSize: '14px' }}>{song.name}</span>
                {index === currentIndex && (
                  <span style={{ fontSize: '12px' }}>●</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audio Element */}
      <audio
        ref={audioRef}
        preload="metadata"
      />
    </>
  )
}
