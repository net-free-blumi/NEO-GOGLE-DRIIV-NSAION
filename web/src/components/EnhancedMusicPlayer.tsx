import { useState, useRef, useEffect } from 'react'
import { log } from '../utils/logger'

interface Song {
  id: string
  name: string
  streamUrl: string
  albumArt?: string
}

interface EnhancedMusicPlayerProps {
  currentSong: Song | null
  playlist: Song[]
  currentIndex: number
  onClose: () => void
  onNext: () => void
  onPrevious: () => void
  onSongChange: (song: Song) => void
  onSeek?: (time: number) => void
}

export default function EnhancedMusicPlayer({ 
  currentSong, 
  playlist, 
  currentIndex,
  onClose, 
  onNext, 
  onPrevious,
  onSongChange,
  onSeek
}: EnhancedMusicPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPlaylist, setShowPlaylist] = useState(false)
  const [showVolumeControl, setShowVolumeControl] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDevice, setSelectedDevice] = useState<string>('default')
  const [windowWidth, setWindowWidth] = useState(getWindowWidth())

  // Track window resize for responsive design
  useEffect(() => {
    const handleResize = () => setWindowWidth(getWindowWidth())
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Load audio devices
  useEffect(() => {
    const loadDevices = async () => {
      try {
        // Request permission for device enumeration
        await navigator.mediaDevices.getUserMedia({ audio: true })
        const devices = await navigator.mediaDevices.enumerateDevices()
        const audioOutputs = devices.filter(device => device.kind === 'audiooutput')
        setAudioDevices(audioOutputs)
        log(`Found ${audioOutputs.length} audio output devices`, 'info')
      } catch (err) {
        log(`Error loading audio devices: ${err}`, 'warn')
      }
    }
    loadDevices()
  }, [])

  // Set audio output device
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !('setSinkId' in audio)) return

    if (selectedDevice && selectedDevice !== 'default') {
      (audio as any).setSinkId(selectedDevice).catch((err: any) => {
        log(`Error setting audio device: ${err}`, 'warn')
      })
    }
  }, [selectedDevice])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateTime = () => {
      if (!isDragging) {
        setCurrentTime(audio.currentTime)
      }
    }
    const updateDuration = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration)
      }
    }
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
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
    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration)
      }
    }

    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('durationchange', updateDuration)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('durationchange', updateDuration)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }
  }, [currentIndex, playlist.length, onNext, isDragging])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentSong) return

    log(`Loading audio: ${currentSong.name}`, 'info')
    
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setError(null)
    
    audio.pause()
    audio.src = currentSong.streamUrl
    audio.load()
    
    // Try to play automatically
    audio.play().catch(err => {
      log(`Auto-play prevented: ${err}`, 'info')
    })
  }, [currentSong])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = isMuted ? 0 : volume
  }, [volume, isMuted])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play().catch(err => {
        log(`Error playing audio: ${err}`, 'error')
        setError('שגיאה בנגינה')
      })
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio) return
    const newTime = parseFloat(e.target.value)
    audio.currentTime = newTime
    setCurrentTime(newTime)
    if (onSeek) onSeek(newTime)
  }

  const handleSeekStart = () => {
    setIsDragging(true)
  }

  const handleSeekEnd = () => {
    setIsDragging(false)
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
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!currentSong) return null

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <>
      {/* Main Player - Fixed at bottom */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%)',
        borderTop: '2px solid #333',
        padding: '16px 20px',
        zIndex: 1000,
        boxShadow: '0 -8px 32px rgba(0,0,0,0.9)',
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{ 
          maxWidth: '1400px', 
          margin: '0 auto',
          display: 'flex', 
          alignItems: 'center', 
          gap: '20px',
          flexWrap: 'wrap'
        }}>
          {/* Album Art / Icon */}
          <div style={{
            width: windowWidth < 768 ? '56px' : '70px',
            height: windowWidth < 768 ? '56px' : '70px',
            borderRadius: '12px',
            background: currentSong.albumArt 
              ? `url(${currentSong.albumArt}) center/cover`
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: windowWidth < 768 ? '24px' : '32px',
            flexShrink: 0,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            border: '2px solid #333',
          }}>
            {!currentSong.albumArt && '🎵'}
          </div>

          {/* Song Info */}
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ 
              fontWeight: '600', 
              marginBottom: '4px', 
              color: '#fff',
              fontSize: '16px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {currentSong.name}
            </div>
            {error ? (
              <div style={{ fontSize: '12px', color: '#ff6b6b' }}>
                {error}
              </div>
            ) : (
              <div style={{ fontSize: '13px', color: '#aaa' }}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            )}
          </div>

          {/* Main Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={onPrevious}
              disabled={currentIndex === 0}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: currentIndex === 0 ? '#2a2a2a' : '#3a3a3a',
                border: 'none',
                color: '#fff',
                cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                fontSize: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: currentIndex === 0 ? 0.5 : 1,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (currentIndex > 0) {
                  e.currentTarget.style.background = '#4a4a4a'
                  e.currentTarget.style.transform = 'scale(1.1)'
                }
              }}
              onMouseLeave={(e) => {
                if (currentIndex > 0) {
                  e.currentTarget.style.background = '#3a3a3a'
                  e.currentTarget.style.transform = 'scale(1)'
                }
              }}
              title="שיר קודם"
            >
              ⏮
            </button>
            
            <button
              onClick={togglePlay}
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: isPlaying ? '#ff4444' : '#4285f4',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isPlaying 
                  ? '0 4px 20px rgba(255, 68, 68, 0.5)'
                  : '0 4px 20px rgba(66, 133, 244, 0.5)',
                transition: 'all 0.2s',
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
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: currentIndex >= playlist.length - 1 ? '#2a2a2a' : '#3a3a3a',
                border: 'none',
                color: '#fff',
                cursor: currentIndex >= playlist.length - 1 ? 'not-allowed' : 'pointer',
                fontSize: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: currentIndex >= playlist.length - 1 ? 0.5 : 1,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (currentIndex < playlist.length - 1) {
                  e.currentTarget.style.background = '#4a4a4a'
                  e.currentTarget.style.transform = 'scale(1.1)'
                }
              }}
              onMouseLeave={(e) => {
                if (currentIndex < playlist.length - 1) {
                  e.currentTarget.style.background = '#3a3a3a'
                  e.currentTarget.style.transform = 'scale(1)'
                }
              }}
              title="שיר הבא"
            >
              ⏭
            </button>
          </div>

          {/* Progress Bar */}
          <div style={{ flex: 2, minWidth: '250px', position: 'relative' }}>
            <input
              type="range"
              min="0"
              max={duration || 0}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              onMouseDown={handleSeekStart}
              onMouseUp={handleSeekEnd}
              onTouchStart={handleSeekStart}
              onTouchEnd={handleSeekEnd}
              style={{
                width: '100%',
                height: '8px',
                borderRadius: '4px',
                background: `linear-gradient(to right, #4285f4 0%, #4285f4 ${progressPercent}%, #444 ${progressPercent}%, #444 100%)`,
                outline: 'none',
                cursor: 'pointer',
                WebkitAppearance: 'none',
                appearance: 'none',
              }}
            />
            <div style={{
              position: 'absolute',
              top: '-20px',
              left: `${progressPercent}%`,
              transform: 'translateX(-50%)',
              fontSize: '11px',
              color: '#aaa',
              whiteSpace: 'nowrap',
            }}>
              {formatTime(currentTime)}
            </div>
          </div>

          {/* Volume Control */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px', 
            minWidth: '120px',
            position: 'relative'
          }}>
            <button
              onClick={toggleMute}
              onMouseEnter={() => setShowVolumeControl(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#aaa',
                cursor: 'pointer',
                fontSize: '22px',
                padding: '5px',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#fff'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#aaa'
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
                height: '6px',
                borderRadius: '3px',
                background: `linear-gradient(to right, #4285f4 0%, #4285f4 ${(isMuted ? 0 : volume) * 100}%, #444 ${(isMuted ? 0 : volume) * 100}%, #444 100%)`,
                outline: 'none',
                cursor: 'pointer',
                WebkitAppearance: 'none',
                appearance: 'none',
              }}
            />
            {showVolumeControl && audioDevices.length > 0 && (
              <div style={{
                position: 'absolute',
                bottom: '50px',
                right: 0,
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '8px',
                padding: '10px',
                minWidth: '200px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.8)',
                zIndex: 1002,
              }}
              onMouseLeave={() => setShowVolumeControl(false)}
              >
                <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '8px' }}>
                  בחר רמקול:
                </div>
                <select
                  value={selectedDevice}
                  onChange={(e) => setSelectedDevice(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: '#2a2a2a',
                    color: '#fff',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    fontSize: '13px',
                  }}
                >
                  <option value="default">ברירת מחדל</option>
                  {audioDevices.map(device => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `רמקול ${device.deviceId.substring(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Playlist & Close */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setShowPlaylist(!showPlaylist)}
              style={{
                padding: '10px 14px',
                background: showPlaylist ? '#4285f4' : '#3a3a3a',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!showPlaylist) {
                  e.currentTarget.style.background = '#4a4a4a'
                }
              }}
              onMouseLeave={(e) => {
                if (!showPlaylist) {
                  e.currentTarget.style.background = '#3a3a3a'
                }
              }}
              title="רשימת שירים"
            >
              📋
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '10px 14px',
                background: '#2a2a2a',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#3a3a3a'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#2a2a2a'
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
          bottom: '110px',
          right: '20px',
          width: 'min(400px, calc(100vw - 40px))',
          maxHeight: '500px',
          background: '#1a1a1a',
          border: '2px solid #333',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.9)',
          zIndex: 1001,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            padding: '16px',
            borderBottom: '1px solid #333',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#222',
          }}>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '16px', fontWeight: '600' }}>
              רשימת שירים ({playlist.length})
            </h3>
            <button
              onClick={() => setShowPlaylist(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#aaa',
                cursor: 'pointer',
                fontSize: '20px',
                padding: '4px',
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
                  padding: '14px 16px',
                  background: index === currentIndex ? '#4285f4' : 'transparent',
                  color: index === currentIndex ? '#fff' : '#aaa',
                  cursor: 'pointer',
                  borderBottom: '1px solid #222',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (index !== currentIndex) {
                    e.currentTarget.style.background = '#252525'
                    e.currentTarget.style.color = '#fff'
                  }
                }}
                onMouseLeave={(e) => {
                  if (index !== currentIndex) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = '#aaa'
                  }
                }}
              >
                <span style={{ fontSize: '14px', minWidth: '24px' }}>
                  {index === currentIndex && isPlaying ? '▶' : index + 1}
                </span>
                <span style={{ flex: 1, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {song.name}
                </span>
                {index === currentIndex && (
                  <span style={{ fontSize: '12px', color: '#fff' }}>●</span>
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
        crossOrigin="anonymous"
      />
    </>
  )
}

