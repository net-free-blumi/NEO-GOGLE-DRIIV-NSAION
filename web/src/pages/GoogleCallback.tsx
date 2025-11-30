import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { log } from '../utils/logger'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET || ''
// Redirect URI is calculated dynamically based on current origin
const getRedirectUri = () => window.location.origin + '/callback'

// Validate configuration
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('⚠️ Missing Google OAuth credentials in .env file!')
}

// Global flag to prevent duplicate processing (survives React StrictMode)
let isProcessing = false

export default function GoogleCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setAccessToken } = useAuth()
  const hasProcessedRef = useRef(false)

  useEffect(() => {
    // Prevent multiple executions (even with React StrictMode)
    if (hasProcessedRef.current || isProcessing) {
      log('Already processed callback, skipping...', 'info')
      return
    }

    const code = searchParams.get('code')
    const error = searchParams.get('error')

    log('OAuth callback received', 'info')
    log(`Code: ${code ? 'present' : 'missing'}`, 'info')
    log(`Error: ${error || 'none'}`, error ? 'error' : 'info')

    if (error) {
      log(`OAuth error: ${error}`, 'error')
      hasProcessedRef.current = true
      isProcessing = false
      navigate('/login', { replace: true })
      return
    }

    if (!code) {
      log('No authorization code received', 'error')
      hasProcessedRef.current = true
      isProcessing = false
      navigate('/login', { replace: true })
      return
    }

    // Mark as processed immediately to prevent duplicate calls
    hasProcessedRef.current = true
    isProcessing = true

    // Exchange code for tokens
    exchangeCodeForTokens(code).finally(() => {
      isProcessing = false
    })
  }, [searchParams, navigate, setAccessToken])

  const exchangeCodeForTokens = async (code: string): Promise<void> => {
    if (!CLIENT_ID || !CLIENT_SECRET) {
      log('❌ Missing OAuth credentials!', 'error')
      alert('שגיאה: חסרים credentials. אנא בדוק את קובץ .env')
      navigate('/login', { replace: true })
      return
    }
    
    try {
      log('Exchanging authorization code for tokens...', 'info')
      log(`Using Client ID: ${CLIENT_ID.substring(0, 20)}...`, 'info')
      const redirectUri = getRedirectUri()
      log(`Redirect URI: ${redirectUri}`, 'info')
      log(`⚠️ Make sure this redirect URI is added to Google Cloud Console!`, 'warn')
      
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      })

      log(`Token exchange response status: ${response.status}`, 'info')

      const data = await response.json()
      
      log(`Token response: ${JSON.stringify({ ...data, access_token: data.access_token ? '***' : null, refresh_token: data.refresh_token ? '***' : null })}`, 'info')

      if (data.access_token) {
        log('Access token received successfully', 'info')
        
        // Store tokens
        localStorage.setItem('access_token', data.access_token)
        if (data.refresh_token) {
          log('Refresh token received, storing...', 'info')
          localStorage.setItem('refresh_token', data.refresh_token)
        }
        
        // Set token in context
        setAccessToken(data.access_token)
        
        // Navigate to home
        log('Redirecting to home page...', 'info')
        navigate('/home', { replace: true })
      } else {
        log(`Token exchange failed: ${JSON.stringify(data)}`, 'error')
        if (data.error === 'invalid_client') {
          log('❌ Client Secret is wrong or missing!', 'error')
          alert('שגיאה: Client Secret לא נכון או חסר. אנא בדוק את קובץ .env והוסף את ה-Client Secret מה-Google Console.')
        } else if (data.error === 'invalid_grant') {
          log('❌ Authorization code already used or expired!', 'error')
          // Clear any invalid tokens
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          alert('הקוד כבר שימש או פג תוקף. אנא נסה להתחבר שוב.')
        }
        navigate('/login', { replace: true })
      }
    } catch (error) {
      log(`Token exchange error: ${error}`, 'error')
      navigate('/login', { replace: true })
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

