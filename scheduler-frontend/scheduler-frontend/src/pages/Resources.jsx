import { useState, useEffect } from "react";
import {
  Image as ImageIcon,
  Plus,
  Edit2,
  Trash2,
  Building2,
  Car,
  Calendar,
  Send,
} from "lucide-react";
import * as api from "../api/endpoints";

export default function Resources() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  const [editingResource, setEditingResource] = useState(null);
  const [selectedResource, setSelectedResource] = useState(null);

  // Form state for creating/editing resources
  const [formData, setFormData] = useState({
    name: "",
    type: "facility",
    description: "",
    capacity: "",
    image: null,
  });

  // Form state for resource booking requests
  const [requestData, setRequestData] = useState({
    startDate: "",
    endDate: "",
    destination: "",
    name: "",
    address: "",
    phone: "",
  });

  const loadResources = () => {
    setLoading(true);
    api
      .fetchResources?.()
      .then((res) => {
        setResources(Array.isArray(res.data) ? res.data : []);
      })
      .catch((err) => console.error("Failed to fetch resources", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadResources();
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

  const handleOpenRequestModal = (resource) => {
    setSelectedResource(resource);
    setRequestData({
      startDate: "",
      endDate: "",
      destination: "",
      name: "",
      address: "",
      phone: "",
    });
    setIsRequestModalOpen(true);
  };

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this resource?")) {
      api
        .deleteResource?.(id)
        .then(() => {
          loadResources();
        })
        .catch((err) => {
          console.error("Failed to delete resource", err);
        });
    }
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

    const request = editingResource
      ? api.client.post(`/resources/${editingResource.resource_id}`, data)
      : api.createResource(data);

    request
      .then(() => {
        setIsModalOpen(false);
        loadResources();
      })
      .catch((err) => {
        console.error("Failed to save resource", err.response?.data || err);
      });
  };

  const handleRequestSubmit = (e) => {
    e.preventDefault();
    // Payload to submit booking request
    const payload = {
      resource_id: selectedResource?.resource_id,
      ...requestData,
    };

    console.log("Submitting resource request:", payload);
    alert(`Request submitted successfully for ${selectedResource?.name}!`);
    setIsRequestModalOpen(false);
  };

  const vehicles = resources.filter((item) => item.type === "vehicle");
  const facilities = resources.filter((item) => item.type === "facility");

  const renderResourceCard = (item) => (
    <div
      key={item.resource_id}
      className="flex flex-col justify-between overflow-hidden rounded-lg border border-line bg-white shadow-sm hover:shadow-md transition">
      <div>
        <div className="h-32 w-full bg-paper flex items-center justify-center overflow-hidden border-b border-line relative">
          {item.image ? (
            <img
              src={item.image}
              alt={item.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center text-steel gap-1">
              <ImageIcon size={22} />
              <span className="text-[11px]">No image</span>
            </div>
          )}
        </div>
        <div className="p-3.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[14px] font-semibold text-ink line-clamp-1">
              {item.name}
            </h3>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => handleOpenModal(item)}
                className="text-steel hover:text-brand transition p-1"
                title="Edit Resource">
                <Edit2 size={15} />
              </button>
              <button
                onClick={() => handleDelete(item.resource_id)}
                className="text-steel hover:text-red-500 transition p-1"
                title="Delete Resource">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
          <p className="mt-1.5 text-[12.5px] text-steel">
            Details:{" "}
            <span className="font-medium text-ink">
              {item.capacity || item.unit_name || "—"}
            </span>
          </p>
          <p className="mt-1 text-[12px] text-steel line-clamp-2">
            {item.description || "No description provided."}
          </p>
        </div>
      </div>

      {/* Request Button Footer */}
      <div className="p-3.5 pt-0">
        <button
          onClick={() => handleOpenRequestModal(item)}
          className="w-full mt-2 flex items-center justify-center gap-1.5 rounded-md bg-brand-light text-brand hover:bg-brand hover:text-white py-2 text-[12.5px] font-medium transition">
          <Calendar size={14} /> Request Use
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[20px] font-semibold text-ink">
          Facilities & Vehicles
        </h1>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 transition">
          <Plus size={16} /> Add Resource
        </button>
      </div>

      {loading ? (
        <p className="text-[13px] text-steel">Loading resources...</p>
      ) : resources.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line bg-white p-12 text-center">
          <Building2 size={40} className="text-steel mb-2 opacity-40" />
          <h2 className="text-[15px] font-semibold text-ink">
            No resources found
          </h2>
          <p className="text-[13px] text-steel mt-1 max-w-sm">
            Get started by adding your first facility or vehicle using the
            button above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left Column: Vehicles */}
          <div className="rounded-xl border border-line bg-paper/50 p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3 px-1">
              <div className="flex items-center gap-2">
                <Car size={18} className="text-brand" />
                <h2 className="text-[15px] font-semibold text-ink">Vehicles</h2>
              </div>
              <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[12px] font-medium text-brand">
                {vehicles.length}
              </span>
            </div>

            {vehicles.length === 0 ? (
              <p className="text-[13px] text-steel italic p-4 text-center">
                No vehicles registered.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {vehicles.map(renderResourceCard)}
              </div>
            )}
          </div>

          {/* Right Column: Facilities */}
          <div className="rounded-xl border border-line bg-paper/50 p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3 px-1">
              <div className="flex items-center gap-2">
                <Building2 size={18} className="text-brand" />
                <h2 className="text-[15px] font-semibold text-ink">
                  Facilities
                </h2>
              </div>
              <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[12px] font-medium text-brand">
                {facilities.length}
              </span>
            </div>

            {facilities.length === 0 ? (
              <p className="text-[13px] text-steel italic p-4 text-center">
                No facilities registered.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {facilities.map(renderResourceCard)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Request Booking Modal */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-line pb-3">
              <div>
                <h2 className="text-[16px] font-semibold text-ink">
                  Request Resource Use
                </h2>
                <p className="text-[12.5px] text-steel">
                  Booking:{" "}
                  <span className="font-medium text-brand">
                    {selectedResource?.name}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setIsRequestModalOpen(false)}
                className="text-steel hover:text-ink text-[18px] font-bold">
                &times;
              </button>
            </div>

            <form onSubmit={handleRequestSubmit} className="space-y-4">
              {/* Date & Duration Calendar Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-medium text-ink mb-1">
                    Start Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={requestData.startDate}
                    onChange={(e) =>
                      setRequestData({
                        ...requestData,
                        startDate: e.target.value,
                      })
                    }
                    className="w-full rounded-md border border-line px-3 py-2 text-[13px] focus:outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-ink mb-1">
                    End Date & Time (Duration)
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={requestData.endDate}
                    onChange={(e) =>
                      setRequestData({
                        ...requestData,
                        endDate: e.target.value,
                      })
                    }
                    className="w-full rounded-md border border-line px-3 py-2 text-[13px] focus:outline-none focus:border-brand"
                  />
                </div>
              </div>

              {/* Destination */}
              <div>
                <label className="block text-[13px] font-medium text-ink mb-1">
                  Where do you want to go / Purpose Location
                </label>
                <input
                  type="text"
                  required
                  value={requestData.destination}
                  onChange={(e) =>
                    setRequestData({
                      ...requestData,
                      destination: e.target.value,
                    })
                  }
                  placeholder="e.g., City Hall Conference Room / Provincial Site"
                  className="w-full rounded-md border border-line px-3 py-2 text-[13px] focus:outline-none focus:border-brand"
                />
              </div>

              {/* User Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-medium text-ink mb-1">
                    Your Name
                  </label>
                  <input
                    type="text"
                    required
                    value={requestData.name}
                    onChange={(e) =>
                      setRequestData({ ...requestData, name: e.target.value })
                    }
                    placeholder="e.g., Juan Dela Cruz"
                    className="w-full rounded-md border border-line px-3 py-2 text-[13px] focus:outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-ink mb-1">
                    Cell Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={requestData.phone}
                    onChange={(e) =>
                      setRequestData({ ...requestData, phone: e.target.value })
                    }
                    placeholder="e.g., 09123456789"
                    className="w-full rounded-md border border-line px-3 py-2 text-[13px] focus:outline-none focus:border-brand"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-ink mb-1">
                  Where You Live (Address)
                </label>
                <input
                  type="text"
                  required
                  value={requestData.address}
                  onChange={(e) =>
                    setRequestData({ ...requestData, address: e.target.value })
                  }
                  placeholder="e.g., Brgy. San Jose, Butuan City"
                  className="w-full rounded-md border border-line px-3 py-2 text-[13px] focus:outline-none focus:border-brand"
                />
              </div>

              <div className="flex justify-end gap-2 mt-6 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="rounded-md border border-line px-4 py-2 text-[13px] text-steel hover:bg-paper">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-[13px] font-medium text-white hover:opacity-90">
                  <Send size={14} /> Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Resource Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
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
                  className="w-full rounded-md border border-line px-3 py-2 text-[13px] focus:outline-none focus:border-brand">
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
                  className="rounded-md border border-line px-4 py-2 text-[13px] text-steel hover:bg-paper">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-brand px-4 py-2 text-[13px] font-medium text-white hover:opacity-90">
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
