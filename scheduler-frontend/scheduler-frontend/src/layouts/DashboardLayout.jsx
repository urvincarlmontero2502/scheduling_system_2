import { useEffect, useRef, useState } from "react";
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
  Loader,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import NotificationBell from "../components/NotificationBell";
import NotificationDropdown from "../components/NotificationDropdown";

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
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { toggleDropdown, closeDropdown, dropdownOpen } = useNotifications();
  const bellRef = useRef(null);

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

  // Escape closes the sign-out modal
  const closeSignOutModal = () => {
    if (!isSigningOut) setShowSignOutModal(false);
  };
  useEffect(() => {
    if (!showSignOutModal) return;
    const onKey = (e) => e.key === "Escape" && closeSignOutModal();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showSignOutModal, isSigningOut]);

  const requestSignOut = () => setShowSignOutModal(true);

  async function confirmSignOut() {
    setIsSigningOut(true);
    await signOut();
    setShowSignOutModal(false);
    navigate("/login", { replace: true });
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
        {/* Notification Bell (mobile) */}
        <div className="ml-auto md:hidden">
          <NotificationBell onClick={toggleDropdown} />
        </div>
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
          <div className="ml-auto hidden md:flex">
            <NotificationBell ref={bellRef} onClick={toggleDropdown} />
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
              {user?.profile_image_url ? (
                <img
                  src={user.profile_image_url}
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
            onClick={requestSignOut}
            style={{ ...itemStyle, width: "100%", cursor: "pointer", border: "none", background: "transparent" }}
            className="text-steel transition hover:bg-paper hover:text-status-rejected">
            <LogOut size={20} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Sign Out Confirmation Modal */}
      {showSignOutModal && (
        <>
          {/* Backdrop with blur and fade-in — clicking triggers onClose */}
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-200"
            onClick={closeSignOutModal}
            aria-hidden="true"
          />
          {/* Modal container with scale + fade-in animation */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className={`relative w-full max-w-sm rounded-xl border border-line bg-white p-6 shadow-xl transition-all duration-200 ease-out ${
                isSigningOut ? "scale-95 opacity-60" : "scale-100 opacity-100"
              }`}
            >
              {/* Header: icon + title side-by-side */}
              <div className="mb-4 flex flex-row items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 p-2.5 text-rose-600">
                  <LogOut size={20} />
                </div>
                <h2 className="text-[17px] font-semibold text-ink">
                  Confirm Sign Out
                </h2>
              </div>

              {/* Description */}
              <p className="mt-0 text-[13px] text-steel">
                Are you sure you want to end your current session?
              </p>

              {/* Buttons */}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={closeSignOutModal}
                  disabled={isSigningOut}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmSignOut}
                  disabled={isSigningOut}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-rose-700 shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSigningOut ? (
                    <>
                      <Loader size={14} className="animate-spin" />
                      Signing out…
                    </>
                  ) : (
                    <>
                      <LogOut size={14} />
                      Sign Out
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Notification Dropdown */}
      <NotificationDropdown
        open={dropdownOpen}
        onClose={closeDropdown}
        anchorEl={bellRef}
      />

      {/* Main content */}
      <div className="min-w-0 flex-1 [overflow-x:clip]">
        <Outlet />
      </div>
    </div>
  );
}
