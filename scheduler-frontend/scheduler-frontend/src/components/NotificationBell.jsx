import { Bell } from "lucide-react"
import { useNotifications } from "../context/NotificationContext"

export default function NotificationBell({ onClick }) {
  const { unreadCount } = useNotifications()

  return (
    <button
      type="button"
      aria-label="Notifications"
      onClick={onClick}
      className="relative flex h-10 w-10 items-center justify-center rounded-full text-steel transition hover:bg-paper hover:text-ink"
    >
      <Bell size={22} />
      {unreadCount > 0 && (
        <span
          className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white"
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  )
}
