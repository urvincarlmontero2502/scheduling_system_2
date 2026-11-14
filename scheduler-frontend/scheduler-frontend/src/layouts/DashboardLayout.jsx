import { useEffect, useRef, useState } from "react";

import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import jabongaLogo from "../assets/jabonga-logo.png";

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
  Activity,
  ChevronLeft,
  ChevronRight,
  UserCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import * as api from "../api/endpoints";

import { useNotifications } from "../context/NotificationContext";

import NotificationBell from "../components/NotificationBell";

import NotificationDropdown from "../components/NotificationDropdown";

const NAV_GROUPS = [
  {
    label: "Operations",
    items: [
      { to: "/", label: "Overview", icon: LayoutGrid, end: true },
      { to: "/calendar", label: "Calendar", icon: CalendarClock },
      { to: "/bookings", label: "Bookings", icon: ClipboardList },
      {
        to: "/booking-history",
        label: "Booking History",
        icon: History,
        roles: ["admin", "barangay_admin", "staff", "user"],
      },
      {
        to: "/resources",
        label: "Facilities & Vehicles",
        icon: Building2,
        roles: ["admin"],
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        to: "/requests?section=registration",
        activePath: "/requests",
        label: "Requests",
        icon: UserCheck,
        roles: ["admin", "barangay_admin"],
      },
      {
        to: "/activity-logs",
        label: "Activity Logs",
        icon: Activity,
      },
      {
        to: "/system-settings",
        label: "System Settings",
        icon: Settings,
        roles: ["admin"],
      },
    ],
  },
];

export default function DashboardLayout() {
  const { user, signOut } = useAuth();
  // ... rest of component

  const navigate = useNavigate();

  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

  const [showSignOutModal, setShowSignOutModal] = useState(false);

  const [isSigningOut, setIsSigningOut] = useState(false);

  const { toggleDropdown, closeDropdown, dropdownOpen, bellRef } =
    useNotifications();

  const [pendingRequestCounts, setPendingRequestCounts] = useState({
    bookings: 0,
    registrations: 0,
    removals: 0,
  });

  useEffect(() => {
    if (!user) {
      setPendingRequestCounts({ bookings: 0, registrations: 0, removals: 0 });
      return;
    }

    let active = true;
    const canReviewRegistrations = ["admin", "barangay_admin"].includes(
      user.role,
    );

    const refreshCounts = async () => {
      try {
        const response = await api.fetchBookings({});
        const data = Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response?.data?.data)
            ? response.data.data
            : [];
        if (active) {
          setPendingRequestCounts((counts) => ({
            ...counts,
            bookings: data.filter(
              (booking) => booking?.status?.toLowerCase() === "pending",
            ).length,
          }));
        }
      } catch (error) {
        console.error("Failed to refresh pending booking count:", error);
      }

      if (!canReviewRegistrations) return;

      try {
        const response = await api.fetchRegistrationRequests();
        const data = Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response?.data?.data)
            ? response.data.data
            : [];
        if (active) {
          setPendingRequestCounts((counts) => ({
            ...counts,
            registrations: data.filter(
              (request) => request?.status?.toLowerCase() === "pending",
            ).length,
          }));
        }
      } catch (error) {
        console.error("Failed to refresh pending registration count:", error);
      }

      try {
        const response = await api.fetchBookingRemovalRequests();
        const data = Array.isArray(response?.data) ? response.data : [];
        if (active) {
          setPendingRequestCounts((counts) => ({
            ...counts,
            removals: data.length,
          }));
        }
      } catch (error) {
        console.error(
          "Failed to refresh pending booking removal count:",
          error,
        );
      }
    };

    refreshCounts();
    const intervalId = window.setInterval(() => {
      if (!document.hidden) refreshCounts();
    }, 30_000);
    window.addEventListener("bookingUpdated", refreshCounts);
    window.addEventListener("bookingChanged", refreshCounts);
    window.addEventListener("registrationUpdated", refreshCounts);
    window.addEventListener("cacheInvalidated", refreshCounts);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("bookingUpdated", refreshCounts);
      window.removeEventListener("bookingChanged", refreshCounts);
      window.removeEventListener("registrationUpdated", refreshCounts);
      window.removeEventListener("cacheInvalidated", refreshCounts);
    };
  }, [user?.user_id, user?.role]);

  // Close the mobile menu when the page changes

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!profileMenuOpen) return;

    const handlePointerDown = (event) => {
      if (!profileMenuRef.current?.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setProfileMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileMenuOpen]);

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

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.roles || item.roles.includes(user?.role),
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="min-h-screen bg-paper md:flex">
      {/* Mobile top bar */}

      <header
        className="w-full max-w-full left-0 right-0 top-0 sticky z-30 flex items-center gap-3 border-b border-line bg-white px-4 py-3 md:hidden"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-ink hover:bg-paper">
          <Menu size={22} />
        </button>

        <div className="flex w-12 h-12 aspect-square items-center justify-center rounded-full bg-transparent text-white overflow-hidden">
          <img
            src={jabongaLogo}
            alt="Jabonga Logo"
            className="h-full w-full object-contain"
          />
        </div>

        <div className="flex flex-col min-w-0">
          <p className="truncate whitespace-nowrap text-xs font-bold leading-tight tracking-tight text-slate-900">
            Facility &amp; Vehicle Scheduler
          </p>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
            LGU Jabonga Portal
          </p>
        </div>

        <div className="ml-auto flex items-center">
          <NotificationBell ref={bellRef} onClick={toggleDropdown} />
        </div>
      </header>

      {/* Desktop top header — Bell is now inline in page headers (e.g., Overview.jsx) */}

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
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-line bg-white transition-all duration-200 md:sticky md:top-0 md:z-40 md:h-screen md:shrink-0 md:translate-x-0 ${
          sidebarCollapsed ? "md:w-16" : "md:w-64"
        } ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div
          className={`flex items-center justify-between gap-2 p-3 ${sidebarCollapsed ? "md:flex-col md:justify-center" : ""}`}>
          <div
            className={`flex min-w-0 items-center gap-2 ${sidebarCollapsed ? "md:justify-center" : ""}`}>
            <div className="flex h-10 w-10 shrink-0 aspect-square items-center justify-center overflow-hidden rounded-full bg-transparent text-white">
              <img
                src={jabongaLogo}
                alt="Jabonga Logo"
                className="h-full w-full object-contain"
              />
            </div>

            <div
              className={`flex flex-col min-w-0 ${sidebarCollapsed ? "md:hidden" : ""}`}>
              <p className="truncate whitespace-nowrap text-xs font-bold leading-tight tracking-tight text-slate-900">
                Facility &amp; Vehicle Scheduler
              </p>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                LGU Jabonga Portal
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
            aria-label={
              sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
            }
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!sidebarCollapsed}
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 md:flex">
            {sidebarCollapsed ? (
              <ChevronRight size={17} />
            ) : (
              <ChevronLeft size={17} />
            )}
          </button>

          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-steel hover:bg-paper md:hidden">
            <X size={22} />
          </button>
        </div>

        <nav
          className={`min-h-0 flex-1 overflow-y-auto px-3 py-2 ${sidebarCollapsed ? "md:px-2" : ""}`}>
          {visibleGroups.map((group) => (
            <section
              key={group.label}
              className={`space-y-1 ${sidebarCollapsed ? "md:mb-3" : ""}`}>
              {group.label === "Administration" && sidebarCollapsed && (
                <div
                  aria-hidden="true"
                  className="mx-auto my-2 hidden h-px w-6 bg-slate-200 md:block"
                />
              )}
              <h2
                className={`px-3 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 ${sidebarCollapsed ? "md:hidden" : ""}`}>
                {group.label}
              </h2>
              {group.items.map(({ to, activePath, label, icon: Icon, end }) => {
                const badgeCount =
                  label === "Bookings"
                    ? pendingRequestCounts.bookings
                    : label === "Requests"
                      ? pendingRequestCounts.registrations +
                        pendingRequestCounts.removals
                      : 0;

                return (
                  <NavLink
                    key={label}
                    to={to}
                    end={end}
                    title={sidebarCollapsed ? label : undefined}
                    aria-label={sidebarCollapsed ? label : undefined}
                    className={({ isActive }) => {
                      const routeActive = activePath
                        ? location.pathname === activePath
                        : isActive;
                      return `relative flex min-h-10 items-center whitespace-nowrap rounded-lg py-2 text-sm font-medium no-underline transition-colors ${
                        sidebarCollapsed
                          ? "gap-2.5 px-3 md:mx-auto md:w-10 md:justify-center md:gap-0 md:px-0"
                          : "gap-2.5 px-3"
                      } ${
                        routeActive
                          ? "bg-brand-light text-brand-dark shadow-sm"
                          : "text-steel hover:bg-paper hover:text-ink"
                      }`;
                    }}>
                    <Icon size={18} className="shrink-0" />
                    <span
                      className={`truncate ${sidebarCollapsed ? "md:hidden" : ""}`}>
                      {label}
                    </span>
                    {badgeCount > 0 && (
                      <span
                        aria-label={`${badgeCount} pending items`}
                        className={`inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white ${
                          sidebarCollapsed
                            ? "absolute right-0 top-0 h-4 min-w-4 translate-x-1/4 -translate-y-1/4 px-0.5 text-[9px]"
                            : "ml-auto"
                        }`}>
                        {badgeCount > 99 ? "99+" : badgeCount}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </section>
          ))}
        </nav>

        <div
          ref={profileMenuRef}
          className={`relative mt-auto flex flex-row items-center border-t border-slate-100 bg-white pt-2 pb-2 ${
            sidebarCollapsed
              ? "gap-2 px-3 md:flex-col md:justify-center md:gap-1 md:px-2"
              : "gap-2 px-3"
          }`}
          style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
          <div
            className={`relative min-w-0 ${
              sidebarCollapsed ? "flex-1 md:w-full md:flex-none" : "flex-1"
            }`}>
            <button
              type="button"
              onClick={() => setProfileMenuOpen((isOpen) => !isOpen)}
              aria-haspopup="dialog"
              aria-expanded={profileMenuOpen}
              aria-label="Open profile menu"
              title={sidebarCollapsed ? "Profile menu" : undefined}
              className={`flex min-w-0 items-center rounded-lg p-1.5 text-left transition hover:bg-slate-50 ${
                sidebarCollapsed
                  ? "w-full gap-2.5 md:justify-center"
                  : "w-full gap-2.5"
              }`}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand/10 text-brand">
                {user?.profile_image_url ? (
                  <img
                    src={user.profile_image_url}
                    alt={user?.full_name || "User"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User size={18} />
                )}
              </div>
              <div
                className={`flex min-w-0 flex-1 flex-col ${sidebarCollapsed ? "md:hidden" : ""}`}>
                <p className="truncate text-xs font-semibold text-slate-800">
                  {user?.full_name ||
                    user?.name ||
                    user?.username ||
                    "Signed in user"}
                </p>
                <p className="truncate text-[10px] text-slate-500">
                  {user?.role === "admin"
                    ? "Administrator"
                    : user?.barangay
                      ? `Brgy. ${user.barangay}`
                      : user?.role || "Staff"}
                </p>
              </div>
            </button>

            {profileMenuOpen && (
              <div
                role="dialog"
                aria-label="Profile menu"
                className={`absolute bottom-[calc(100%+4px)] left-0 right-0 z-50 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-xl sm:right-auto sm:w-[280px] ${
                  sidebarCollapsed ? "md:bottom-0 md:left-[calc(100%+8px)]" : ""
                }`}>
                <NavLink
                  to="/account-settings"
                  end
                  onClick={() => setProfileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 no-underline transition hover:bg-slate-50">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-700">
                    {user?.profile_image_url ? (
                      <img
                        src={user.profile_image_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User size={24} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold uppercase text-slate-900">
                      {user?.full_name ||
                        user?.name ||
                        user?.username ||
                        "Signed in user"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {user?.role === "admin"
                        ? "Administrator"
                        : user?.barangay
                          ? `Brgy. ${user.barangay}`
                          : user?.role || "Staff"}
                    </p>
                    <span className="sr-only">Open account settings</span>
                  </div>
                </NavLink>
                <div className="border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      requestSignOut();
                    }}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50 hover:text-rose-700">
                    <LogOut size={18} />
                    Sign-out
                  </button>
                </div>
              </div>
            )}
          </div>
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
              }`}>
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
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition disabled:cursor-not-allowed disabled:opacity-50">
                  Cancel
                </button>

                <button
                  onClick={confirmSignOut}
                  disabled={isSigningOut}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-rose-700 shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-70">
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

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 hidden md:flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex flex-col min-w-0">
            <h1 className="text-[17px] font-semibold text-ink leading-tight">
              {location.pathname.startsWith("/bookings") && "Bookings"}
              {location.pathname.startsWith("/calendar") && "Schedule Calendar"}
              {location.pathname.startsWith("/booking-history") &&
                "Booking History"}
              {location.pathname.startsWith("/resources") &&
                "Facilities & Vehicles"}
              {location.pathname.startsWith("/requests") && "Requests"}
              {location.pathname.startsWith("/account-settings") &&
                "Account Settings"}
              {location.pathname.startsWith("/activity-logs") &&
                "Activity Logs"}
              {location.pathname === "/" && "Dashboard Overview"}
            </h1>
            <p className="text-[11px] text-steel leading-tight truncate">
              {location.pathname.startsWith("/bookings") &&
                "Manage and review facility and vehicle reservation requests"}
              {location.pathname.startsWith("/calendar") &&
                "Interactive schedule of LGU facilities and vehicles"}
              {location.pathname.startsWith("/booking-history") &&
                "Archived reservation records and logs"}
              {location.pathname.startsWith("/resources") &&
                "Browse and manage municipal assets and equipment"}
              {location.pathname.startsWith("/requests") &&
                "Review account registrations and booking removal requests"}
              {location.pathname.startsWith("/account-settings") &&
                "Manage your profile and security credentials"}
              {location.pathname.startsWith("/activity-logs") &&
                "Review system activity from the past year"}
              {location.pathname === "/" &&
                "Overview of municipal operations and quick stats"}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell ref={bellRef} onClick={toggleDropdown} />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
