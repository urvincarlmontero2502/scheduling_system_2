import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
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

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
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
        if (active) setLoading(false);
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

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row">
        <form onSubmit={submitSearch} className="flex min-w-0 flex-1 gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search actor, activity, or record ID"
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            Search
          </button>
        </form>

        <select
          value={action}
          onChange={changeAction}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
          aria-label="Filter by activity type"
        >
          <option value="">All activity</option>
          {ACTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {error && (
          <p role="alert" className="border-b border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </p>
        )}
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
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                    Loading activity logs…
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                    {error ? "Activity logs could not be loaded." : "No activity found."}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.activity_log_id} className="align-top text-slate-700">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                      {formatTimestamp(log.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{log.actor_name}</p>
                      <p className="mt-0.5 text-xs capitalize text-slate-500">
                        {(log.actor_role || "").replaceAll("_", " ")}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatAction(log.action)}
                    </td>
                    <td className="px-4 py-3">{log.description}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            {pagination.total} {pagination.total === 1 ? "entry" : "entries"}
          </span>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={loading || page <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft size={15} /> Previous
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
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
