import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
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
const REDIRECT_URI = window.location.origin + '/callback'
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [accessToken, setAccessTokenState] = useState<string | null>(null)

  useEffect(() => {
    // Check if we have stored token
    const storedToken = localStorage.getItem('access_token')
    const storedRefreshToken = localStorage.getItem('refresh_token')
    
    log('Checking stored tokens...', 'info')
    log(`Access token exists: ${!!storedToken}`, 'info')
    log(`Refresh token exists: ${!!storedRefreshToken}`, 'info')
    
    if (storedToken && storedRefreshToken) {
      // Verify token is still valid
      verifyToken(storedToken).then(isValid => {
        if (isValid) {
          log('Stored token is valid', 'info')
          setAccessTokenState(storedToken)
          setIsAuthenticated(true)
        } else {
          log('Stored token expired, refreshing...', 'warn')
          refreshAccessToken(storedRefreshToken)
        }
      })
    }
  }, [])

  const verifyToken = async (token: string): Promise<boolean> => {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + token)
      return response.ok
    } catch (error) {
      log(`Token verification failed: ${error}`, 'error')
      return false
    }
  }

  const refreshAccessToken = async (refreshToken: string) => {
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
      } else {
        log(`Token refresh failed: ${JSON.stringify(data)}`, 'error')
        logout()
      }
    } catch (error) {
      log(`Token refresh error: ${error}`, 'error')
      logout()
    }
  }

  const login = () => {
    log('Initiating Google OAuth login...', 'info')
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(SCOPES)}&` +
      `access_type=offline&` +
      `prompt=consent`
    
    log(`Redirecting to: ${authUrl}`, 'info')
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

