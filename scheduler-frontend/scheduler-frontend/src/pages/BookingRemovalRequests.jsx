import { useCallback, useEffect, useState } from "react";
import { Check, Clock, RefreshCw, X } from "lucide-react";
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

export default function BookingRemovalRequests() {
  const { user } = useAuth();
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(null);

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

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
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
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">Loading requests…</p>
        ) : requests.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">No pending removal requests.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {requests.map((request) => {
              const booking = request.booking_snapshot || {};
              const requestId = request.removal_request_id;
              return (
                <article key={requestId} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-800">
                        {request.requester_name} requested removal of booking #{request.booking_id}
                      </p>
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                        <Clock size={12} /> Pending
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {booking.resource_name || request.booking?.resource?.name || "Resource"} ·{" "}
                      {formatDate(booking.start_date)} – {formatDate(booking.end_date)}
                      {booking.barangay ? ` · ${booking.barangay}` : ""}
                    </p>
                    {request.reason && (
                      <p className="mt-2 text-sm text-slate-500">
                        <span className="font-medium">Reason:</span> {request.reason}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-slate-400">
                      Submitted {request.requested_at ? new Date(request.requested_at).toLocaleString() : ""}
                    </p>
                  </div>
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
                </article>
              );
            })}
          </div>
        )}
      </div>

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
