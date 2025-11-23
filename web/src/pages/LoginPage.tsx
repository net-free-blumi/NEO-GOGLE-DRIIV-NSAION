import { useAuth } from '../contexts/AuthContext'
import { log } from '../utils/logger'

export default function LoginPage() {
  const { login } = useAuth()

  const handleLogin = () => {
    log('Login button clicked', 'info')
    login()
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: '#121212',
    }}>
      <h1 style={{ marginBottom: '20px', color: '#fff' }}>Music Player</h1>
      <p style={{ marginBottom: '40px', color: '#aaa', textAlign: 'center' }}>
        התחבר עם Google Drive
      </p>
      <button
        onClick={handleLogin}
        style={{
          padding: '15px 30px',
          fontSize: '16px',
          background: '#4285f4',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 'bold',
        }}
      >
        התחבר עם Google
      </button>
    </div>
  )
}

