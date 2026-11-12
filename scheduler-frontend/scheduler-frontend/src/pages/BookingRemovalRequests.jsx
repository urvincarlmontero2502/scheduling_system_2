import { useCallback, useEffect, useState } from "react";
import { Check, Clock, RefreshCw, Search, X } from "lucide-react";
import * as api from "../api/endpoints";
import ConfirmModal from "../components/ConfirmModal";
import { useToast } from "../components/Toast";
import { useAuth } from "../context/AuthContext";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

export default function BookingRemovalRequests({ embedded = false }) {
  const { user } = useAuth();
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [search, setSearch] = useState("");

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.fetchBookingRemovalRequests();
      setRequests(Array.isArray(response?.data) ? response.data : []);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          "Could not load booking removal requests.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const reviewRequest = async () => {
    if (!confirmation) return false;
    try {
      if (confirmation.decision === "approved") {
        await api.approveBookingRemovalRequest(confirmation.request.removal_request_id);
        toast.success("Booking removed successfully.");
      } else {
        await api.rejectBookingRemovalRequest(confirmation.request.removal_request_id);
        toast.success("Removal request declined.");
      }
      setConfirmation(null);
      window.dispatchEvent(new Event("cacheInvalidated"));
      await loadRequests();
      return true;
    } catch (requestError) {
      toast.error(
        requestError?.response?.data?.message ||
          "Could not process the removal request.",
      );
      return false;
    }
  };

  const normalizedSearch = search.trim().toLowerCase();
  const filteredRequests = requests.filter((request) => {
    const booking = request.booking_snapshot || {};
    return [
      request.requester_name,
      request.booking_id,
      request.reason,
      booking.resource_name,
      booking.barangay,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch);
  });

  return (
    <div className={embedded ? "space-y-4" : "mx-auto max-w-6xl space-y-4 p-4 md:p-6"}>
      {!embedded && <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Booking Removal Requests</h1>
          <p className="mt-1 text-sm text-slate-500">
            {user?.role === "barangay_admin"
              ? `Review requests for ${user?.barangay || "your barangay"}.`
              : "Review staff requests to remove pending or approved bookings."}
          </p>
        </div>
        <button
          type="button"
          onClick={loadRequests}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>}

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800">Pending review</p>
          <p className="text-xs text-slate-500">
            {requests.length} {requests.length === 1 ? "request" : "requests"} awaiting a decision
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search requests"
              aria-label="Search booking removal requests"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <button
            type="button"
            onClick={loadRequests}
            disabled={loading}
            aria-label="Refresh booking removal requests"
            title="Refresh"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      {loading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white"
            />
          ))}
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-14 text-center">
          <Clock className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-base font-semibold text-slate-800">
            {normalizedSearch ? "No matching requests" : "You’re all caught up"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {normalizedSearch
              ? "Try another requester, booking number, resource, or reason."
              : "There are no booking removal requests awaiting review."}
          </p>
        </div>
        ) : (
        <div className="grid gap-3 lg:grid-cols-2">
            {filteredRequests.map((request) => {
              const booking = request.booking_snapshot || {};
              const requestId = request.removal_request_id;
              return (
                <article key={requestId} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {booking.resource_name || request.booking?.resource?.name || "Resource"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Booking #{request.booking_id} · Requested by {request.requester_name || "Staff"}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                      <Clock size={12} /> Pending
                    </span>
                  </div>
                  <div className="mt-4 rounded-lg bg-slate-50 p-3">
                    <p className="text-sm text-slate-700">
                      {formatDate(booking.start_date)} – {formatDate(booking.end_date)}
                      {booking.barangay ? ` · ${booking.barangay}` : ""}
                    </p>
                    {request.reason && (
                      <p className="mt-2 break-words text-sm text-slate-600">
                        <span className="font-medium text-slate-700">Reason:</span> {request.reason}
                      </p>
                    )}
                  </div>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4">
                    <p className="text-xs text-slate-400">
                      Submitted {request.requested_at ? new Date(request.requested_at).toLocaleString() : "—"}
                    </p>
                    <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmation({ request, decision: "rejected" })}
                      className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
                    >
                      <X size={15} /> Decline
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmation({ request, decision: "approved" })}
                      className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700"
                    >
                      <Check size={15} /> Approve removal
                    </button>
                    </div>
                  </div>
                </article>
              );
            })}
        </div>
      )}

      <ConfirmModal
        open={Boolean(confirmation)}
        onClose={() => setConfirmation(null)}
        onConfirm={reviewRequest}
        title={confirmation?.decision === "approved" ? "Approve booking removal" : "Decline removal request"}
        message={
          confirmation?.decision === "approved"
            ? `Approve removal of booking #${confirmation?.request?.booking_id}? The booking will be deleted.`
            : `Decline the removal request for booking #${confirmation?.request?.booking_id}? The booking will remain active.`
        }
        confirmText={confirmation?.decision === "approved" ? "Remove booking" : "Decline request"}
        confirmButtonClass={
          confirmation?.decision === "approved"
            ? "bg-rose-600 hover:bg-rose-700"
            : "bg-slate-700 hover:bg-slate-800"
        }
      />
    </div>
  );
}
