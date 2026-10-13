import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import * as api from '../api/notifications'
import { useAuth } from './AuthContext'

const NotificationContext = createContext(null)

// Polling interval for real-time-ish updates (no websockets needed)
const POLL_INTERVAL = 30_000

export function NotificationProvider({ children }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const fetchNotifications = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const res = await api.fetchNotifications()
      const data = Array.isArray(res?.data?.data) ? res.data.data
                : Array.isArray(res?.data) ? res.data
                : []
      setNotifications(data)
      setUnreadCount(data.filter(n => !n.is_read).length)
      setError(null)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }, [user])

  // Fetch on mount and when user changes
  useEffect(() => {
    if (user) {
      fetchNotifications()
    }
  }, [user, fetchNotifications])

  // Poll for new notifications
  useEffect(() => {
    if (!user) return
    const interval = setInterval(() => {
      fetchNotifications()
    }, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [user, fetchNotifications])

  // Optimistically mark a single notification as read
  const markAsRead = useCallback(async (id) => {
    setNotifications(prev =>
      prev.map(n => (n.notif_id === id || n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
    try {
      await api.markNotificationRead(id)
    } catch (e) {
      // Revert on failure
      setNotifications(prev =>
        prev.map(n => (n.notif_id === id || n.id === id ? { ...n, is_read: false, read_at: null } : n))
      )
      setUnreadCount(prev => prev + 1)
      throw e
    }
  }, [])

  // Optimistically mark all as read
  const markAllAsRead = useCallback(async () => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
    )
    setUnreadCount(0)
    try {
      await api.markAllNotificationsRead()
    } catch (e) {
      // Revert on failure
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: false, read_at: null }))
      )
      setUnreadCount(prev => prev)
      throw e
    }
  }, [])

  // Optimistically delete a notification
  const deleteNotification = useCallback(async (id) => {
    setNotifications(prev => prev.filter(n => n.notif_id !== id && n.id !== id))
    setUnreadCount(prev => {
      const notif = notifications.find(n => n.notif_id === id || n.id === id)
      return notif && !notif.is_read ? Math.max(0, prev - 1) : prev
    })
    try {
      await api.deleteNotification(id)
    } catch (e) {
      // Revert on failure
      fetchNotifications()
      throw e
    }
  }, [notifications, fetchNotifications])

  const refreshUnreadCount = useCallback(() => {
    setUnreadCount(notifications.filter(n => !n.is_read).length)
  }, [notifications])

  const toggleDropdown = useCallback(() => {
    setDropdownOpen(prev => !prev)
  }, [])

  const closeDropdown = useCallback(() => {
    setDropdownOpen(false)
  }, [])

  // Recalculate unread count whenever notifications change
  useEffect(() => {
    refreshUnreadCount()
  }, [notifications, refreshUnreadCount])

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        error,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        toggleDropdown,
        closeDropdown,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationProvider')
  }
  return ctx
}

export default useNotifications
