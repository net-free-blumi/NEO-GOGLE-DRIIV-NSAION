import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { log } from '../utils/logger'

interface AuthContextType {
  isAuthenticated: boolean
  accessToken: string | null
  login: () => void
  logout: () => void
  setAccessToken: (token: string) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET || ''
// Redirect URI is calculated dynamically based on current origin
// This works for both localhost and production (Netlify)
const getRedirectUri = () => window.location.origin + '/callback'
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly'

// Validate configuration on load
if (!CLIENT_ID) {
  console.error('⚠️ VITE_GOOGLE_CLIENT_ID is missing! Please create a .env file with your credentials.')
}
if (!CLIENT_SECRET) {
  console.error('⚠️ VITE_GOOGLE_CLIENT_SECRET is missing! Please create a .env file with your credentials.')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [accessToken, setAccessTokenState] = useState<string | null>(null)

  const initializedRef = useRef(false)

  useEffect(() => {
    // Prevent multiple initializations (React StrictMode runs twice in dev)
    if (initializedRef.current) {
      return
    }
    initializedRef.current = true

    // Check if we have stored token
    const storedToken = localStorage.getItem('access_token')
    const storedRefreshToken = localStorage.getItem('refresh_token')
    
    log('Checking stored tokens on app load...', 'info')
    log(`Access token exists: ${!!storedToken}`, 'info')
    log(`Refresh token exists: ${!!storedRefreshToken}`, 'info')
    
    if (storedToken && storedRefreshToken) {
      // Verify token is still valid
      verifyToken(storedToken).then(isValid => {
        if (isValid) {
          log('Stored token is valid, using it', 'info')
          setAccessTokenState(storedToken)
          setIsAuthenticated(true)
        } else {
          log('Stored token expired, refreshing...', 'warn')
          refreshAccessToken(storedRefreshToken)
        }
      }).catch(err => {
        log(`Token verification error: ${err}, trying refresh...`, 'warn')
        if (storedRefreshToken) {
          refreshAccessToken(storedRefreshToken)
        }
      })
    } else if (storedRefreshToken && !storedToken) {
      // Only refresh token exists, refresh it
      log('Only refresh token exists, refreshing...', 'info')
      refreshAccessToken(storedRefreshToken)
    } else {
      log('No stored tokens found', 'info')
    }
  }, [])

  const verifyToken = async (token: string): Promise<boolean> => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout
      
      const response = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + token, {
        method: 'GET',
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)
      
      if (response.ok) {
        const data = await response.json()
        // Check if token is expired or expires soon
        if (data.expires_in && data.expires_in < 60) {
          log(`Token expires soon (${data.expires_in}s), will refresh`, 'warn')
          return false // Trigger refresh
        }
        return true
      }
      return false
    } catch (error: any) {
      if (error.name === 'AbortError') {
        log('Token verification timeout', 'warn')
      } else {
        log(`Token verification failed: ${error}`, 'warn')
      }
      return false
    }
  }

  const refreshAccessToken = async (refreshToken: string) => {
    if (!CLIENT_ID || !CLIENT_SECRET) {
      log('❌ Missing credentials for token refresh', 'error')
      return
    }

    try {
      log('Refreshing access token...', 'info')
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      })

      const data = await response.json()
      
      if (data.access_token) {
        log('Token refreshed successfully', 'info')
        setAccessTokenState(data.access_token)
        localStorage.setItem('access_token', data.access_token)
        setIsAuthenticated(true)
        
        // If we got a new refresh token, save it
        if (data.refresh_token) {
          log('New refresh token received, saving...', 'info')
          localStorage.setItem('refresh_token', data.refresh_token)
        }
      } else {
        log(`Token refresh failed: ${JSON.stringify(data)}`, 'error')
        if (data.error === 'invalid_grant') {
          log('Refresh token expired or invalid, need to login again', 'error')
          // Clear invalid tokens
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
        }
        logout()
      }
    } catch (error) {
      log(`Token refresh error: ${error}`, 'error')
      logout()
    }
  }

  const login = () => {
    if (!CLIENT_ID) {
      log('❌ Google Client ID is missing! Please check your .env file.', 'error')
      alert('שגיאה: חסר Google Client ID. אנא בדוק את קובץ .env')
      return
    }
    
    // Get current origin (works for both localhost and production)
    const redirectUri = getRedirectUri()
    const currentOrigin = window.location.origin
    
    log('Initiating Google OAuth login...', 'info')
    log(`Client ID: ${CLIENT_ID.substring(0, 20)}...`, 'info')
    log(`Current origin: ${currentOrigin}`, 'info')
    log(`Redirect URI: ${redirectUri}`, 'info')
    log(`⚠️ IMPORTANT: Make sure this redirect URI is added to Google Cloud Console!`, 'warn')
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(SCOPES)}&` +
      `access_type=offline&` +
      `prompt=consent`
    
    log(`Full auth URL: ${authUrl}`, 'info')
    console.log('🔍 Debug - Redirect URI being sent:', redirectUri)
    console.log('🔍 Debug - Encoded redirect URI:', encodeURIComponent(redirectUri))
    
    window.location.href = authUrl
  }

  const logout = () => {
    log('Logging out...', 'info')
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setAccessTokenState(null)
    setIsAuthenticated(false)
  }

  const setAccessToken = (token: string) => {
    log('Setting access token', 'info')
    setAccessTokenState(token)
    localStorage.setItem('access_token', token)
    setIsAuthenticated(true)
  }

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      accessToken,
      login,
      logout,
      setAccessToken,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

