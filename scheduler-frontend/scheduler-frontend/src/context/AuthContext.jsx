import { createContext, useContext, useEffect, useState } from 'react'
import * as api from '../api/endpoints'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('auth_user')
    return stored ? JSON.parse(stored) : null
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      setLoading(false)
      return
    }
    // Verify the stored token is still valid and refresh user details.
    api
      .fetchCurrentUser()
      .then((res) => {
        setUser(res.data)
        localStorage.setItem('auth_user', JSON.stringify(res.data))
      })
      .catch(() => {
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  async function signIn(credentials) {
    const res = await api.login(credentials)
    const { token, user: signedInUser, expires_at } = res.data
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_user', JSON.stringify(signedInUser))
    if (expires_at) {
      localStorage.setItem('auth_expires_at', expires_at)
    }
    setUser(signedInUser)
    return signedInUser
  }

  async function signInWithGoogle() {
    // Step 1: Get the Google OAuth redirect URL
    const redirectRes = await api.getGoogleRedirect()
    const redirectUrl = redirectRes.data.redirect

    // Step 2: Redirect the entire window (avoids COOP blocking popup.closed)
    window.location.href = redirectUrl
  }

  async function signOut() {
    try {
      await api.logout()
    } catch {
      // Ignore network errors on logout — clear local state regardless.
    }
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    setUser(null)
  }

  async function refreshUser() {
    const res = await api.fetchCurrentUser()
    const refreshedUser = res.data
    localStorage.setItem('auth_user', JSON.stringify(refreshedUser))
    setUser(refreshedUser)
    return refreshedUser
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signInWithGoogle, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
