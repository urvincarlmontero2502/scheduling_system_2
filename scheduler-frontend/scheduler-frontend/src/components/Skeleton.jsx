import { cn } from "../lib/utils";

/**
 * Reusable Skeleton component for loading states.
 *
 * Usage examples:
 *   <Skeleton className="h-4 w-[250px]" />           // text line
 *   <Skeleton className="h-6 w-6 rounded-full" />   // avatar / icon placeholder
 *   <Skeleton className="h-48 w-full rounded-lg" /> // card image
 *
 * The animation uses Tailwind's built-in `animate-pulse` utility.
 */
export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn(
        "bg-gray-200 animate-pulse rounded",
        className,
      )}
      {...props}
    />
  );
}

// ── Preset shapes ──────────────────────────────────────────────

/** One or more text lines (last line is shorter) */
export const SkeletonText = ({ lines = 1, className = "" }) => (
  <div className={`space-y-1.5 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        className={`h-3 bg-gray-200 ${
          i === lines - 1 ? "w-3/4" : "w-full"
        }`}
      />
    ))}
  </div>
);

/** Avatar / profile image placeholder */
export const SkeletonAvatar = ({ size = "h-10 w-10" }) => (
  <Skeleton className={`rounded-full bg-gray-200 ${size}`} />
);

/** Generic stat card (icon + label + value) */
export const SkeletonStatCard = () => (
  <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
    <Skeleton className="h-7 w-7 bg-gray-200 rounded" />
    <Skeleton className="mt-2 h-3 w-4/5 bg-gray-200 rounded" />
    <Skeleton className="mt-1 h-3 w-2/5 bg-gray-200 rounded" />
  </div>
);

/** Resource / facility card (image + text lines) */
export const SkeletonResourceCard = () => (
  <div className="bg-white rounded-xl border border-slate-200/80 p-0 overflow-hidden shadow-2xs">
    <Skeleton className="w-full h-20 sm:h-28 bg-slate-200/70" />
    <div className="p-3 sm:p-4 flex flex-col gap-2.5">
      <Skeleton className="h-4 w-3/4 bg-slate-200 rounded-md" />
      <Skeleton className="h-3 w-1/3 bg-slate-200/80 rounded-md" />
      <Skeleton className="h-3 w-full bg-slate-200/60 rounded-md" />
      <Skeleton className="h-3 w-4/5 bg-slate-200/60 rounded-md" />
      <Skeleton className="h-8 w-full bg-slate-200 rounded-lg mt-3" />
    </div>
  </div>
);

/** Booking row in a table */
export const SkeletonBookingRow = () => (
  <div className="border-b border-line p-4">
    <div className="flex items-start justify-between">
      <div className="space-y-1.5 flex-1">
        <Skeleton className="h-4 bg-gray-200 w-3/5 rounded" />
        <Skeleton className="h-3 bg-gray-200 w-4/5 rounded" />
        <Skeleton className="h-3 bg-gray-200 w-2/5 rounded" />
      </div>
      <Skeleton className="h-6 w-20 bg-gray-200 rounded" />
    </div>
  </div>
);

/** Booking card skeleton for card-view loading */
export const SkeletonBookingCard = () => (
  <div className="bg-white rounded-xl border border-slate-200/80 p-0 overflow-hidden shadow-2xs">
    <div className="p-2.5">
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <div className="flex-1 min-w-0">
          <Skeleton className="h-3 w-20 bg-slate-300/60 rounded mb-1" />
          <Skeleton className="h-4 w-3/4 bg-slate-200/70 rounded-md" />
        </div>
        <Skeleton className="h-5 w-12 bg-slate-300/60 rounded-md shrink-0" />
      </div>
      <div className="flex flex-wrap items-center gap-1 mb-2">
        <Skeleton className="h-4 w-24 bg-slate-200/60 rounded-md" />
        <Skeleton className="h-4 w-20 bg-slate-200/60 rounded-md" />
      </div>
      <div className="p-2 bg-slate-50/80 rounded-lg space-y-1">
        <Skeleton className="h-3 w-full bg-slate-200/50 rounded" />
        <Skeleton className="h-3 w-full bg-slate-200/50 rounded" />
        <Skeleton className="h-3 w-2/3 bg-slate-200/50 rounded" />
      </div>
      <div className="grid grid-cols-2 gap-1.5 mt-2 pt-2 border-t border-slate-100">
        <Skeleton className="h-7 w-full bg-slate-200/70 rounded-lg" />
        <Skeleton className="h-7 w-full bg-slate-200/70 rounded-lg" />
      </div>
    </div>
  </div>
);

/** Table-row skeleton for dense table-view loading */
export const SkeletonBookingTableRow = () => (
  <tr className="border-b border-line">
    <td className="px-4 py-3"><Skeleton className="h-3 w-24 bg-gray-200 rounded" /></td>
    <td className="px-4 py-3"><Skeleton className="h-3 w-20 bg-gray-200 rounded" /></td>
    <td className="px-4 py-3"><Skeleton className="h-3 w-16 bg-gray-200 rounded" /></td>
    <td className="px-4 py-3"><Skeleton className="h-3 w-20 bg-gray-200 rounded" /></td>
    <td className="px-4 py-3"><Skeleton className="h-3 w-24 bg-gray-200 rounded" /></td>
    <td className="px-4 py-3"><Skeleton className="h-3 w-32 bg-gray-200 rounded" /></td>
    <td className="px-4 py-3"><Skeleton className="h-5 w-16 bg-gray-200 rounded-full" /></td>
    <td className="px-4 py-3"><Skeleton className="h-8 w-20 bg-gray-200 rounded" /></td>
  </tr>
);

export default Skeleton;

/**
 * Full app-shell skeleton — mirrors the DashboardLayout structure
 * (sidebar + top header + content area with pulsing cards).
 * Used by ProtectedRoute while verifying auth session.
 */
export function SkeletonAppShell() {
  // Sidebar nav items: Overview, Calendar, Bookings, + optional admin items
  const navItemCount = 3; // Overview, Calendar, Bookings (user-level)

  return (
    <div className="min-h-screen bg-paper md:flex">
      {/* Sidebar skeleton (fixed on desktop) */}
      <aside className="fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-line bg-white md:sticky md:top-0 md:z-auto md:h-screen">
        {/* Brand / logo area */}
        <div className="flex items-center gap-3 px-6 py-6">
          <Skeleton className="h-9 w-9 items-center justify-center rounded-lg bg-gray-200" />
          <Skeleton className="h-5 w-24 bg-gray-200 rounded" />
        </div>
        {/* Nav links */}
        <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-4 py-3">
          {Array.from({ length: navItemCount }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3.5 py-2.5">
              <Skeleton className="h-5 w-5 bg-gray-200 rounded" />
              <Skeleton className="h-3 w-20 bg-gray-200 rounded" />
            </div>
          ))}
        </nav>
        {/* User profile + sign out */}
        <div className="border-t border-line bg-white py-4">
          <div className="mb-4 flex items-center gap-3 px-3 py-2">
            <Skeleton className="h-10 w-10 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-3/4 bg-gray-200 rounded" />
              <Skeleton className="h-3 w-1/2 bg-gray-200 rounded" />
            </div>
          </div>
          <div className="flex items-center gap-3 px-3.5 py-2.5">
            <Skeleton className="h-5 w-5 bg-gray-200 rounded" />
            <Skeleton className="h-3 w-16 bg-gray-200 rounded" />
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="min-w-0 flex-1 md:ml-0">
        {/* Top header bar */}
        <div className="border-b border-line bg-white px-4 sm:px-6 py-4">
          <div className="mb-2 flex items-center justify-between">
            <Skeleton className="h-5 w-48 bg-gray-200 rounded" />
            <div className="flex gap-3">
              <Skeleton className="h-2.5 w-2.5 rounded-full bg-gray-200" />
              <Skeleton className="h-3 w-24 bg-gray-200 rounded" />
            </div>
          </div>
          <Skeleton className="h-3 w-full max-w-md bg-gray-200 rounded" />
        </div>

        {/* Stats grid (4 cards) */}
        <div className="grid grid-cols-2 gap-3 px-4 py-4 sm:gap-4 sm:px-6 sm:py-6 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonStatCard key={i} />
          ))}
        </div>

        {/* Content area — resource cards in 2-column grid */}
        <div className="px-4 sm:px-6 pb-6 space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-40 bg-gray-200 rounded" />
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-3 w-16 bg-gray-200 rounded" />
              <Skeleton className="h-3 w-20 bg-gray-200 rounded" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonResourceCard key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
