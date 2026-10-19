import { useState, useEffect } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Building2,
  Car,
  Calendar,
  Search,
  Wrench,
} from "lucide-react";
import * as api from "../api/endpoints";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import {
  readCache,
  writeCache,
  invalidateCache,
  CACHE_KEYS,
} from "../utils/cache";
import VehicleBookingModal from "../components/VehicleBookingModal";
import FacilityBookingModal from "../components/FacilityBookingModal";
import { SkeletonResourceCard } from "../components/Skeleton";

/** Status badge configuration */
const STATUS_VARIANTS = {
  available: {
    label: "Available",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  booked: {
    label: "In Use",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  maintenance: {
    label: "🟡 Maintenance",
    className: "bg-yellow-50 text-yellow-800 border-yellow-200",
  },
};

/** Format capacity with "pax" suffix, avoiding duplication */
function formatCapacity(cap) {
  if (!cap) return "N/A";
  if (/\bpax$/i.test(cap)) return cap;
  return `${cap} pax`;
}

/** Resolve the display status of a resource */
function getResourceStatus(item) {
  if (item.is_maintenance || item.status === "maintenance") return "maintenance";
  if (item.available === false || item.status === "booked") return "booked";
  return "available";
}

export default function Resources() {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const [resources, setResources] = useState(() => readCache(CACHE_KEYS.RESOURCES) || []);
  const [loading, setLoading] = useState(() => (readCache(CACHE_KEYS.RESOURCES) ? false : true));
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [selectedResource, setSelectedResource] = useState(null);
  const [resourceType, setResourceType] = useState(null);
  const [isDirectUse, setIsDirectUse] = useState(false);

  // Form state for creating/editing resources
  const [formData, setFormData] = useState({
    name: "",
    type: "facility",
    description: "",
    capacity: "",
    image: null,
  });

  const loadResources = () => {
    // If we have cached data, don't show loading spinner (stale-while-revalidate)
    const cached = readCache(CACHE_KEYS.RESOURCES);
    if (cached && cached.length > 0) {
      setResources(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    api
      .fetchResources?.()
      .then((res) => {
        // Handle both direct array and Laravel resource collection wrapping
        const d = res?.data;
        const data = Array.isArray(d)
          ? d
          : Array.isArray(d?.data)
            ? d.data
            : [];
        // Update cache + state
        if (data.length > 0) {
          writeCache(CACHE_KEYS.RESOURCES, data);
        }
        setResources(data);
      })
      .catch((err) => {
        console.error("Failed to fetch resources", err);
        // Show user-friendly error toast instead of silently failing
        toast.error("Unable to load resources");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadResources();

    // Listen for cache invalidation events
    const handler = () => {
      const cached = readCache(CACHE_KEYS.RESOURCES);
      if (cached) setResources(cached);
    };
    window.addEventListener("cacheInvalidated", handler);
    window.addEventListener("bookingUpdated", handler);
    return () => {
      window.removeEventListener("cacheInvalidated", handler);
      window.removeEventListener("bookingUpdated", handler);
    };
  }, []);

  const handleOpenModal = (resource = null) => {
    if (resource) {
      setEditingResource(resource);
      setFormData({
        name: resource.name || "",
        type: resource.type || "facility",
        description: resource.description || "",
        capacity: resource.capacity
          ? resource.capacity.replace(" pax", "")
          : "",
        image: null,
      });
    } else {
      setEditingResource(null);
      setFormData({
        name: "",
        type: "facility",
        description: "",
        capacity: "",
        image: null,
      });
    }
    setIsModalOpen(true);
  };

  const handleOpenRequestModal = (item, direct = false) => {
    setSelectedResource(item);
    setResourceType(item?.type?.toLowerCase() || null);
    setIsDirectUse(direct);
  };

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this resource?")) {
      // --- Optimistic: remove from local state + cache immediately ---
      const cached = readCache(CACHE_KEYS.RESOURCES) || [];
      const updated = cached.filter(
        (r) => String(r.resource_id || r.id) !== String(id),
      );
      writeCache(CACHE_KEYS.RESOURCES, updated);
      setResources(updated);

      api
        .deleteResource?.(id)
        .then(() => {
          toast.success("Resource deleted successfully");
          window.dispatchEvent(new Event("cacheInvalidated"));
        })
        .catch((err) => {
          // --- Rollback ---
          writeCache(CACHE_KEYS.RESOURCES, cached);
          setResources(cached);
          const msg =
            err?.response?.data?.message ||
            err?.message ||
            "Failed to delete resource. Please try again.";
          toast.error(msg);
        });
    }
  };

  const handleBookingSubmit = (payload) => {
    const apiPayload = {
      resource_id: payload.item_id,
      start_date: payload.start_date,
      end_date: payload.end_date,
      start_time: payload.start_time,
      end_time: payload.end_time,
      purpose: payload.purpose,
      full_name: payload.full_name || null,
      cell_number: payload.cell_number,
      address: payload.address || null,
      status: payload.status || "pending",
    };

    // --- Optimistic update ---
    const cachedResources = readCache(CACHE_KEYS.RESOURCES) || [];
    const isDirectUse = payload.status === "approved";

    // Optimistically update resource availability
    if (isDirectUse) {
      const updated = cachedResources.map((r) =>
        String(r.resource_id || r.id) === String(payload.item_id)
          ? { ...r, available: false, status: "booked" }
          : r,
      );
      writeCache(CACHE_KEYS.RESOURCES, updated);
      setResources(updated);
    }

    // Close modal + show toast immediately
    setSelectedResource(null);
    setResourceType(null);
    toast.success(
      isDirectUse
        ? "Resource allocated successfully!"
        : "Booking request submitted successfully!",
    );

    window.dispatchEvent(new Event("bookingUpdated"));

    // --- Background: fire API request ---
    return api
      .createBooking(apiPayload)
      .then(() => {
        // Success — cache already updated optimistically
        invalidateCache(CACHE_KEYS.HEALTH);
      })
      .catch((err) => {
        // --- Rollback ---
        if (isDirectUse) {
          const restored = cachedResources.map((r) =>
            String(r.resource_id || r.id) === String(payload.item_id)
              ? { ...r, available: true, status: "available" }
              : r,
          );
          writeCache(CACHE_KEYS.RESOURCES, restored);
          setResources(restored);
        }

        window.dispatchEvent(new Event("bookingUpdated"));

        const msg =
          err?.response?.data?.message ||
          err?.response?.data?.conflict_message ||
          "Failed to submit booking request. Please try again.";
        toast.error(msg);

        // If conflict, reopen modal
        if (err?.response?.status === 409 || err?.response?.status === 422) {
          setSelectedResource(payload._originalResource || null);
        }

        throw err;
      });
  };

  const handleMaintenanceToggle = (item) => {
    const resourceId = item.resource_id || item.id;
    if (!resourceId) {
      toast.error("Error: Resource ID is missing. Please refresh and try again.");
      return;
    }
    const isCurrentlyMaintenance =
      item.is_maintenance || item.status === "maintenance";
    const actionText = isCurrentlyMaintenance
      ? "available"
      : "under maintenance";

    if (!window.confirm(`Mark "${item.name}" as ${actionText}?`)) return;

    const request = isCurrentlyMaintenance
      ? api.setResourceAvailable?.(resourceId)
      : api.setResourceMaintenance?.(resourceId);

    // --- Optimistic: update local state + cache immediately ---
    const cached = readCache(CACHE_KEYS.RESOURCES) || [];
    const prevResources = [...cached];
    const updated = cached.map((r) =>
      String(r.resource_id || r.id) === String(resourceId)
        ? {
            ...r,
            is_maintenance: !isCurrentlyMaintenance,
            status: isCurrentlyMaintenance ? "available" : "maintenance",
            available: isCurrentlyMaintenance ? true : false,
          }
        : r,
    );
    writeCache(CACHE_KEYS.RESOURCES, updated);
    setResources(updated);

    request
      .then(() => {
        toast.success(
          `Resource marked as ${actionText} successfully`,
        );
        window.dispatchEvent(new Event("cacheInvalidated"));
      })
      .catch((err) => {
        // --- Rollback ---
        writeCache(CACHE_KEYS.RESOURCES, prevResources);
        setResources(prevResources);

        let msg;
        if (err?.response?.status === 403) {
          msg = "You don't have permission to modify resource status.";
        } else if (err?.response?.status === 404) {
          msg = "Resource not found. It may have been deleted.";
        } else if (err?.code === "ERR_NETWORK") {
          msg = "Network error: Could not connect to the server.";
        } else {
          msg =
            err?.response?.data?.message ||
            err?.message ||
            "Failed to update resource status.";
        }
        toast.error(msg);
      });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const data = new FormData();
    data.append("name", formData.name);
    data.append("type", formData.type);
    data.append("description", formData.description || "");

    if (formData.type === "facility") {
      data.append("capacity", formData.capacity || "");
    } else {
      data.append("unit_name", formData.capacity || "");
    }

    if (formData.image) {
      data.append("image", formData.image);
    }

    if (editingResource) {
      data.append("_method", "PUT");
    }

    // --- Optimistic: close modal + show success immediately ---
    const prevResources = [...resources];
    const actionText = editingResource ? "updated" : "created";

    setIsModalOpen(false);
    toast.success(`Resource ${actionText} successfully!`, { duration: 3000 });

    const request = editingResource
      ? client.post(`/resources/${editingResource.resource_id || editingResource.id}`, data)
      : api.createResource(data);

    request
      .then((res) => {
        // Sync with server response if available
        if (res?.data) {
          const serverResource = res.data.resource || res.data;
          if (serverResource) {
            const updated = editingResource
              ? prevResources.map((r) =>
                  String(r.resource_id || r.id) ===
                  String(editingResource.resource_id || editingResource.id)
                    ? serverResource
                    : r,
                )
              : [...prevResources, serverResource];
            writeCache(CACHE_KEYS.RESOURCES, updated);
            setResources(updated);
          }
        }
        window.dispatchEvent(new Event("cacheInvalidated"));
      })
      .catch((err) => {
        // --- Rollback: restore previous state ---
        setResources(prevResources);
        toast.error(
          err?.response?.data?.message || "Failed to save resource. Please try again.",
        );
      });
  };

  // Helper to filter resources by search query
  const matchesSearch = (item) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const name = (item?.name || "").toLowerCase();
    const description = (item?.description || "").toLowerCase();
    const capacity = (item?.capacity || item?.unit_name || "").toLowerCase();
    return (
      name.includes(query) ||
      description.includes(query) ||
      capacity.includes(query)
    );
  };

  // Compute filtered resources based on active filter
  const allVehicles = resources.filter(
    (item) => item.type === "vehicle" && matchesSearch(item),
  );
  const allFacilities = resources.filter(
    (item) => item.type === "facility" && matchesSearch(item),
  );
  const maintenanceItems = resources.filter(
    (item) =>
      (item.is_maintenance || item.status === "maintenance") &&
      matchesSearch(item),
  );

  // Determine which resources to display based on filter
  let displayedItems = [];
  let displayedCount = 0;

  switch (activeFilter) {
    case "maintenance":
      displayedItems = maintenanceItems;
      displayedCount = maintenanceItems.length;
      break;
    case "vehicle":
      displayedItems = allVehicles;
      displayedCount = allVehicles.length;
      break;
    case "facility":
      displayedItems = allFacilities;
      displayedCount = allFacilities.length;
      break;
    case "all":
    default:
      displayedItems = resources.filter(matchesSearch);
      displayedCount = resources.filter(matchesSearch).length;
      break;
  }

  const handleTabClick = (tab) => {
    setActiveFilter(tab);
  };

  const renderResourceCard = (item) => {
    const status = getResourceStatus(item);
    const statusConfig = STATUS_VARIANTS[status];
    const resourceType = item?.type?.toLowerCase();
    const isMaintenance = status === "maintenance";

    return (
      <div
        key={item.resource_id || item.id}
        className="group flex flex-col h-full overflow-hidden rounded-xl border border-line bg-white shadow-sm hover:shadow-md transition-shadow duration-200"
      >
        {/* Thumbnail with status badge overlay */}
        <div className="relative h-20 sm:h-36 w-full bg-paper flex items-center justify-center overflow-hidden border-b border-line">
          {item.image ? (
            <img
              src={item.image}
              alt={item.name}
              className={`h-full w-full object-cover transition-transform group-hover:scale-105 ${
                isMaintenance ? "grayscale opacity-60" : ""
              }`}
            />
          ) : (
            <div
              className={`flex flex-col items-center justify-center gap-2 text-steel ${
                isMaintenance ? "opacity-60" : ""
              }`}
            >
              <div
                className={`rounded-lg p-2.5 ${
                  isMaintenance
                    ? "bg-gray-100"
                    : resourceType === "vehicle"
                      ? "bg-amber-50 border border-amber-100"
                      : "bg-blue-50 border border-blue-100"
                }`}
              >
                {resourceType === "vehicle" ? (
                  <Car
                    size={20}
                    className={`text-amber-400 ${isMaintenance ? "opacity-50" : ""}`}
                  />
                ) : (
                  <Building2
                    size={20}
                    className={`text-blue-400 ${isMaintenance ? "opacity-50" : ""}`}
                  />
                )}
              </div>
              <span className="text-[10px]">No image</span>
            </div>
          )}

          {/* Desaturation overlay for maintenance items */}
          {isMaintenance && (
            <div className="absolute inset-0 bg-yellow-100/30" />
          )}

          {/* Status badge overlay on thumbnail */}
          <span
            className={`absolute top-1.5 right-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-medium border ${statusConfig.className}`}
          >
            {statusConfig.label}
          </span>
        </div>

        <div className="flex flex-col flex-1 p-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-[13px] font-semibold text-ink line-clamp-1">
                {item.name}
              </h3>
              {isMaintenance && (
                <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-orange-100 text-orange-800">
                  <Wrench size={8} /> Under Maintenance
                </span>
              )}
            </div>
            {isAdmin && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleOpenModal(item)}
                  className="text-steel hover:text-brand transition p-1"
                  title="Edit Resource"
                >
                  <Edit2 size={12} />
                </button>
                <button
                  onClick={() => handleMaintenanceToggle(item)}
                  className={`transition p-1 ${
                    isMaintenance
                      ? "text-orange-600 hover:text-orange-700"
                      : "text-steel hover:text-orange-600"
                  }`}
                  title={
                    isMaintenance
                      ? "Mark as Available"
                      : "Mark as Under Maintenance"
                  }
                >
                  <Wrench size={12} />
                </button>
                <button
                  onClick={() => handleDelete(item.resource_id || item.id)}
                  className="text-steel hover:text-red-500 transition p-1"
                  title="Delete Resource"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </div>

          <p className="mt-1.5 text-[11px] text-steel">
            {item.type === "vehicle" ? "Unit Details:" : "Capacity:"}{" "}
            <span className="font-medium text-ink">
              {item.type === "facility"
                ? formatCapacity(item.capacity)
                : item.unit_name || item.capacity
                  ? `${item.unit_name || item.capacity}`
                  : "N/A"}
            </span>
          </p>
          <p className="mt-1 text-[10px] text-steel line-clamp-2">
            {item.description || "No description provided."}
          </p>
        </div>

        {/* Request Button Footer */}
        <div className="p-2 pt-0 mt-auto">
          {isMaintenance ? (
            <button
              disabled
              className="w-full flex items-center justify-center gap-1 rounded-md bg-gray-200 text-gray-500 py-1.5 text-[10px] font-medium cursor-not-allowed opacity-60"
            >
              <Wrench size={10} /> Under Maintenance
            </button>
          ) : isAdmin ? (
            <button
              onClick={() => handleOpenRequestModal(item, true)}
              className="w-full flex items-center justify-center gap-1 rounded-md bg-brand text-white hover:bg-brand-dark py-1.5 text-[10px] font-medium transition"
            >
              <Calendar size={10} /> Book
            </button>
          ) : (
            <button
              onClick={() => handleOpenRequestModal(item)}
              className="w-full flex items-center justify-center gap-1 rounded-md bg-brand-light text-brand hover:bg-brand hover:text-white py-1.5 text-[10px] font-medium transition"
            >
              <Calendar size={10} /> Request
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[20px] font-semibold text-ink">
          Facilities & Fleet
        </h1>
        {isAdmin && (
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 transition"
          >
            <Plus size={16} /> Add Resource
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-steel" />
        <input
          type="text"
          placeholder="Search resources by name or description..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-md border border-line pl-7 pr-3 py-1.5 text-[12.5px] outline-none focus:border-brand"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-steel hover:text-ink"
            title="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {/* Segmented Control / Tab Filter */}
      <div className="mb-6 flex flex-wrap gap-1 overflow-x-auto whitespace-nowrap rounded-lg bg-gray-100 p-1 border border-line">
        <button
          onClick={() => handleTabClick("all")}
          className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px] font-medium transition ${
            activeFilter === "all"
              ? "bg-white text-ink shadow-sm"
              : "text-steel hover:text-ink"
          }`}
        >
          All ({displayedCount})
        </button>
        <button
          onClick={() => handleTabClick("vehicle")}
          className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px] font-medium transition ${
            activeFilter === "vehicle"
              ? "bg-white text-ink shadow-sm"
              : "text-steel hover:text-ink"
          }`}
        >
          <Car size={15} /> Vehicles ({allVehicles.length})
        </button>
        <button
          onClick={() => handleTabClick("facility")}
          className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px] font-medium transition ${
            activeFilter === "facility"
              ? "bg-white text-ink shadow-sm"
              : "text-steel hover:text-ink"
          }`}
        >
          <Building2 size={15} /> Facilities ({allFacilities.length})
        </button>
        <button
          onClick={() => handleTabClick("maintenance")}
          className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px] font-medium transition ${
            activeFilter === "maintenance"
              ? "bg-white text-yellow-800 shadow-sm border border-yellow-200"
              : "text-steel hover:text-ink"
          }`}
        >
          🟡 In Maintenance ({maintenanceItems.length})
        </button>
      </div>

      {/* Resource Grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonResourceCard key={`skeleton-${i}`} />
          ))}
        </div>
      ) : displayedCount === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-white p-12 text-center">
          <Building2 size={40} className="text-steel mb-2 opacity-40" />
          <h2 className="text-[15px] font-semibold text-ink">
            No resources found
          </h2>
          <p className="text-[13px] text-steel mt-1 max-w-sm">
            {searchQuery
              ? "Try adjusting your search terms."
              : "Get started by adding your first facility or vehicle using the button above."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {displayedItems.map(renderResourceCard)}
        </div>
      )}

      {/* Vehicle Booking Modal (uses dedicated component) */}
      <VehicleBookingModal
        isOpen={!!selectedResource && resourceType === "vehicle"}
        onClose={() => {
          setSelectedResource(null);
          setResourceType(null);
          setIsDirectUse(false);
        }}
        onSubmit={(payload) =>
          handleBookingSubmit({
            ...payload,
            _originalResource: selectedResource,
            resourceName: selectedResource?.name,
          })
        }
        selectedVehicle={selectedResource}
        isDirectUse={isDirectUse}
      />

      {/* Facility Booking Modal (uses dedicated component) */}
      <FacilityBookingModal
        isOpen={!!selectedResource && resourceType === "facility"}
        onClose={() => {
          setSelectedResource(null);
          setResourceType(null);
          setIsDirectUse(false);
        }}
        onSubmit={(payload) =>
          handleBookingSubmit({
            ...payload,
            _originalResource: selectedResource,
            resourceName: selectedResource?.name,
          })
        }
        selectedFacility={selectedResource}
        isDirectUse={isDirectUse}
      />

      {/* Add / Edit Resource Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-[16px] font-semibold mb-4">
              {editingResource ? "Edit Resource" : "Add New Resource"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-ink mb-1">
                  Resource Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full rounded-md border border-line px-3 py-2 text-[13px] focus:outline-none focus:border-brand"
                  placeholder="e.g., Conference Room A or Delivery Van"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-ink mb-1">
                  Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value })
                  }
                  className="w-full rounded-md border border-line px-3 py-2 text-[13px] focus:outline-none focus:border-brand"
                >
                  <option value="facility">Facility</option>
                  <option value="vehicle">Vehicle</option>
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-ink mb-1">
                  {formData.type === "facility"
                    ? "Capacity (pax)"
                    : "Unit Name / Plate"}
                </label>
                <input
                  type="text"
                  value={formData.capacity}
                  onChange={(e) =>
                    setFormData({ ...formData, capacity: e.target.value })
                  }
                  className="w-full rounded-md border border-line px-3 py-2 text-[13px] focus:outline-none focus:border-brand"
                  placeholder={
                    formData.type === "facility" ? "e.g., 50" : "e.g., ABC-1234"
                  }
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-ink mb-1">
                  Description
                </label>
                <textarea
                  rows="2"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full rounded-md border border-line px-3 py-2 text-[13px] focus:outline-none focus:border-brand"
                  placeholder="Brief details about this resource..."
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-ink mb-1">
                  Resource Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setFormData({ ...formData, image: e.target.files[0] })
                  }
                  className="w-full text-[13px] text-steel file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-[13px] file:font-semibold file:bg-brand-light file:text-brand-dark hover:file:opacity-80"
                />
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-md border border-line px-4 py-2 text-[13px] text-steel hover:bg-paper"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-brand px-4 py-2 text-[13px] font-medium text-white hover:opacity-90"
                >
                  {editingResource ? "Save Changes" : "Create Resource"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
