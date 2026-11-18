import { createContext, useContext, useEffect, useState } from 'react'
import * as api from '../api/endpoints'
import { clearAllCache } from '../utils/cache'
import { ToastProvider } from '../components/Toast'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const handleUnauthorized = () => {
      clearAllCache()
      setUser(null)
    }
    window.addEventListener('auth:unauthorized', handleUnauthorized)

    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    localStorage.removeItem('auth_expires_at')
    localStorage.removeItem('google_registration_token')
    sessionStorage.removeItem('auth_token')
    sessionStorage.removeItem('auth_user')

    api
      .fetchCurrentUser()
      .then((res) => {
        setUser(res.data)
      })
      .catch(() => {
        setUser(null)
      })
      .finally(() => setLoading(false))

    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized)
  }, [])

  async function signIn(credentials) {
    const res = await api.login(credentials)
    const { user: signedInUser } = res.data
    setUser(signedInUser)
    return signedInUser
  }

  async function signInWithGoogle() {
    // Step 1: Get the Google OAuth redirect URL
    const redirectRes = await api.getGoogleRedirect()
    const redirectUrl = redirectRes.data.redirect
    const state = new URL(redirectUrl).searchParams.get("state")
    if (!state) {
      throw new Error("Google sign-in did not provide an OAuth state value.")
    }
    sessionStorage.setItem("google_oauth_state", state)

    // Step 2: Redirect the entire window (avoids COOP blocking popup.closed)
    window.location.href = redirectUrl
  }

  async function signOut() {
    try {
      await api.logout()
    } catch (error) {
      if (error.response?.status !== 401) {
        throw error
      }
    }
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    localStorage.removeItem('auth_expires_at')
    localStorage.removeItem('google_auth_success')
    localStorage.removeItem('google_registration_token')
    sessionStorage.removeItem('google_oauth_state')
    sessionStorage.removeItem('auth_token')
    sessionStorage.removeItem('auth_user')
    // Clear data cache on logout
    clearAllCache()
    setUser(null)
  }

  async function refreshUser() {
    const res = await api.fetchCurrentUser()
    const refreshedUser = res.data
    setUser(refreshedUser)
    return refreshedUser
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signInWithGoogle, signOut, refreshUser }}>
      <ToastProvider>{children}</ToastProvider>
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
