import { useState, useEffect } from 'react'
import { getLogs } from '../utils/logger'

export default function ConsoleLogger() {
  const [logs, setLogs] = useState(getLogs())
  const [isOpen, setIsOpen] = useState(true)

  useEffect(() => {
    const handleLogUpdate = () => {
      setLogs(getLogs())
    }
    
    window.addEventListener('log-update', handleLogUpdate)
    return () => window.removeEventListener('log-update', handleLogUpdate)
  }, [])

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: 10,
          left: 10,
          padding: '10px 20px',
          background: '#333',
          color: '#fff',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          zIndex: 1001,
        }}
      >
        פתח לוגים ({logs.length})
      </button>
    )
  }

  return (
    <div className="console-log">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '14px' }}>לוגים ({logs.length})</h3>
        <button
          onClick={() => setIsOpen(false)}
          style={{
            padding: '5px 10px',
            background: '#444',
            color: '#fff',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
          }}
        >
          סגור
        </button>
      </div>
      <div>
        {logs.slice(-50).reverse().map((log, index) => (
          <div key={index} className={`log-entry ${log.type}`}>
            <span style={{ color: '#888', marginLeft: '10px' }}>{log.time}</span>
            <span>{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

