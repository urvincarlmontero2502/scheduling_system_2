import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  CalendarClock,
  LayoutGrid,
  ClipboardList,
  History,
  Building2,
  LogOut,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { to: "/", label: "Overview", icon: LayoutGrid, end: true },
  { to: "/calendar", label: "Calendar", icon: CalendarClock },
  { to: "/bookings", label: "Bookings", icon: ClipboardList },
  {
    to: "/booking-history",
    label: "Booking History",
    icon: History,
    roles: ["admin"], // Restricted to admin only
  },
  {
    to: "/resources",
    label: "Facilities & Vehicles",
    icon: Building2,
    roles: ["admin"],
  },
];

export default function DashboardLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(user?.role),
  );

  return (
    <div className="flex min-h-screen bg-paper">
      {/* Sidebar */}
      <aside className="sticky top-0 flex h-screen w-60 flex-col border-r border-line bg-white">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white">
            <CalendarClock size={20} />
          </div>

          <p className="text-[16px] font-bold leading-tight">Scheduler</p>
        </div>

        {/* Navigation */}
        <nav
          className="flex-1 px-4 py-3 overflow-y-auto"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}>
          {visibleItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "16px 14px",
                borderRadius: "10px",
                fontSize: "15px",
                fontWeight: "500",
                textDecoration: "none",
              }}
              className={({ isActive }) =>
                isActive
                  ? "bg-brand-light text-brand-dark shadow-sm"
                  : "text-steel hover:bg-paper hover:text-ink"
              }>
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User Section */}
        <div className="border-t border-line px-4 py-4">
          <div className="mb-3 px-3">
            <p className="truncate text-[14px] font-medium text-ink">
              {user?.username || user?.name || "Signed in user"}
            </p>

            <p className="truncate text-[12.5px] text-steel">
              {user?.barangay
                ? `Brgy. ${user.barangay}`
                : user?.role || "Staff"}
            </p>
          </div>

          <button
            onClick={handleSignOut}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              width: "100%",
              padding: "16px 14px",
              borderRadius: "10px",
              fontSize: "15px",
              fontWeight: "500",
              cursor: "pointer",
              border: "none",
              background: "transparent",
            }}
            className="text-steel transition hover:bg-paper hover:text-status-rejected">
            <LogOut size={20} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
