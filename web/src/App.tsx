import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import GoogleCallback from './pages/GoogleCallback'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ConsoleLogger from './components/ConsoleLogger'

function AppRoutes() {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/callback" element={<GoogleCallback />} />
      <Route 
        path="/home" 
        element={isAuthenticated ? <HomePage /> : <Navigate to="/login" />} 
      />
      <Route path="/" element={<Navigate to={isAuthenticated ? "/home" : "/login"} />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div style={{ minHeight: '100vh', background: '#121212' }}>
          <AppRoutes />
          <ConsoleLogger />
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App

