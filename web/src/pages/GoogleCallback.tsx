import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { log } from '../utils/logger'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET || ''
const REDIRECT_URI = window.location.origin + '/callback'

export default function GoogleCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setAccessToken } = useAuth()

  useEffect(() => {
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    log('OAuth callback received', 'info')
    log(`Code: ${code ? 'present' : 'missing'}`, 'info')
    log(`Error: ${error || 'none'}`, error ? 'error' : 'info')

    if (error) {
      log(`OAuth error: ${error}`, 'error')
      navigate('/login')
      return
    }

    if (!code) {
      log('No authorization code received', 'error')
      navigate('/login')
      return
    }

    // Exchange code for tokens
    exchangeCodeForTokens(code)
  }, [searchParams, navigate, setAccessToken])

  const exchangeCodeForTokens = async (code: string) => {
    try {
      log('Exchanging authorization code for tokens...', 'info')
      
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      })

      log(`Token exchange response status: ${response.status}`, 'info')

      const data = await response.json()
      
      log(`Token response: ${JSON.stringify({ ...data, access_token: data.access_token ? '***' : null, refresh_token: data.refresh_token ? '***' : null })}`, 'info')

      if (data.access_token) {
        log('Access token received successfully', 'info')
        setAccessToken(data.access_token)
        
        if (data.refresh_token) {
          log('Refresh token received, storing...', 'info')
          localStorage.setItem('refresh_token', data.refresh_token)
        }
        
        navigate('/home')
      } else {
        log(`Token exchange failed: ${JSON.stringify(data)}`, 'error')
        navigate('/login')
      }
    } catch (error) {
      log(`Token exchange error: ${error}`, 'error')
      navigate('/login')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#121212',
    }}>
      <div style={{ color: '#fff', textAlign: 'center' }}>
        <p>מטפל בהתחברות...</p>
      </div>
    </div>
  )
}

