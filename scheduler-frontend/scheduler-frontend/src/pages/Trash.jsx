import { useState, useEffect } from "react";
import {
  Trash2,
  RotateCcw,
  Building2,
  Car,
  FileText,
  User,
  Calendar,
  AlertCircle,
  Loader2,
  Info,
} from "lucide-react";
import * as api from "../api/endpoints";
import { useToast } from "../components/Toast";
import ConfirmModal from "../components/ConfirmModal";
import { SkeletonText, Skeleton } from "../components/Skeleton";

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
    setConfirmData({
      action: "restore",
      type,
      id: item.resource_id || item.booking_id || item.id,
      name: item.name || item.requester || `Booking #${item.id}`,
      item,
    });
    setConfirmModalOpen(true);
  };

  const handlePermanentDelete = (item, type) => {
    setConfirmData({
      action: "forceDelete",
      type,
      id: item.resource_id || item.booking_id || item.id,
      name: item.name || item.requester || `Booking #${item.id}`,
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

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Trash2 className="text-slate-400" />
          Trash Bin
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          View and restore recently deleted resources and booking requests.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab("resources")}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            activeTab === "resources"
              ? "text-blue-600"
              : "text-slate-500 hover:text-slate-700"
          }`}>
          Deleted Resources
          {activeTab === "resources" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("requests")}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            activeTab === "requests"
              ? "text-blue-600"
              : "text-slate-500 hover:text-slate-700"
          }`}>
          Deleted Requests
          {activeTab === "requests" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
          )}
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      ) : (
        <>
          {activeTab === "resources" && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Resource
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Type
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {trashedResources.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-slate-400 text-sm">
                        No deleted resources found.
                      </td>
                    </tr>
                  ) : (
                    trashedResources.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                              {item.type === "vehicle" ? (
                                <Car size={20} />
                              ) : (
                                <Building2 size={20} />
                              )}
                            </div>
                            <span className="font-medium text-slate-700">
                              {item.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 capitalize text-sm text-slate-600">
                          {item.type}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                              item.status === "available"
                                ? "bg-green-50 text-green-700 border-green-100"
                                : "bg-slate-50 text-slate-600 border-slate-100"
                            }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleRestore(item, "resource")}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Restore Resource">
                              <RotateCcw size={18} />
                            </button>
                            <button
                              onClick={() =>
                                handlePermanentDelete(item, "resource")
                              }
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Permanently">
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "requests" && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Requester
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Resource
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Original Status
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {removedBookings.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-slate-400 text-sm">
                        No deleted requests found.
                      </td>
                    </tr>
                  ) : (
                    removedBookings.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-4 py-4">
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-700">
                              {item.requester}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {item.barangay}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600">
                          {item.resource}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-medium border capitalize ${
                              item.status === "approved"
                                ? "bg-green-50 text-green-700 border-green-100"
                                : item.status === "pending"
                                  ? "bg-amber-50 text-amber-700 border-amber-100"
                                  : "bg-red-50 text-red-700 border-red-100"
                            }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleRestore(item, "request")}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Restore Request">
                              <RotateCcw size={18} />
                            </button>
                            <button
                              onClick={() =>
                                handlePermanentDelete(item, "request")
                              }
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Permanently">
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

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
