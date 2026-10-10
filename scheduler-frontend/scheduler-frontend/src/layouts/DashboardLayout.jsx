import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  CalendarClock,
  LayoutGrid,
  ClipboardList,
  History,
  Building2,
  LogOut,
  Menu,
  Settings,
  User,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { to: "/", label: "Overview", icon: LayoutGrid, end: true },
  { to: "/calendar", label: "Calendar", icon: CalendarClock },
  { to: "/bookings", label: "Bookings", icon: ClipboardList },
  { to: "/booking-history", label: "Booking History", icon: History, roles: ["admin"] },
  { to: "/resources", label: "Facilities & Vehicles", icon: Building2, roles: ["admin"] },
];

const itemStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "14px",
  borderRadius: "10px",
  fontSize: "15px",
  fontWeight: "500",
  textDecoration: "none",
};

export default function DashboardLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Close the mobile menu when the page changes
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Escape closes the menu; lock page scroll while it is open
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(user?.role),
  );

  return (
    <div className="min-h-screen bg-paper md:flex">
      {/* Mobile top bar */}
      <header
        className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-white px-4 py-3 md:hidden"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-ink hover:bg-paper">
          <Menu size={22} />
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
          <CalendarClock size={18} />
        </div>
        <p className="text-[16px] font-bold">Scheduler</p>
      </header>

      {/* Dim background behind the mobile menu */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: slide-out on mobile, fixed column on desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-line bg-white transition-transform duration-200 md:sticky md:top-0 md:z-auto md:h-screen md:w-60 md:max-w-none md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}>
        <div className="flex items-center justify-between gap-3 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white">
              <CalendarClock size={20} />
            </div>
            <p className="text-[16px] font-bold leading-tight">Scheduler</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-steel hover:bg-paper md:hidden">
            <X size={22} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-4 py-3">
          {visibleItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              style={itemStyle}
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

        <div
          className="border-t border-line bg-white py-4"
          style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
          {/* Clickable user profile block → navigates to Account Settings */}
          <NavLink
            to="/account-settings"
            end
            className="mb-4 flex items-center gap-3 px-3 py-2 rounded-lg text-steel hover:bg-paper hover:text-ink transition-colors duration-150 no-underline">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand overflow-hidden">
              {user?.image ? (
                <img
                  src={user.image}
                  alt={user?.full_name || "User"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <User size={20} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold leading-4 text-ink">
                {user?.full_name || user?.name || user?.username || "Signed in user"}
              </p>
              <p className="mt-0.5 truncate text-[12px] leading-tight text-steel">
                {user?.role === "admin"
                  ? "Administrator"
                  : user?.barangay
                    ? `Brgy. ${user.barangay}`
                    : user?.role || "Staff"}
              </p>
            </div>
          </NavLink>

          {/* Sign out button */}
          <button
            onClick={handleSignOut}
            style={{ ...itemStyle, width: "100%", cursor: "pointer", border: "none", background: "transparent" }}
            className="text-steel transition hover:bg-paper hover:text-status-rejected">
            <LogOut size={20} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="min-w-0 flex-1 [overflow-x:clip]">
        <Outlet />
      </div>
    </div>
  );
}
