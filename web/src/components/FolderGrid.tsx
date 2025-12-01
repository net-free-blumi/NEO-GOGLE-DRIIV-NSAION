import { useState, useEffect } from 'react'
import { FolderStructure, DriveFile } from '../types/drive'

// Get window width for responsive design
const getWindowWidth = () => typeof window !== 'undefined' ? window.innerWidth : 1024

interface FolderGridProps {
  folder: FolderStructure
  onFileClick: (file: DriveFile) => void
  expandedFolderId: string | null
  onFolderToggle: (folderId: string) => void
  level?: number
}

export default function FolderGrid({
  folder,
  onFileClick,
  expandedFolderId,
  onFolderToggle,
  level = 0
}: FolderGridProps) {
  const isExpanded = expandedFolderId === folder.id
  const [windowWidth, setWindowWidth] = useState(getWindowWidth())

  // Track window resize for responsive design
  useEffect(() => {
    const handleResize = () => setWindowWidth(getWindowWidth())
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Use windowWidth for responsive grid
  const gridColumns = windowWidth < 768 
    ? 'repeat(auto-fill, minmax(120px, 1fr))'
    : windowWidth < 1024
    ? 'repeat(auto-fill, minmax(140px, 1fr))'
    : 'repeat(auto-fill, minmax(160px, 1fr))'

  return (
    <div style={{ marginBottom: '24px' }}>
      {/* Folder Header */}
      <div
        onClick={() => onFolderToggle(folder.id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '12px 16px',
          background: level === 0 ? '#1e1e1e' : '#252525',
          borderRadius: '12px',
          cursor: 'pointer',
          marginBottom: '16px',
          transition: 'all 0.2s',
          border: '1px solid #333',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = level === 0 ? '#252525' : '#2a2a2a'
          e.currentTarget.style.borderColor = '#444'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = level === 0 ? '#1e1e1e' : '#252525'
          e.currentTarget.style.borderColor = '#333'
        }}
      >
        <span style={{ fontSize: '24px', marginLeft: '12px' }}>
          {isExpanded ? '📂' : '📁'}
        </span>
        <span style={{ 
          fontWeight: '600', 
          flex: 1,
          fontSize: level === 0 ? '18px' : '16px',
          color: '#fff'
        }}>
          {folder.name}
        </span>
        <span style={{ fontSize: '13px', color: '#aaa', marginLeft: '12px' }}>
          {folder.folders.length > 0 && `${folder.folders.length} תיקיות`}
          {folder.folders.length > 0 && folder.files.length > 0 && ' • '}
          {folder.files.length > 0 && `${folder.files.length} שירים`}
        </span>
        <span style={{ fontSize: '20px', marginRight: '8px', color: '#666' }}>
          {isExpanded ? '▼' : '▶'}
        </span>
      </div>

      {/* Expanded Content - Grid View */}
      {isExpanded && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: gridColumns,
          gap: windowWidth < 768 ? '12px' : '16px',
          marginBottom: '24px',
          padding: level > 0 ? '0 0 0 24px' : '0',
        }}>
          {/* Subfolders */}
          {folder.folders.map((subFolder) => (
            <div
              key={subFolder.id}
              onClick={() => onFolderToggle(subFolder.id)}
              style={{
                aspectRatio: '1',
                background: 'linear-gradient(135deg, #2a2a2a 0%, #1e1e1e 100%)',
                borderRadius: '12px',
                border: '1px solid #333',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                padding: '20px',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)'
                e.currentTarget.style.borderColor = '#555'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.borderColor = '#333'
              }}
            >
              <div style={{
                fontSize: '48px',
                marginBottom: '12px',
                filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))',
              }}>
                📁
              </div>
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#fff',
                textAlign: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                lineHeight: '1.4',
                width: '100%',
              }}>
                {subFolder.name}
              </div>
              <div style={{
                fontSize: '11px',
                color: '#aaa',
                marginTop: '8px',
                textAlign: 'center',
              }}>
                {subFolder.folders.length + subFolder.files.length} פריטים
              </div>
            </div>
          ))}

          {/* Audio Files */}
          {folder.files.map((file) => (
            <div
              key={file.id}
              onClick={() => onFileClick(file)}
              style={{
                aspectRatio: '1',
                background: 'linear-gradient(135deg, #2a2a2a 0%, #1e1e1e 100%)',
                borderRadius: '12px',
                border: '1px solid #333',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                padding: '20px',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(66, 133, 244, 0.3)'
                e.currentTarget.style.borderColor = '#4285f4'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.borderColor = '#333'
              }}
            >
              {/* Album Art */}
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '8px',
                background: file.thumbnailLink 
                  ? `url(${file.thumbnailLink}) center/cover`
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: file.thumbnailLink ? '0' : '36px',
                marginBottom: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                border: '2px solid #333',
              }}>
                {!file.thumbnailLink && '🎵'}
              </div>
              <div style={{
                fontSize: '13px',
                fontWeight: '600',
                color: '#fff',
                textAlign: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                lineHeight: '1.4',
                width: '100%',
              }}>
                {file.name}
              </div>
              {file.size && (
                <div style={{
                  fontSize: '10px',
                  color: '#aaa',
                  marginTop: '6px',
                }}>
                  {(parseInt(file.size) / 1024 / 1024).toFixed(1)} MB
                </div>
              )}
              {/* Play Icon Overlay */}
              <div style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(66, 133, 244, 0.9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                opacity: 0,
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1'
              }}
              >
                ▶
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recursively render expanded subfolders */}
      {isExpanded && folder.folders.map((subFolder) => (
        <FolderGrid
          key={subFolder.id}
          folder={subFolder}
          onFileClick={onFileClick}
          expandedFolderId={expandedFolderId}
          onFolderToggle={onFolderToggle}
          level={level + 1}
        />
      ))}
    </div>
  )
}

