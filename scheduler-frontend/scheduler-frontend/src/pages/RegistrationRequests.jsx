import { useState } from "react";
import {
  Clock,
  CheckCircle,
  XCircle,
  User,
  Calendar,
  Mail,
  MapPin,
  Building,
  FileText,
  Loader2,
  RefreshCw,
  Shield,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import * as api from "../api/endpoints";
import useToast from "../components/Toast";
import { useTabUrlSync } from "../hooks/useTabUrlSync";
import { useCachedRegistrations } from "../hooks/useCachedRegistrations";

const STATUS_TABS = [
  { value: "pending", label: "Pending Requests", icon: Clock },
  { value: "approved", label: "Approved", icon: CheckCircle },
  { value: "rejected", label: "Rejected", icon: XCircle },
];

export default function RegistrationRequests() {
  const { user } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useTabUrlSync("tab", "pending");
  const { requests, loading, refetch } = useCachedRegistrations(activeTab);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectModal, setRejectModal] = useState({ open: false, requestId: null });
  const [rejectReason, setRejectReason] = useState("");
  const [viewModal, setViewModal] = useState({ open: false, request: null });

  async function handleApprove(requestId) {
    setActionLoading(true);
    try {
      await api.approveRegistration(requestId);
      toast.success("Registration approved! User account created.");
      // Invalidate cache and dispatch event for cross-tab sync
      refetch();
      window.dispatchEvent(new Event("registrationUpdated"));
    } catch (error) {
      console.error("Failed to approve:", error);
      toast.error(error?.response?.data?.message || "Failed to approve registration.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRejectSubmit() {
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejection.");
      return;
    }
    setActionLoading(true);
    try {
      await api.rejectRegistration(rejectModal.requestId, rejectReason);
      toast.success("Registration rejected.");
      setRejectModal({ open: false, requestId: null });
      setRejectReason("");
      refetch();
      window.dispatchEvent(new Event("registrationUpdated"));
    } catch (error) {
      console.error("Failed to reject:", error);
      toast.error(error?.response?.data?.message || "Failed to reject registration.");
    } finally {
      setActionLoading(false);
    }
  }

  function getStatusColor(status) {
    switch (status) {
      case "pending":
        return "bg-amber-100 text-amber-800";
      case "approved":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  }

  function formatDate(dateString) {
    if (!dateString) return "—";
    try {
      return new Date(dateString).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  }

  const isAdmin = user?.role === "admin" || user?.role === "barangay_admin";
  const isBarangayAdmin = user?.role === "barangay_admin";

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Registration Requests</h1>
          <p className="mt-1 text-sm text-steel">
            {isBarangayAdmin
              ? `Review sign-up requests for Brgy. ${user?.barangay || "—"}`
              : "Review and manage all new staff registration requests"}
          </p>
        </div>
        <button
          onClick={refetch}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-steel hover:bg-paper hover:text-ink transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 flex gap-1 rounded-lg bg-slate-100 p-1">
        {STATUS_TABS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setActiveTab(value)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
              activeTab === value
                ? "bg-white text-ink shadow-sm"
                : "text-steel hover:text-ink"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg border border-line bg-white"
            />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="py-12 text-center">
          <FileText className="mx-auto mb-4 h-12 w-12 text-slate-300" />
          <p className="text-lg font-medium text-steel">
            No {activeTab} registration requests
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <div
              key={request.request_id}
              className="rounded-lg border border-line bg-white p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                      <User size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-ink">
                        {request.full_name}
                      </h3>
                      <p className="text-sm text-steel">{request.email}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-slate-400" />
                      <span className="text-steel">
                        Brgy. {request.barangay || "—"}
                      </span>
                    </div>
                    {request.department && (
                      <div className="flex items-center gap-2">
                        <Building size={14} className="text-slate-400" />
                        <span className="text-steel">{request.department}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-slate-400" />
                      <span className="text-steel">
                        Applied: {formatDate(request.created_at)}
                      </span>
                    </div>
                    {request.role === "admin" && (
                      <div className="flex items-center gap-2">
                        <Shield size={14} className="text-slate-400" />
                        <span className="text-steel">Role: Administrator</span>
                      </div>
                    )}
                  </div>

                  {request.status === "rejected" && request.reject_reason && (
                    <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">
                      <span className="font-medium">Rejection reason:</span>{" "}
                      {request.reject_reason}
                    </div>
                  )}

                  {request.reviewed_at && (
                    <div className="text-xs text-steel">
                      Reviewed on {formatDate(request.reviewed_at)}
                    </div>
                  )}
                </div>

                {/* Status badge */}
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getStatusColor(request.status)}`}
                >
                  {request.status}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 border-t border-line pt-3">
                <button
                  onClick={() => setViewModal({ open: true, request })}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-steel hover:bg-paper hover:text-ink transition-colors"
                >
                  <FileText size={14} />
                  View Details
                </button>

                {request.status === "pending" && isAdmin && (
                  <>
                    <button
                      onClick={() => handleApprove(request.request_id)}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
                    >
                      <CheckCircle size={14} />
                      Approve
                    </button>
                    <button
                      onClick={() =>
                        setRejectModal({ open: true, requestId: request.request_id })
                      }
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
                    >
                      <XCircle size={14} />
                      Reject
                    </button>
                  </>
                )}

                {request.status === "approved" && (
                  <span className="inline-flex items-center gap-1 text-xs text-green-700">
                    <CheckCircle size={12} />
                    Account created
                  </span>
                )}

                {request.status === "rejected" && (
                  <span className="inline-flex items-center gap-1 text-xs text-red-700">
                    <XCircle size={12} />
                    Request declined
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-line bg-white p-6 shadow-xl">
            <h3 className="mb-3 text-lg font-semibold text-ink">Reject Registration</h3>
            <p className="mb-4 text-sm text-steel">
              Please provide a reason for rejecting this registration request.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink placeholder-steel/50 focus:outline-none focus:ring-2 focus:ring-brand"
              rows={4}
              disabled={actionLoading}
            />
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => {
                  setRejectModal({ open: false, requestId: null });
                  setRejectReason("");
                }}
                disabled={actionLoading}
                className="flex-1 rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-steel hover:bg-paper transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={actionLoading || !rejectReason.trim()}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                {actionLoading ? (
                  <span className="flex items-center justify-center gap-1">
                    <Loader2 size={14} className="animate-spin" />
                    Rejecting...
                  </span>
                ) : (
                  "Reject Request"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {viewModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-line bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-semibold text-ink">Registration Details</h3>
              <button
                onClick={() => setViewModal({ open: false, request: null })}
                className="rounded-lg p-1 text-steel hover:bg-paper hover:text-ink"
              >
                ×
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div>
                <span className="font-medium text-steel">Full Name:</span>{" "}
                <span className="text-ink">{viewModal.request.full_name}</span>
              </div>
              <div>
                <span className="font-medium text-steel">Email:</span>{" "}
                <span className="text-ink">{viewModal.request.email}</span>
              </div>
              <div>
                <span className="font-medium text-steel">Role:</span>{" "}
                <span className="text-ink">{viewModal.request.role || "staff"}</span>
              </div>
              <div>
                <span className="font-medium text-steel">Barangay:</span>{" "}
                <span className="text-ink">{viewModal.request.barangay}</span>
              </div>
              {viewModal.request.department && (
                <div>
                  <span className="font-medium text-steel">Department:</span>{" "}
                  <span className="text-ink">{viewModal.request.department}</span>
                </div>
              )}
              <div>
                <span className="font-medium text-steel">Status:</span>{" "}
                <span
                  className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(viewModal.request.status)}`}
                >
                  {viewModal.request.status}
                </span>
              </div>
              <div>
                <span className="font-medium text-steel">Date Applied:</span>{" "}
                <span className="text-ink">{formatDate(viewModal.request.created_at)}</span>
              </div>
              {viewModal.request.reject_reason && (
                <div>
                  <span className="font-medium text-steel">Rejection Reason:</span>{" "}
                  <span className="text-ink">{viewModal.request.reject_reason}</span>
                </div>
              )}
              {viewModal.request.reviewed_at && (
                <div>
                  <span className="font-medium text-steel">Review Date:</span>{" "}
                  <span className="text-ink">{formatDate(viewModal.request.reviewed_at)}</span>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setViewModal({ open: false, request: null })}
                className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-steel hover:bg-paper transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
