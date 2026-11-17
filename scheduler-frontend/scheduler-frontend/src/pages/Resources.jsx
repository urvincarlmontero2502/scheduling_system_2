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
  Users as UserGroupIcon,
  FileText,
} from "lucide-react";
import * as api from "../api/endpoints";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { useCachedData } from "../hooks/useCachedData";
import { useTabUrlSync } from "../hooks/useTabUrlSync";
import { formatResourcePrice } from "../utils/resourcePricing";
import {
  readCache,
  writeCache,
  invalidateCache,
  CACHE_KEYS,
} from "../utils/cache";
import VehicleBookingModal from "../components/VehicleBookingModal";
import FacilityBookingModal from "../components/FacilityBookingModal";
import { SkeletonResourceCard } from "../components/Skeleton";
import ConfirmModal from "../components/ConfirmModal";
import { compressImageFile } from "../utils/imageCompression";

/** Status badge configuration */
const STATUS_VARIANTS = {
  available: {
    label: "Available",
    className: "bg-blue-50 text-blue-700 border border-blue-200/60",
  },
  booked: {
    label: "In Use",
    className: "bg-amber-50 text-amber-700 border border-amber-200/60",
  },
  maintenance: {
    label: "Maintenance",
    className: "bg-yellow-50 text-yellow-800 border border-yellow-200/60",
  },
};

/** Format capacity with "pax" suffix, avoiding duplication */
function formatCapacity(cap) {
  if (!cap) return "Not specified";
  if (/\bpax$/i.test(cap)) return cap;
  return `${cap} pax`;
}

function ResourceCardImage({ src, alt, isMaintenance }) {
  const [useNaturalSize, setUseNaturalSize] = useState(false);

  return (
    <img
      src={src}
      alt={alt}
      onLoad={(event) => {
        const image = event.currentTarget;
        setUseNaturalSize(
          image.naturalWidth < image.clientWidth ||
            image.naturalHeight < image.clientHeight,
        );
      }}
      className={`rounded-lg ${
        useNaturalSize
          ? "block h-auto w-auto max-h-full max-w-full object-contain"
          : "h-full w-full object-cover"
      } ${isMaintenance ? "grayscale opacity-60" : ""}`}
    />
  );
}

/** Resolve the display status of a resource */
function getResourceStatus(item) {
  if (item.is_maintenance || item.status === "maintenance")
    return "maintenance";
  if (item.available === false || item.status === "booked") return "booked";
  return "available";
}

export default function Resources() {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const isSuperAdmin = user?.role === "admin";

  // Cached data hook — data persists across page switches
  const {
    data: resources,
    loading,
    refetch: refetchResources,
  } = useCachedData("resources", api.fetchResources);
  const isInitialized = true; // always initialized after mount with cached hook

  const [searchQuery, setSearchQuery] = useState("");
  // URL-synchronized filter tab
  const [activeFilter, setActiveFilter] = useTabUrlSync("filter", "all");

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState(null);
  const [confirmActionType, setConfirmActionType] = useState(null); // "delete" or "maintenance"
  const [selectedResource, setSelectedResource] = useState(null);
  const [resourceType, setResourceType] = useState(null);
  const [isDirectUse, setIsDirectUse] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state for creating/editing resources
  const [formData, setFormData] = useState({
    name: "",
    type: "facility",
    description: "",
    capacity: "",
    buffer_minutes: 30,
    price_per_day: "",
    price_per_hour: "",
    inclusions: "",
    images: [],
  });

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
        buffer_minutes: resource.buffer_minutes ?? 30,
        price_per_day: resource.price_per_day ?? "",
        price_per_hour: resource.price_per_hour ?? "",
        inclusions: resource.inclusions || "",
        images: [],
      });
    } else {
      setEditingResource(null);
      setFormData({
        name: "",
        type: "facility",
        description: "",
        capacity: "",
        buffer_minutes: 30,
        price_per_day: "",
        price_per_hour: "",
        inclusions: "",
        images: [],
      });
    }
    setIsModalOpen(true);
  };

  const handleOpenRequestModal = (item, direct = false) => {
    setSelectedResource(item);
    setResourceType(item?.type?.toLowerCase() || null);
    setIsDirectUse(direct);
  };

  const handleDelete = (item) => {
    const resourceId = item.resource_id || item.id;
    if (!resourceId) {
      toast.error(
        "Error: Resource ID is missing. Please refresh and try again.",
      );
      return;
    }

    setConfirmActionType("delete");
    setConfirmModalData({
      item,
      resourceId,
      actionText: "delete",
    });
    setConfirmModalOpen(true);
  };

  const handleBookingSubmit = (payload) => {
    const apiPayload = {
      resource_id: payload.item_id,
      resource_ids: payload.resource_ids,
      start_date: payload.start_date,
      end_date: payload.end_date,
      start_time: payload.start_time,
      end_time: payload.end_time,
      purpose: payload.purpose,
      destination: payload.destination || null,
      full_name: payload.full_name || null,
      cell_number: payload.cell_number,
      email: payload.email || null,
      address: payload.address || null,
      attendees: payload.attendees ? Number(payload.attendees) : null,
      priority: payload.priority || "normal",
      status: payload.status || "pending",
    };

    const cachedResources = readCache(CACHE_KEYS.RESOURCES) || [];
    const isDirectUse = payload.status === "approved";
    const selectedResourceIds = payload.resource_ids || [payload.item_id];

    if (isDirectUse) {
      const updated = cachedResources.map((r) =>
        selectedResourceIds.some(
          (id) => String(r.resource_id || r.id) === String(id),
        )
          ? { ...r, available: false, status: "booked" }
          : r,
      );
      writeCache(CACHE_KEYS.RESOURCES, updated);
    }

    setSelectedResource(null);
    setResourceType(null);
    toast.success(
      isDirectUse
        ? "Resource allocated successfully!"
        : "Booking request submitted successfully!",
    );

    return api
      .createBooking(apiPayload)
      .then(() => {
        invalidateCache(CACHE_KEYS.HEALTH);
        refetchResources();
      })
      .catch((err) => {
        if (isDirectUse) {
          const restored = cachedResources.map((r) =>
            selectedResourceIds.some(
              (id) => String(r.resource_id || r.id) === String(id),
            )
              ? { ...r, available: true, status: "available" }
              : r,
          );
          writeCache(CACHE_KEYS.RESOURCES, restored);
          refetchResources();
        }

        window.dispatchEvent(new Event("bookingUpdated"));

        const msg =
          err?.response?.data?.message ||
          err?.response?.data?.conflict_message ||
          "Failed to submit booking request. Please try again.";
        toast.error(msg);

        if (err?.response?.status === 409 || err?.response?.status === 422) {
          setSelectedResource(payload._originalResource || null);
        }

        throw err;
      });
  };

  const handleMaintenanceToggle = (item) => {
    const resourceId = item.resource_id || item.id;
    if (!resourceId) {
      toast.error(
        "Error: Resource ID is missing. Please refresh and try again.",
      );
      return;
    }
    const isCurrentlyMaintenance =
      item.is_maintenance || item.status === "maintenance";
    const actionText = isCurrentlyMaintenance
      ? "available"
      : "under maintenance";

    setConfirmActionType("maintenance");
    setConfirmModalData({
      item,
      resourceId,
      isCurrentlyMaintenance,
      actionText,
    });
    setConfirmModalOpen(true);
  };

  const confirmMaintenanceToggle = async () => {
    if (!confirmModalData) return;
    const { resourceId, isCurrentlyMaintenance, actionText } = confirmModalData;

    const request = isCurrentlyMaintenance
      ? api.setResourceAvailable?.(resourceId)
      : api.setResourceMaintenance?.(resourceId);

    const prevResources = [...resources];
    const updated = resources.map((r) =>
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

    setConfirmModalOpen(false);
    setConfirmModalData(null);
    setConfirmActionType(null);

    try {
      await request;
      toast.success(`Resource marked as ${actionText} successfully`);
      refetchResources();
      window.dispatchEvent(new Event("cacheInvalidated"));
    } catch (err) {
      writeCache(CACHE_KEYS.RESOURCES, prevResources);
      refetchResources();

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
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmModalData) return;

    if (confirmActionType === "delete") {
      const { resourceId } = confirmModalData;
      const cached = readCache(CACHE_KEYS.RESOURCES) || [];
      const updated = cached.filter(
        (r) => String(r.resource_id || r.id) !== String(resourceId),
      );
      writeCache(CACHE_KEYS.RESOURCES, updated);

      setConfirmModalOpen(false);
      setConfirmModalData(null);
      setConfirmActionType(null);

      api
        .deleteResource?.(resourceId)
        .then(() => {
          toast.success("Resource deleted successfully");
          refetchResources();
          window.dispatchEvent(new Event("cacheInvalidated"));
        })
        .catch((err) => {
          writeCache(CACHE_KEYS.RESOURCES, cached);
          refetchResources();
          const msg =
            err?.response?.data?.message ||
            err?.message ||
            "Failed to delete resource. Please try again.";
          toast.error(msg);
        });
    } else {
      await confirmMaintenanceToggle();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const unsupportedFile = formData.images.find((file) => {
      const type = (file.type || "").toLowerCase();
      return !["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(
        type,
      );
    });
    if (unsupportedFile) {
      setIsSubmitting(false);
      toast.error("Please use a JPG, PNG or WebP photo.");
      return;
    }

    let processedFiles = formData.images;
    if (formData.images.length > 0) {
      toast.info("Optimizing photos...");
      try {
        processedFiles = await Promise.all(
          formData.images.map(async (file) => {
            try {
              const compressed = await compressImageFile(file, 1200, 0.85);
              return new File([compressed], file.name, { type: "image/jpeg" });
            } catch (err) {
              console.warn(
                "Photo compression failed, falling back to original:",
                err,
              );
              return file;
            }
          }),
        );
      } catch (err) {
        console.warn("Compression step error:", err);
      }
    }

    const oversizedImage = processedFiles.find(
      (image) => image.size > 10 * 1024 * 1024,
    );
    if (oversizedImage) {
      setIsSubmitting(false);
      toast.error(`${oversizedImage.name} exceeds the 10 MB limit.`);
      return;
    }

    const data = new FormData();
    data.append("name", formData.name);
    data.append("type", formData.type);
    data.append("description", formData.description || "");
    data.append("buffer_minutes", formData.buffer_minutes);
    if (formData.type === "facility") {
      data.append("price_per_day", formData.price_per_day);
    } else if (isSuperAdmin) {
      data.append("price_per_hour", formData.price_per_hour);
    }
    data.append("inclusions", formData.inclusions || "");

    if (formData.type === "facility") {
      data.append("capacity", formData.capacity || "");
    } else {
      data.append("unit_name", formData.capacity || "");
    }

    processedFiles.forEach((image) => data.append("images[]", image));

    if (editingResource) {
      data.append("_method", "PUT");
    }

    const prevResources = [...resources];
    const actionText = editingResource ? "updated" : "created";

    const request = editingResource
      ? client.post(
          `/resources/${editingResource.resource_id || editingResource.id}`,
          data,
        )
      : api.createResource(data);

    request
      .then((res) => {
        setIsModalOpen(false);
        setIsSubmitting(false);
        toast.success(`Resource ${actionText} successfully.`, {
          duration: 3000,
        });
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
          }
        }
        refetchResources();
        window.dispatchEvent(new Event("cacheInvalidated"));
      })
      .catch((err) => {
        setIsSubmitting(false);
        writeCache(CACHE_KEYS.RESOURCES, prevResources);
        refetchResources();
        const validationErrors = Object.values(
          err?.response?.data?.errors || {},
        ).flat();
        toast.error(
          validationErrors[0] ||
            err?.response?.data?.message ||
            "Failed to save resource. Please try again.",
        );
      });
  };

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

  let displayedItems = [];
  let displayedCount = 0;

  const sortByName = (items) =>
    [...items].sort((a, b) => (a?.name || "").localeCompare(b?.name || ""));

  switch (activeFilter) {
    case "maintenance":
      displayedItems = sortByName(maintenanceItems);
      displayedCount = maintenanceItems.length;
      break;
    case "vehicle":
      displayedItems = sortByName(allVehicles);
      displayedCount = allVehicles.length;
      break;
    case "facility":
      displayedItems = sortByName(allFacilities);
      displayedCount = allFacilities.length;
      break;
    case "all":
    default:
      displayedItems = sortByName(resources.filter(matchesSearch));
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
        className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex flex-col justify-between h-full transition transform hover:shadow-md hover:-translate-y-0.5">
        {/* Thumbnail with status badge overlay */}
        <div className="relative w-full h-28 sm:h-32 bg-white flex items-center justify-center shrink-0 overflow-hidden rounded-lg mb-2">
          {item.image ? (
            <ResourceCardImage
              src={item.image}
              alt={item.name}
              isMaintenance={isMaintenance}
            />
          ) : (
            <div
              className={`flex flex-col items-center justify-center gap-2 text-slate-500 ${
                isMaintenance ? "opacity-60" : ""
              }`}>
              <div
                className={`rounded-lg p-2.5 ${
                  isMaintenance
                    ? "bg-gray-100"
                    : resourceType === "vehicle"
                      ? "bg-amber-50 border border-amber-100"
                      : "bg-blue-50 border border-blue-100"
                }`}>
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
              <span className="text-xs">No image provided</span>
            </div>
          )}

          {isMaintenance && (
            <div className="absolute inset-0 bg-yellow-100/30" />
          )}

          <span
            className={`absolute top-2 right-2 z-10 px-2.5 py-0.5 text-[11px] font-medium rounded-full border ${statusConfig.className}`}>
            {statusConfig.label}
          </span>
          <span className="absolute top-2 left-2 z-10 rounded-full border border-blue-100 bg-white/95 px-2 py-1 text-[10px] font-semibold text-blue-800 shadow-sm">
            {resourceType === "vehicle"
              ? `${formatResourcePrice(item.price_per_hour)} / hour`
              : `${formatResourcePrice(item.price_per_day)} / day`}
          </span>
        </div>

        <div className="flex flex-col flex-1">
          {/* Header Row: Title & Clean Inline Admin Toolbar */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-sm font-bold text-slate-800 line-clamp-2 break-words leading-snug">
              {item.name}
            </h3>

            {isAdmin && (
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => handleOpenModal(item)}
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors"
                  title="Edit Resource">
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => handleMaintenanceToggle(item)}
                  className={`p-1.5 rounded-md transition-colors ${
                    isMaintenance
                      ? "text-orange-600 hover:text-orange-700 hover:bg-slate-100"
                      : "text-slate-400 hover:text-orange-600 hover:bg-slate-100"
                  }`}
                  title={
                    isMaintenance
                      ? "Mark as Available"
                      : "Mark as Under Maintenance"
                  }>
                  <Wrench size={14} />
                </button>
                <button
                  onClick={() => handleDelete(item)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded-md transition-colors"
                  title="Delete Resource">
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>

          {(() => {
            const isFacility = resourceType === "facility";
            if (isFacility) {
              const rawCap = (item.capacity || "").trim();
              const isValidCap =
                rawCap &&
                rawCap !== "pax" &&
                rawCap !== "-" &&
                rawCap !== "N/A";
              return (
                <p className="text-xs text-slate-500 font-medium mb-1 flex items-center gap-1">
                  <UserGroupIcon size={12} className="inline" />
                  Capacity:{" "}
                  <span className="font-medium text-slate-700">
                    {isValidCap ? formatCapacity(rawCap) : "Not specified"}
                  </span>
                </p>
              );
            } else {
              const unitDetails =
                item.unit_name || item.unit_details || item.capacity;
              const rawUnit = (unitDetails || "").trim();
              const isValidUnit =
                rawUnit && rawUnit !== "-" && rawUnit !== "N/A";
              return (
                <p className="text-xs text-slate-500 font-medium mb-1 flex items-center gap-1">
                  <UserGroupIcon size={12} className="inline" />
                  Unit Details:{" "}
                  <span className="font-medium text-slate-700">
                    {isValidUnit ? rawUnit : "Not specified"}
                  </span>
                </p>
              );
            }
          })()}
          <p className="text-xs text-slate-600 line-clamp-2 leading-tight mb-3 min-h-[2.5rem]">
            {item.description || "No description provided."}
          </p>
        </div>

        {/* CTA Footer */}
        <div className="mt-auto w-full">
          {isMaintenance ? (
            <button
              disabled
              className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-slate-100 text-slate-400 cursor-not-allowed flex items-center justify-center gap-1 mt-auto">
              <Wrench size={12} />
              Under Maintenance
            </button>
          ) : isAdmin ? (
            <button
              onClick={() => handleOpenRequestModal(item, true)}
              className="w-full py-2 px-3 text-xs font-semibold rounded-lg border border-blue-600 text-blue-700 hover:bg-blue-600 hover:text-white flex items-center justify-center gap-1 mt-auto transition-colors duration-150">
              <Calendar size={12} /> Book
            </button>
          ) : (
            <button
              onClick={() => handleOpenRequestModal(item)}
              className="w-full py-2 px-3 text-xs font-semibold rounded-lg border border-blue-600 text-blue-700 hover:bg-blue-600 hover:text-white flex items-center justify-center gap-1 mt-auto transition-colors duration-150">
              <Calendar size={12} /> Request Booking
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-[20px] font-semibold text-slate-900">
          Facilities &amp; Vehicles
        </h1>
        {isAdmin && (
          <button
            onClick={() => handleOpenModal()}
            className="flex shrink-0 items-center justify-center gap-1 rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-800">
            <Plus size={14} />
            Add Resource
          </button>
        )}
      </div>

      {/* Action Toolbar Row: Filter Pills (Left) + Search Bar (Right) */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6 w-full">
        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => handleTabClick("all")}
            className={`flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-semibold rounded-lg border transition-all shrink-0 ${
              activeFilter === "all"
                ? "bg-brand text-white shadow-sm border-brand"
                : "bg-white border border-line text-steel hover:bg-paper transition-colors"
            }`}>
            <FileText
              size={14}
              className={`inline mr-1 ${activeFilter === "all" ? "text-white" : "text-steel"}`}
            />{" "}
            All Resources
          </button>
          <button
            onClick={() => handleTabClick("vehicle")}
            className={`flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-semibold rounded-lg border transition-all shrink-0 ${
              activeFilter === "vehicle"
                ? "bg-brand text-white shadow-sm border-brand"
                : "bg-white border border-line text-steel hover:bg-paper transition-colors"
            }`}>
            <Car
              size={15}
              className={`inline mr-1 ${activeFilter === "vehicle" ? "text-white" : "text-steel"}`}
            />{" "}
            Vehicles Overview
          </button>
          <button
            onClick={() => handleTabClick("facility")}
            className={`flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-semibold rounded-lg border transition-all shrink-0 ${
              activeFilter === "facility"
                ? "bg-brand text-white shadow-sm border-brand"
                : "bg-white border border-line text-steel hover:bg-paper transition-colors"
            }`}>
            <Building2
              size={15}
              className={`inline mr-1 ${activeFilter === "facility" ? "text-white" : "text-steel"}`}
            />{" "}
            Facilities Overview
          </button>
          <button
            onClick={() => handleTabClick("maintenance")}
            className={`flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-semibold rounded-lg border transition-all shrink-0 ${
              activeFilter === "maintenance"
                ? "bg-brand text-white shadow-sm border-brand"
                : "bg-white border border-line text-steel hover:bg-paper transition-colors"
            }`}>
            In Maintenance
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full lg:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search size={15} className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 pl-9 pr-8 py-2 text-[13px] bg-white outline-none focus:border-blue-600 transition-colors shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-700 text-sm">
              ×
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 w-full max-w-full sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonResourceCard key={`skeleton-${i}`} />
          ))}
        </div>
      ) : !isInitialized ? (
        <div className="grid grid-cols-2 gap-4 w-full max-w-full sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonResourceCard key={`skeleton-init-${i}`} />
          ))}
        </div>
      ) : displayedCount === 0 ? (
        <div className="grid grid-cols-2 gap-4 w-full max-w-full sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonResourceCard key={`skeleton-empty-${i}`} />
          ))}
        </div>
      ) : (
        (() => {
          const facilitiesList = displayedItems
            .filter((item) => (item?.type || "").toLowerCase() === "facility")
            .sort((a, b) => (a?.name || "").localeCompare(b?.name || ""));
          const vehiclesList = displayedItems
            .filter((item) => (item?.type || "").toLowerCase() === "vehicle")
            .sort((a, b) => (a?.name || "").localeCompare(b?.name || ""));

          return (
            <div className="space-y-8">
              {facilitiesList.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
                    <Building2 size={18} className="text-blue-700" /> Facilities
                    Overview
                  </h2>
                  <div className="grid grid-cols-2 gap-4 w-full max-w-full sm:grid-cols-2 lg:grid-cols-4">
                    {facilitiesList.map(renderResourceCard)}
                  </div>
                </div>
              )}
              {vehiclesList.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
                    <Car size={18} className="text-blue-700" /> Vehicles
                    Overview
                  </h2>
                  <div className="grid grid-cols-2 gap-4 w-full max-w-full sm:grid-cols-2 lg:grid-cols-4">
                    {vehiclesList.map(renderResourceCard)}
                  </div>
                </div>
              )}
            </div>
          );
        })()
      )}

      {/* Vehicle Booking Modal */}
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
        availableVehicles={resources.filter(
          (resource) => resource.type?.toLowerCase() === "vehicle",
        )}
        isDirectUse={isDirectUse}
      />

      {/* Facility Booking Modal */}
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
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold mb-4">
              {editingResource ? "Edit Resource" : "Add New Resource"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Resource Name
                  <span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  placeholder="e.g., Conference Room A or Delivery Van"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Type
                  <span className="text-red-500 ml-0.5">*</span>
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value })
                  }
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600">
                  <option value="facility">Facility</option>
                  <option value="vehicle">Vehicle</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {formData.type === "facility"
                    ? "Capacity (pax)"
                    : "Unit Name / Plate"}
                  {formData.type === "facility" && (
                    <span className="text-red-500 ml-0.5">*</span>
                  )}
                </label>
                <input
                  type="text"
                  value={formData.capacity}
                  onChange={(e) =>
                    setFormData({ ...formData, capacity: e.target.value })
                  }
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  placeholder={
                    formData.type === "facility" ? "e.g., 50" : "e.g., ABC-1234"
                  }
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Buffer Time (Minutes)
                  <span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={formData.buffer_minutes}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      buffer_minutes: e.target.value,
                    })
                  }
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              {formData.type === "facility" && (
                <div>
                  <label
                    htmlFor="resource-price-per-day"
                    className="block text-xs font-medium text-slate-700 mb-1">
                    Price Per Day
                  </label>
                  <div className="flex items-center rounded-md border border-slate-200 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-500/20">
                    <span className="pl-3 text-xs text-slate-500">₱</span>
                    <input
                      id="resource-price-per-day"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={formData.price_per_day}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          price_per_day: e.target.value,
                        })
                      }
                      className="w-full rounded-r-md border-0 px-2 py-2 text-xs focus:outline-none focus:ring-0"
                      placeholder="--"
                    />
                  </div>
                </div>
              )}

              {formData.type === "vehicle" && isSuperAdmin && (
                <div>
                  <label
                    htmlFor="resource-price-per-hour"
                    className="block text-xs font-medium text-slate-700 mb-1">
                    Price Per Hour
                  </label>
                  <div className="flex items-center rounded-md border border-slate-200 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-500/20">
                    <span className="pl-3 text-xs text-slate-500">₱</span>
                    <input
                      id="resource-price-per-hour"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={formData.price_per_hour}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          price_per_hour: e.target.value,
                        })
                      }
                      className="w-full rounded-r-md border-0 px-2 py-2 text-xs focus:outline-none focus:ring-0"
                      placeholder="--"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows="2"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  placeholder="Brief details about this resource..."
                />
              </div>

              <div>
                <label
                  htmlFor="resource-inclusions"
                  className="block text-xs font-medium text-slate-700 mb-1">
                  What's Included
                </label>
                <textarea
                  id="resource-inclusions"
                  rows="3"
                  value={formData.inclusions}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      inclusions: e.target.value,
                    })
                  }
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  placeholder={
                    formData.type === "facility"
                      ? "e.g., Tables, chairs, and audio system"
                      : "e.g., Driver and fuel"
                  }
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Separate items with commas or new lines.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Resource Images (up to 3)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const selectedImages = Array.from(e.target.files || []);
                    if (selectedImages.length > 3) {
                      toast.error("Select no more than 3 images.");
                    }
                    const oversizedImage = selectedImages.find(
                      (image) => image.size > 10 * 1024 * 1024,
                    );
                    if (oversizedImage) {
                      toast.error(
                        `${oversizedImage.name} exceeds the 10 MB limit.`,
                      );
                    }
                    setFormData({
                      ...formData,
                      images: selectedImages
                        .filter((image) => image.size <= 10 * 1024 * 1024)
                        .slice(0, 3),
                    });
                  }}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  The first image is used as the resource thumbnail.
                  {editingResource?.images?.length
                    ? " Select new images to replace the current gallery."
                    : ""}
                </p>
                {formData.images.length > 0 && (
                  <p className="mt-1 text-[11px] text-slate-600">
                    Selected:{" "}
                    {formData.images.map((image) => image.name).join(", ")}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md disabled:opacity-50">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-xs disabled:opacity-50">
                  {isSubmitting && (
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  )}
                  {isSubmitting
                    ? "Saving..."
                    : editingResource
                      ? "Save Changes"
                      : "Create Resource"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unified Confirmation Modal for Maintenance & Deletion */}
      <ConfirmModal
        open={confirmModalOpen}
        onClose={() => {
          setConfirmModalOpen(false);
          setConfirmModalData(null);
          setConfirmActionType(null);
        }}
        onConfirm={handleConfirmAction}
        titleIcon={confirmActionType === "delete" ? Trash2 : Wrench}
        titleIconColor={
          confirmActionType === "delete" ? "text-red-600" : "text-orange-600"
        }
        title={
          confirmActionType === "delete"
            ? "Delete Resource"
            : confirmModalData?.isCurrentlyMaintenance
              ? "Mark as Available"
              : "Mark as Under Maintenance"
        }
        message={
          confirmActionType === "delete"
            ? `Are you sure you want to delete "${confirmModalData?.item?.name}"? This action cannot be undone.`
            : `Are you sure you want to mark "${confirmModalData?.item?.name}" as ${confirmModalData?.actionText}?`
        }
        confirmText={confirmActionType === "delete" ? "Delete" : "Confirm"}
        confirmButtonClass={
          confirmActionType === "delete"
            ? "bg-red-600 hover:bg-red-700 text-white"
            : "bg-blue-600 hover:bg-blue-700 text-white"
        }
      />
    </div>
  );
}
