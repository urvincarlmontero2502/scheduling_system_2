import { useEffect, useState } from "react";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Search,
  UserRound,
} from "lucide-react";
import * as api from "../api/endpoints";

const ACTIONS = [
  ["booking.requested", "Booking requested"],
  ["booking.allocated", "Booking directly allocated"],
  ["booking.approved", "Booking approved"],
  ["booking.rejected", "Booking rejected"],
  ["booking.deleted", "Booking deleted"],
  ["booking.restored", "Booking restored"],
  ["booking.removal_requested", "Booking removal requested"],
  ["booking.removal_request_approved", "Booking removal request approved"],
  ["booking.removal_request_rejected", "Booking removal request declined"],
  ["resource.created", "Resource added"],
  ["resource.updated", "Resource updated"],
  ["resource.deleted", "Resource deleted"],
  ["resource.maintenance_enabled", "Maintenance started"],
  ["resource.maintenance_disabled", "Maintenance ended"],
  ["registration.approved", "Registration approved"],
  ["registration.rejected", "Registration rejected"],
  ["settings.booking_reminder_updated", "Reminder settings updated"],
];

function formatAction(action) {
  return ACTIONS.find(([value]) => value === action)?.[1] || action;
}

function formatTimestamp(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(date);
}

function formatRole(role) {
  return (role || "").replaceAll("_", " ");
}

function ActivitySkeleton() {
  return (
    <div className="space-y-3 md:hidden">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="animate-pulse rounded-xl border border-slate-200 bg-white p-4">
          <div className="h-3 w-32 rounded bg-slate-200" />
          <div className="mt-4 h-4 w-40 rounded bg-slate-200" />
          <div className="mt-2 h-3 w-24 rounded bg-slate-200" />
          <div className="mt-4 h-4 w-36 rounded bg-slate-200" />
          <div className="mt-2 h-3 w-full rounded bg-slate-200" />
          <div className="mt-2 h-3 w-4/5 rounded bg-slate-200" />
        </div>
      ))}
    </div>
  );
}

function MobileActivityCard({ log }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {/* Date and time */}
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Clock3 size={14} className="shrink-0" />
        <span>{formatTimestamp(log.created_at)}</span>
      </div>

      {/* User */}
      <div className="mt-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
          <UserRound size={17} />
        </div>

        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-slate-800">
            {log.actor_name || "Unknown user"}
          </p>

          {log.actor_role && (
            <p className="mt-0.5 text-xs capitalize text-slate-500">
              {formatRole(log.actor_role)}
            </p>
          )}
        </div>
      </div>

      {/* Activity */}
      <div className="mt-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">
          <Activity size={17} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-semibold text-slate-800">
            {formatAction(log.action)}
          </p>

          {log.description && (
            <p className="mt-1 break-words text-sm leading-5 text-slate-600">
              {log.description}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function MobileEmptyState({ filtered }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Activity size={22} />
      </div>

      <h3 className="mt-4 text-sm font-semibold text-slate-800">
        No activity found
      </h3>

      <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500">
        {filtered
          ? "Try changing your search or activity filter."
          : "There is no recorded activity to display."}
      </p>
    </div>
  );
}

export default function ActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);

  const [pagination, setPagination] = useState({
    currentPage: 1,
    lastPage: 1,
    total: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError("");

    api
      .fetchActivityLogs({
        page,
        search: search || undefined,
        action: action || undefined,
      })
      .then((response) => {
        if (!active) return;

        const result = response?.data;

        setLogs(Array.isArray(result?.data) ? result.data : []);

        setPagination({
          currentPage: result?.current_page || 1,
          lastPage: result?.last_page || 1,
          total: result?.total || 0,
        });
      })
      .catch((requestError) => {
        if (!active) return;

        setError(
          requestError?.response?.data?.message ||
            "Could not load activity logs. Please try again.",
        );

        setLogs([]);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [page, search, action]);

  const submitSearch = (event) => {
    event.preventDefault();

    setPage(1);
    setSearch(searchInput.trim());
  };

  const changeAction = (event) => {
    setAction(event.target.value);
    setPage(1);
  };

  const hasFilters = Boolean(search || action);

  const firstItem =
    pagination.total === 0
      ? 0
      : (pagination.currentPage - 1) * (logs.length || 1) + 1;

  const lastItem =
    pagination.total === 0
      ? 0
      : Math.min(
          pagination.total,
          (pagination.currentPage - 1) * (logs.length || 1) + logs.length,
        );

  return (
    <div className="p-3 sm:p-4 md:p-6">
      {/* Search and filters */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
        <form
          onSubmit={submitSearch}
          className="flex flex-col gap-3 md:flex-row">
          {/* Search */}
          <div className="flex min-w-0 flex-1 gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search actor, activity, or record ID"
                aria-label="Search activity logs"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <button
              type="submit"
              className="h-10 shrink-0 rounded-lg bg-blue-700 px-4 text-sm font-medium text-white transition hover:bg-blue-800 active:bg-blue-900">
              Search
            </button>
          </div>

          {/* Activity filter */}
          <select
            value={action}
            onChange={changeAction}
            aria-label="Filter by activity type"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 md:w-56">
            <option value="">All activity</option>

            {ACTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700 sm:p-4">
          {error}
        </div>
      )}

      {/* ============================================================
          MOBILE VIEW
          ============================================================ */}
      <div className="md:hidden">
        {loading ? (
          <ActivitySkeleton />
        ) : logs.length === 0 ? (
          <MobileEmptyState filtered={hasFilters} />
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <MobileActivityCard key={log.activity_log_id} log={log} />
            ))}
          </div>
        )}
      </div>

      {/* ============================================================
          DESKTOP VIEW
          ============================================================ */}
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Date &amp; time</th>

                <th className="px-4 py-3 font-semibold">User</th>

                <th className="px-4 py-3 font-semibold">Activity</th>

                <th className="px-4 py-3 font-semibold">Details</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-10 text-center text-slate-500">
                    Loading activity logs…
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-10 text-center text-slate-500">
                    {error
                      ? "Activity logs could not be loaded."
                      : "No activity found."}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.activity_log_id}
                    className="align-top text-slate-700">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                      {formatTimestamp(log.created_at)}
                    </td>

                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">
                        {log.actor_name || "Unknown user"}
                      </p>

                      {log.actor_role && (
                        <p className="mt-0.5 text-xs capitalize text-slate-500">
                          {formatRole(log.actor_role)}
                        </p>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      {formatAction(log.action)}
                    </td>

                    <td className="px-4 py-3">{log.description || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Desktop pagination */}
        <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            {pagination.total} {pagination.total === 1 ? "entry" : "entries"}
          </span>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={loading || page <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
              <ChevronLeft size={15} />
              Previous
            </button>

            <span>
              Page {pagination.currentPage} of {pagination.lastPage}
            </span>

            <button
              type="button"
              onClick={() =>
                setPage((current) => Math.min(pagination.lastPage, current + 1))
              }
              disabled={loading || page >= pagination.lastPage}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
              Next
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================
          MOBILE PAGINATION
          ============================================================ */}
      {!loading && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3 md:hidden">
          <div className="mb-3 text-center text-xs text-slate-500">
            {pagination.total > 0
              ? `${firstItem}–${lastItem} of ${pagination.total}`
              : "0 entries"}
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={loading || page <= 1}
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
              <ChevronLeft size={15} />
              Previous
            </button>

            <span className="shrink-0 px-1 text-xs font-medium text-slate-500">
              Page {pagination.currentPage} of {pagination.lastPage}
            </span>

            <button
              type="button"
              onClick={() =>
                setPage((current) => Math.min(pagination.lastPage, current + 1))
              }
              disabled={loading || page >= pagination.lastPage}
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
              Next
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
