// Console logger for debugging
const logs: Array<{ time: string; message: string; type: 'info' | 'warn' | 'error' }> = []

export function log(message: string, type: 'info' | 'warn' | 'error' = 'info') {
  const time = new Date().toLocaleTimeString('he-IL')
  const logEntry = { time, message, type }
  logs.push(logEntry)
  
  // Keep only last 100 logs
  if (logs.length > 100) {
    logs.shift()
  }
  
  // Also log to browser console
  console[type === 'error' ? 'error' : type === 'warn' ? 'warn' : 'log'](`[${time}] ${message}`)
  
  // Trigger update event
  window.dispatchEvent(new CustomEvent('log-update', { detail: logEntry }))
}

export function getLogs() {
  return [...logs]
}

