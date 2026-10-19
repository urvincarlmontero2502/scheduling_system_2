import { useEffect, useRef, useState, useCallback } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { createPortal } from "react-dom"
import { X, CheckCheck, Trash2, Clock, CheckCircle, XCircle, Wrench, FileText } from "lucide-react"
import { useNotifications } from "../context/NotificationContext"

// Simple time-ago formatter (no external deps)
const timeAgo = (date) => {
  if (!date) return ""
  // Handle both Unix timestamps (seconds), ISO-8601, and MySQL datetime (space-separated)
  let then;
  if (typeof date === "number") {
    // If timestamp is in seconds (13 digits or less), multiply by 1000
    then = new Date(date < 1e12 ? date * 1000 : date);
  } else if (typeof date === "string") {
    // Convert MySQL datetime (space) to ISO-8601 (T) for reliable parsing
    const isoDate = date.replace(" ", "T");
    then = new Date(isoDate);
  } else {
    then = new Date(date);
  }

  if (isNaN(then.getTime())) return ""

  const now = new Date()
  const diffMs = now - then
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffSec < 5) return "just now"
  if (diffSec < 60) return `${diffSec} sec${diffSec > 1 ? "s" : ""} ago`
  if (diffMin < 60) return `${diffMin} min${diffMin > 1 ? "s" : ""} ago`
  if (diffHr < 24) return `${diffHr} hr${diffHr > 1 ? "s" : ""} ago`
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`
  const diffWk = Math.floor(diffDay / 7)
  return `${diffWk} week${diffWk > 1 ? "s" : ""} ago`
}

export default function NotificationDropdown({ open, onClose, anchorEl }) {
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications()
  const dropdownRef = useRef(null)
  const navigate = useNavigate()
  const [isDesktop, setIsDesktop] = useState(false)

  // Check if we're on desktop (md breakpoint)
  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 768)
    checkDesktop()
    window.addEventListener("resize", checkDesktop)
    return () => window.removeEventListener("resize", checkDesktop)
  }, [])

  // Close on route change
  const currentPath = useLocation().pathname
  useEffect(() => {
    if (open) onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath])

  // Force re-render to recompute bell position on resize or scroll (desktop only)
  const [, forceUpdate] = useState(0)
  const reposition = useCallback(() => {
    if (isDesktop && open) forceUpdate((n) => n + 1)
  }, [isDesktop, open])

  useEffect(() => {
    if (!open || !isDesktop) return
    window.addEventListener("resize", reposition)
    window.addEventListener("scroll", reposition, true)
    return () => {
      window.removeEventListener("resize", reposition)
      window.removeEventListener("scroll", reposition, true)
    }
  }, [open, isDesktop, reposition])

  // Handle clicking a notification item: mark as read, close, navigate to bookings
  const handleNotificationClick = async (id, bookingId) => {
    await handleMarkAsRead(id)
    onClose()
    if (bookingId) {
      navigate(`/bookings?bookingId=${bookingId}`)
    } else {
      navigate("/bookings")
    }
  }

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  // Close when clicking outside
  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [open, onClose])

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead()
    } catch (e) {
      // Error handled in context
    }
  }

  const handleMarkAsRead = async (id) => {
    try {
      await markAsRead(id)
    } catch (e) {
      // Error handled in context
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteNotification(id)
    } catch (e) {
      // Error handled in context
    }
  }

  const getTypeIcon = (type) => {
    switch (type) {
      case "BOOKING_APPROVED":
        return <CheckCircle size={18} className="text-emerald-500" />
      case "BOOKING_REJECTED":
        return <XCircle size={18} className="text-rose-500" />
      case "MAINTENANCE_ALERT":
        return <Wrench size={18} className="text-gray-500" />
      case "BOOKING_SUBMITTED":
        return <FileText size={18} className="text-amber-500" />
      default:
        return <Clock size={18} className="text-steel" />
    }
  }

  if (!open) return null

  // Extract panel content so it can be reused in both portal and inline rendering
  const panelContent = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <h3 className="text-sm font-semibold text-ink">Notifications</h3>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="rounded-lg p-1 text-steel hover:bg-paper hover:text-ink"
              title="Mark all as read"
            >
              <CheckCheck size={16} />
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-steel hover:bg-paper hover:text-ink"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="max-h-[calc(100vh-2rem)] overflow-y-auto">
        {loading && notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-steel">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-6 text-center text-sm text-steel">
            No notifications yet
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {notifications.map((notif) => {
              const id = notif.notif_id || notif.id
              const isUnread = !notif.is_read
              return (
                <li
                  key={id}
                  onClick={() => handleNotificationClick(id, notif.booking_id)}
                  className={`group cursor-pointer px-4 py-3 transition-colors hover:bg-slate-50 ${
                    isUnread ? "bg-brand-light/40" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                      {getTypeIcon(notif.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">
                        {notif.title}
                      </p>
                      <p className="mt-0.5 text-sm text-steel">{notif.message}</p>
                      <p className="mt-1 text-xs text-steel">
                        {timeAgo(notif.created_at)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {isUnread && (
                        <span className="h-2 w-2 rounded-full bg-rose-500" title="Unread" />
                      )}
                      <button
                        onClick={() => handleDelete(id)}
                        className="rounded p-0.5 text-steel opacity-0 hover:text-status-rejected hover:bg-paper transition-opacity group-hover:opacity-100"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="border-t border-line px-4 py-2">
          <button
            onClick={() => {
              handleMarkAllRead()
              onClose()
            }}
            className="w-full text-center text-xs font-medium text-brand hover:text-brand-dark"
          >
            Mark all as read
          </button>
        </div>
      )}
    </>
  )

  // Desktop: use portal with absolute positioning anchored to the bell
  if (isDesktop) {
    const bellRect = anchorEl?.current?.getBoundingClientRect()

    if (!bellRect) {
      // Fallback positioning if anchor not found
      return createPortal(
        <>
          <div
            className="fixed inset-0 z-30 bg-black/30"
            onClick={onClose}
            aria-hidden="true"
          />
          <div
            ref={dropdownRef}
            className="fixed z-40 w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-white shadow-xl"
            style={{
              top: "calc(64px + 1rem)",
              right: "1rem",
              maxHeight: "calc(100vh - 2rem)",
            }}
          >
            {panelContent}
          </div>
        </>,
        document.body
      )
    }

    // Position: to the RIGHT of the sidebar, left = sidebar right edge + 8px
    // Top aligned to the bell's top, clamped so it never goes off the bottom
    const sidebarRight = bellRect.right
    const clampedTop = Math.max(16, Math.min(bellRect.top, window.innerHeight - 32))

    return createPortal(
      <>
        <div
          className="fixed inset-0 z-30 bg-black/30"
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          ref={dropdownRef}
          className="fixed z-40 w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-white shadow-xl"
          style={{
            left: `${sidebarRight + 8}px`,
            top: `${clampedTop}px`,
            maxHeight: `calc(100vh - ${clampedTop + 16}px)`,
          }}
        >
          {panelContent}
        </div>
      </>,
      document.body
    )
  }

  // Mobile: original fixed positioning (unchanged)
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        aria-hidden="true"
      />

      {/* Dropdown */}
      <div
        ref={dropdownRef}
        className="fixed z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-white shadow-xl"
        style={{
          top: "calc(64px + 1rem)",
          right: "1rem",
        }}
      >
        {panelContent}
      </div>
    </>
  )
}
