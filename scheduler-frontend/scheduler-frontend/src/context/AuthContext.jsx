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

    // Step 2: Open the Google OAuth popup
    const width = 500
    const height = 600
    const left = window.screen.width / 2 - width / 2
    const top = window.screen.height / 2 - height / 2

    const popup = window.open(
      redirectUrl,
      'google_oauth',
      `width=${width},height=${height},left=${left},top=${top}`
    )

    if (!popup) {
      throw new Error('Popup was blocked. Please allow popups and try again.')
    }

    // Step 3: Poll for the auth_token in localStorage (set by callback page)
    return new Promise((resolve, reject) => {
      let checks = 0
      const maxChecks = 120 // 60 seconds at 500ms intervals

      const timer = setInterval(() => {
        const token = localStorage.getItem('auth_token')
        const user = localStorage.getItem('auth_user')
        const googleAuth = localStorage.getItem('google_auth_success')

        if (googleAuth === 'true' && token && user) {
          clearInterval(timer)
          localStorage.removeItem('google_auth_success')
          setUser(JSON.parse(user))
          resolve(JSON.parse(user))
        } else if (googleAuth === 'false' || popup.closed) {
          // Error or popup closed
          clearInterval(timer)
          localStorage.removeItem('google_auth_success')
          reject(new Error('Google authentication was cancelled or failed.'))
        } else if (checks >= maxChecks) {
          clearInterval(timer)
          reject(new Error('Google authentication timed out.'))
        } else {
          checks++
        }
      }, 500)
    })
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
