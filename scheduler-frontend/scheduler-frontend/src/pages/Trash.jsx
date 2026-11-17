import { useState, useEffect } from "react";
import {
  Trash2,
  RotateCcw,
  Building2,
  Car,
  FileText,
  Calendar,
  Info,
} from "lucide-react";
import * as api from "../api/endpoints";
import { useToast } from "../components/Toast";
import ConfirmModal from "../components/ConfirmModal";
import { Skeleton } from "../components/Skeleton";

function getItemId(item) {
  return item?.resource_id ?? item?.booking_id ?? item?.id;
}

function formatDate(value) {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function formatDateRange(start, end) {
  const startLabel = formatDate(start);
  if (!startLabel) return null;
  const endLabel = end && end !== start ? formatDate(end) : null;
  return endLabel ? `${startLabel} – ${endLabel}` : startLabel;
}

function statusStyle(status) {
  switch (String(status || "").toLowerCase()) {
    case "available":
    case "approved":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "rejected":
    case "maintenance":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export default function Trash() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState("resources");
  const [loading, setLoading] = useState(true);
  const [trashedResources, setTrashedResources] = useState([]);
  const [removedBookings, setRemovedBookings] = useState([]);

  // Confirmation Modal State
  const [confirmOpen, setConfirmModalOpen] = useState(false);
  const [confirmData, setConfirmData] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resResources, resBookings] = await Promise.all([
        api.fetchTrashedResources(),
        api.fetchRemovedBookings(),
      ]);
      setTrashedResources(resResources.data || []);
      setRemovedBookings(resBookings.data || []);
    } catch (err) {
      console.error("Failed to fetch trashed items:", err);
      toast.error("Failed to load deleted items.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRestore = (item, type) => {
    const id = getItemId(item);
    setConfirmData({
      action: "restore",
      type,
      id,
      name: item.name || item.requester || `Booking #${id}`,
      item,
    });
    setConfirmModalOpen(true);
  };

  const handlePermanentDelete = (item, type) => {
    const id = getItemId(item);
    setConfirmData({
      action: "forceDelete",
      type,
      id,
      name: item.name || item.requester || `Booking #${id}`,
      item,
    });
    setConfirmModalOpen(true);
  };

  const executeAction = async () => {
    if (!confirmData) return;
    const { action, type, id } = confirmData;

    try {
      if (action === "restore") {
        if (type === "resource") {
          await api.restoreResource(id);
        } else {
          await api.restoreBooking(id);
        }
        toast.success("Item restored successfully.");
      } else {
        if (type === "resource") {
          await api.forceDeleteResource(id);
        } else {
          await api.forceDeleteBooking(id);
        }
        toast.success("Item permanently deleted.");
      }
      fetchData();
    } catch (err) {
      console.error(`Failed to ${action} ${type}:`, err);
      toast.error(err.response?.data?.message || `Failed to perform action.`);
    } finally {
      setConfirmModalOpen(false);
      setConfirmData(null);
    }
  };

  const activeCount =
    activeTab === "resources" ? trashedResources.length : removedBookings.length;

  return (
    <div className="space-y-5 p-4 md:p-6">
      <section className="grid gap-3 sm:grid-cols-2">
        {[
          {
            label: "Deleted resources",
            count: trashedResources.length,
            detail: "Facilities and utility vehicles",
            icon: Building2,
            tone: "bg-blue-50 text-blue-700",
          },
          {
            label: "Deleted booking requests",
            count: removedBookings.length,
            detail: "Requests available for restoration",
            icon: FileText,
            tone: "bg-violet-50 text-violet-700",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/[0.03]"
          >
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${stat.tone}`}
            >
              <stat.icon size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-500">{stat.label}</p>
              <p className="mt-0.5 text-2xl font-bold leading-none text-slate-900">
                {loading ? "—" : stat.count}
              </p>
            </div>
            <p className="hidden text-right text-xs text-slate-400 md:block">
              {stat.detail}
            </p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700">
              Recently deleted
            </p>
            <h2 className="mt-1 text-base font-semibold text-slate-900">
              Deleted items
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Restore records or permanently remove them from the system.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Deleted item types"
            className="flex w-full rounded-xl bg-slate-100 p-1 sm:w-auto"
          >
            <button
              id="trash-resources-tab"
              type="button"
              role="tab"
              aria-selected={activeTab === "resources"}
              aria-controls="trash-items-panel"
              onClick={() => setActiveTab("resources")}
              className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition sm:flex-none sm:px-4 ${
                activeTab === "resources"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Building2 size={15} />
              Resources
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  activeTab === "resources"
                    ? "bg-blue-50 text-blue-700"
                    : "bg-white/70 text-slate-500"
                }`}
              >
                {loading ? "—" : trashedResources.length}
              </span>
            </button>
            <button
              id="trash-requests-tab"
              type="button"
              role="tab"
              aria-selected={activeTab === "requests"}
              aria-controls="trash-items-panel"
              onClick={() => setActiveTab("requests")}
              className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition sm:flex-none sm:px-4 ${
                activeTab === "requests"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <FileText size={15} />
              Requests
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  activeTab === "requests"
                    ? "bg-blue-50 text-blue-700"
                    : "bg-white/70 text-slate-500"
                }`}
              >
                {loading ? "—" : removedBookings.length}
              </span>
            </button>
          </div>
        </div>

        <div className="flex items-start gap-2.5 border-b border-amber-100 bg-amber-50/70 px-4 py-3 text-xs leading-relaxed text-amber-800 sm:px-5">
          <Info size={15} className="mt-0.5 shrink-0" />
          <p>
            Restoring returns an item to its active list. Permanent deletion
            cannot be undone.
          </p>
        </div>

        <div
          id="trash-items-panel"
          role="tabpanel"
          aria-labelledby={
            activeTab === "resources"
              ? "trash-resources-tab"
              : "trash-requests-tab"
          }
          className="p-3 sm:p-5"
        >
          {loading ? (
            <div className="space-y-3" role="status" aria-label="Loading trash">
              {[0, 1, 2].map((row) => (
                <div
                  key={row}
                  className="flex items-center gap-4 rounded-xl border border-slate-100 p-4"
                >
                  <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3 rounded" />
                    <Skeleton className="h-3 w-1/2 rounded" />
                  </div>
                  <Skeleton className="h-9 w-28 rounded-lg" />
                </div>
              ))}
            </div>
          ) : activeCount === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-5 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
                {activeTab === "resources" ? (
                  <Building2 size={22} />
                ) : (
                  <FileText size={22} />
                )}
              </div>
              <h3 className="mt-4 text-sm font-semibold text-slate-800">
                {activeTab === "resources"
                  ? "No deleted resources"
                  : "No deleted booking requests"}
              </h3>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-500">
                {activeTab === "resources"
                  ? "Deleted facilities and vehicles will appear here, where an administrator can restore or permanently remove them."
                  : "Deleted booking requests will appear here and can be restored to the active booking list."}
              </p>
            </div>
          ) : activeTab === "resources" ? (
            <div className="space-y-3">
              {trashedResources.map((item) => {
                const itemType =
                  String(item.type || "").toLowerCase() === "vehicle"
                    ? "vehicle"
                    : "facility";
                const ItemIcon = itemType === "vehicle" ? Car : Building2;

                return (
                  <article
                    key={getItemId(item)}
                    className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                        <ItemIcon size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-semibold text-slate-900">
                            {item.name || "Unnamed resource"}
                          </h3>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold capitalize text-slate-600">
                            {itemType}
                          </span>
                          {item.status && (
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${statusStyle(item.status)}`}
                            >
                              {String(item.status).replaceAll("_", " ")}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.description ||
                            item.capacity ||
                            item.unit_name ||
                            "Deleted resource"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 sm:shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRestore(item, "resource")}
                        aria-label={`Restore ${item.name || "resource"}`}
                        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                      >
                        <RotateCcw size={14} />
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePermanentDelete(item, "resource")}
                        aria-label={`Permanently delete ${item.name || "resource"}`}
                        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                      >
                        <Trash2 size={14} />
                        Delete permanently
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {removedBookings.map((item) => {
                const resourceNames =
                  item.resource_names?.length > 0
                    ? item.resource_names.join(", ")
                    : item.resource || "Unknown resource";
                const dateRange = formatDateRange(
                  item.start_date,
                  item.end_date,
                );

                return (
                  <article
                    key={getItemId(item)}
                    className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                        <FileText size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-900">
                            {item.reference_id ||
                              `Booking #${getItemId(item)}`}
                          </h3>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${statusStyle(item.status)}`}
                          >
                            {item.status || "Status unavailable"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs font-medium text-slate-700">
                          {item.requester || "Requestor unavailable"}
                          <span className="mx-1.5 text-slate-300">·</span>
                          <span className="font-normal text-slate-500">
                            {item.barangay || "Barangay unavailable"}
                          </span>
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {resourceNames}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                          {dateRange && (
                            <span className="inline-flex items-center gap-1">
                              <Calendar size={13} />
                              {dateRange}
                            </span>
                          )}
                          {item.deleted_at && (
                            <span>
                              Deleted {formatDate(item.deleted_at)}
                            </span>
                          )}
                          {item.purpose && (
                            <span className="max-w-full truncate">
                              Purpose: {item.purpose}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 sm:shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRestore(item, "request")}
                        aria-label={`Restore booking ${item.reference_id || getItemId(item)}`}
                        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                      >
                        <RotateCcw size={14} />
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePermanentDelete(item, "request")}
                        aria-label={`Permanently delete booking ${item.reference_id || getItemId(item)}`}
                        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                      >
                        <Trash2 size={14} />
                        Delete permanently
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={executeAction}
        title={
          confirmData?.action === "restore"
            ? "Restore Item"
            : "Permanent Delete"
        }
        message={
          confirmData?.action === "restore"
            ? `Are you sure you want to restore "${confirmData?.name}"? It will be moved back to active items.`
            : `Are you sure you want to PERMANENTLY delete "${confirmData?.name}"? This action cannot be undone and will remove all history.`
        }
        confirmText={
          confirmData?.action === "restore" ? "Restore" : "Delete Permanently"
        }
        confirmButtonClass={
          confirmData?.action === "restore" ? "bg-blue-600" : "bg-red-600"
        }
        titleIcon={confirmData?.action === "restore" ? RotateCcw : Trash2}
      />
    </div>
  );
}
