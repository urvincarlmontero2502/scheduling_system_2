import { useEffect, useState } from "react";
import {
  Search,
  Printer,
  Eye,
  Trash2,
  Calendar,
  Clock,
  User,
  Building2,
  FileText,
  ImageIcon,
  RotateCcw,
} from "lucide-react";
import * as api from "../api/endpoints";
import StatusBadge from "../components/StatusBadge";
import { Skeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import {
  writeCache,
  CACHE_KEYS,
  invalidateCache,
} from "../utils/cache";
import { isSpecialEvent } from "../utils/specialEvents";

// Helper to look up resource image by resource_id or name
function getResourceImage(booking, resources) {
  const rid = booking.resource_id;
  const name = booking.resource || booking.resource_name || booking.item_name || "";
  const match =
    (rid != null && resources.find((r) => String(r.id || r.resource_id) === String(rid))) ||
    resources.find((r) =>
      (r.name || r.resource_name || r.item_name || "").toLowerCase() === name.toLowerCase()
    );
  return match?.image || "";
}

function formatTimeTo12Hour(timeStr) {
  if (!timeStr) return "";

  if (
    timeStr.toLowerCase().includes("am") ||
    timeStr.toLowerCase().includes("pm")
  ) {
    return timeStr;
  }

  const [hourStr, minuteStr] = timeStr.split(":");
  let hours = parseInt(hourStr, 10);

  if (isNaN(hours)) return timeStr;

  const minutes = minuteStr ? minuteStr.slice(0, 2) : "00";
  const ampm = hours >= 12 ? "PM" : "AM";

  hours = hours % 12;
  hours = hours || 12;

  return `${hours}:${minutes} ${ampm}`;
}

function normalizeDate(dateStr) {
  if (!dateStr) return null;
  // Handle ISO datetime: 2026-10-15T08:00:00 or 2026-10-15 08:00:00
  const datePart = String(dateStr).split("T")[0].split(" ")[0];
  const parts = datePart.split("-");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  if (!y || !m || !d) return null;
  // Format as YYYY-MM-DD with proper padding
  const year = String(y).padStart(4, "0");
  const month = String(m).padStart(2, "0");
  const day = String(d).padStart(2, "0");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${monthNames[m - 1]} ${day}, ${year}`;
}

function getDateValue(booking) {
  const startDate = normalizeDate(booking.start_date || booking.date);
  const endDate = normalizeDate(booking.end_date || booking.date);

  if (startDate && endDate && startDate !== endDate) {
    return `${startDate} to ${endDate}`;
  }

  return startDate || "—";
}

function getTimeValue(booking) {
  if (booking.start_time && booking.end_time) {
    return `${formatTimeTo12Hour(
      booking.start_time,
    )} - ${formatTimeTo12Hour(booking.end_time)}`;
  }

  if (booking.start_time) {
    return formatTimeTo12Hour(booking.start_time);
  }

  if (booking.time) {
    const parts = booking.time.split("-");

    if (parts.length === 2) {
      return `${formatTimeTo12Hour(
        parts[0].trim(),
      )} - ${formatTimeTo12Hour(parts[1].trim())}`;
    }

    return formatTimeTo12Hour(booking.time);
  }

  return "All Day";
}

export default function BookingHistory() {
  const [bookings, setBookings] = useState([]);
  const [removedBookings, setRemovedBookings] = useState([]);
  const [listMode, setListMode] = useState("history");
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const toast = useToast();
  const { user } = useAuth();
  const canDelete = user?.role === "admin";
  const canRestore = ["admin", "barangay_admin"].includes(user?.role);

  // New state variables for bulk print selection
  const [printMode, setPrintMode] = useState("month"); // 'month' or 'year'
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7), // Format: "YYYY-MM"
  );
  const [selectedYear, setSelectedYear] = useState(
    new Date().getFullYear().toString(), // Format: "YYYY"
  );

  useEffect(() => {
    api
      .fetchBookings()
      .then((res) => {
        const data = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
            ? res
            : [];
        setBookings(data);
      })
      .catch((error) => {
        console.error("Failed to load booking history:", error);
        toast.error(error?.response?.data?.message || "Could not load booking history.");
      })
      .finally(() => setLoading(false));

    api
      .fetchRemovedBookings()
      .then((res) => {
        const data = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.data?.data)
            ? res.data.data
            : [];
        setRemovedBookings(data);
      })
      .catch((error) => {
        console.error("Failed to load removed bookings:", error);
        toast.error(error?.response?.data?.message || "Could not load removed bookings.");
      });

    // Fetch resources for image lookup
    api
      .fetchResources()
      .then((res) => {
        const data = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.data?.data)
            ? res.data.data
            : [];
        setResources(data);
      })
      .catch((error) => {
        console.error("Failed to load resources for booking history:", error);
      });
      return () => {}; // cleanup placeholder for safety
  }, []);

  const historyBookings = bookings.filter((booking) => {
    const status = (booking.status || "").toLowerCase();
    return (
      !isSpecialEvent(booking) &&
      (status === "completed" ||
        status === "rejected" ||
        status === "cancelled" ||
        status === "approved")
    );
  });

  const displayedBookings = listMode === "removed" ? removedBookings : historyBookings;
  const filteredBookings = displayedBookings.filter((booking) => {
    const status = (booking.status || "").toLowerCase();

    const resource =
      typeof booking.resource === "object"
        ? booking.resource?.name ||
          booking.resource?.resource_name ||
          booking.resource_name ||
          booking.item_name ||
          ""
        : booking.resource || booking.resource_name || booking.item_name || "";

    const requester =
      booking.full_name ||
      booking.requester ||
      booking.user_name ||
      booking.user?.full_name ||
      "";

    const searchText = `${resource} ${requester} ${
      booking.purpose || ""
    } ${booking.id || booking.booking_id || ""} ${booking.reference_id || ""}`.toLowerCase();

    const matchesSearch = searchText.includes(search.toLowerCase());
    const matchesStatus =
      listMode === "removed" || statusFilter === "all" || status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  async function handleDelete(bookingId) {
    if (
      !window.confirm(
        `Move booking #${bookingId} to Removed Bookings? An administrator can restore it later.`,
      )
    ) {
      return;
    }

    try {
      const removedBooking = bookings.find(
        (booking) => (booking.id || booking.booking_id) === bookingId,
      );
      await api.deleteBooking(bookingId);
      setBookings((prev) =>
        prev.filter((b) => (b.id || b.booking_id) !== bookingId),
      );
      if (removedBooking) {
        setRemovedBookings((prev) => [
          { ...removedBooking, deleted_at: new Date().toISOString() },
          ...prev,
        ]);
      }
      if (
        selectedBooking &&
        (selectedBooking.id || selectedBooking.booking_id) === bookingId
      ) {
        setSelectedBooking(null);
      }
      invalidateCache(CACHE_KEYS.BOOKINGS);
      window.dispatchEvent(new Event("cacheInvalidated"));
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete booking.");
    }
  }

  async function handleRestore(bookingId) {
    try {
      await api.restoreBooking(bookingId);
      const restoredBooking = removedBookings.find(
        (booking) => (booking.id || booking.booking_id) === bookingId,
      );
      if (restoredBooking) {
        setBookings((prev) => [
          restoredBooking,
          ...prev.filter((booking) => (booking.id || booking.booking_id) !== bookingId),
        ]);
      }
      setRemovedBookings((prev) =>
        prev.filter((booking) => (booking.id || booking.booking_id) !== bookingId),
      );
      setSelectedBooking(null);
      invalidateCache(CACHE_KEYS.BOOKINGS);
      window.dispatchEvent(new Event("cacheInvalidated"));
      toast.success("Booking restored successfully.");
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Could not restore the booking.",
      );
    }
  }

  async function handleDeleteAll() {
    if (filteredBookings.length === 0) {
      toast.info("No bookings to delete.");
      return;
    }

    const confirmed = window.confirm(
      `Move all ${filteredBookings.length} booking(s) matching the current filter to Removed Bookings? An administrator can restore them later.`,
    );
    if (!confirmed) return;

    const ids = filteredBookings.map((b) => b.id || b.booking_id);
    const prevBookings = [...bookings];

    // Optimistically remove matching bookings from state + cache
    const updated = bookings.filter(
      (b) => !ids.includes(b.id || b.booking_id),
    );
    setBookings(updated);
    writeCache(CACHE_KEYS.BOOKINGS, updated);

    try {
      await Promise.all(
        ids.map((id) =>
          api.deleteBooking
            ? api.deleteBooking(id)
            : api.updateBookingStatus(id, "deleted"),
        ),
      );
      const removedAt = new Date().toISOString();
      setRemovedBookings((prev) => [
        ...filteredBookings.map((booking) => ({ ...booking, deleted_at: removedAt })),
        ...prev,
      ]);
      toast.success(`${filteredBookings.length} booking(s) deleted successfully`);
      invalidateCache(CACHE_KEYS.BOOKINGS);
      window.dispatchEvent(new Event("cacheInvalidated"));
    } catch {
      // Revert on failure
      setBookings(prevBookings);
      writeCache(CACHE_KEYS.BOOKINGS, prevBookings);
      toast.error("Failed to delete some bookings. Please try again.");
    }
  }

  function handlePrint(booking) {
    const bookingId = booking.id || booking.booking_id;
    const resource =
      typeof booking.resource === "object"
        ? booking.resource?.name ||
          booking.resource?.resource_name ||
          booking.resource_name ||
          booking.item_name ||
          "Resource"
        : booking.resource ||
          booking.resource_name ||
          booking.item_name ||
          "Resource";
    const requester =
      typeof booking.full_name === "string"
        ? booking.full_name
        : typeof booking.requester === "string"
          ? booking.requester
          : typeof booking.user_name === "string"
            ? booking.user_name
            : booking.user?.full_name || "Unknown Requestor";
    const barangay = booking.barangay || booking.user?.barangay || "Poblacion";
    const cellNumber =
      booking.cell_number || booking.contact || booking.phone || "N/A";
    const address =
      booking.where_do_you_live || booking.address || booking.location || "N/A";
    const email = booking.email || booking.user?.email || "N/A";
    const purpose =
      booking.purpose ||
      booking.reason ||
      booking.description ||
      "No purpose provided";

    const date = getDateValue(booking);
    const time = getTimeValue(booking);
    const status = (booking.status || "unknown").toUpperCase();
    const referenceId = booking.reference_id || `#${bookingId}`;

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      alert("Please allow pop-ups to print the booking.");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Booking #${bookingId}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 40px; color: #222; background: white; }
          .document { max-width: 800px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #222; padding-bottom: 20px; margin-bottom: 25px; }
          .header h1 { margin: 0; font-size: 22px; }
          .header h2 { margin: 6px 0 0; font-size: 18px; }
          .header p { margin: 5px 0 0; font-size: 13px; }
          .title { text-align: center; margin: 25px 0; }
          .title h3 { margin: 0; font-size: 20px; text-transform: uppercase; }
          .booking-id { text-align: right; font-size: 13px; margin-bottom: 20px; }
          .section { margin-top: 22px; }
          .section-title { font-weight: bold; font-size: 14px; background: #f3f4f6; padding: 9px; border: 1px solid #ddd; }
          table { width: 100%; border-collapse: collapse; }
          td { border: 1px solid #ddd; padding: 10px; font-size: 13px; }
          td:first-child { width: 35%; font-weight: bold; background: #fafafa; }
          .status { font-weight: bold; }
          .signature { display: flex; justify-content: space-between; margin-top: 80px; }
          .signature-box { width: 40%; text-align: center; border-top: 1px solid #222; padding-top: 8px; font-size: 12px; }
          .footer { margin-top: 50px; text-align: center; font-size: 11px; color: #777; }
          @media print { body { padding: 20px; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="document">
          <div class="header">
            <h1>REPUBLIC OF THE PHILIPPINES</h1>
            <h2>MUNICIPALITY OF JABONGA</h2>
            <p>AGUSAN DEL NORTE</p>
          </div>
          <div class="title">
            <h3>Facility / Utility Vehicle Booking Record</h3>
          </div>
          <div class="booking-id">
            Booking ID: <strong>#${bookingId}</strong>
            <br />Reference ID: <strong>${referenceId}</strong>
          </div>
          <div class="section">
            <div class="section-title">REQUESTOR INFORMATION</div>
            <table>
              <tr><td>Full Name</td><td>${requester}</td></tr>
              <tr><td>Barangay</td><td>${barangay}</td></tr>
              <tr><td>Cell Number</td><td>${cellNumber}</td></tr>
              <tr><td>Email</td><td>${email}</td></tr>
              <tr><td>Address</td><td>${address}</td></tr>
            </table>
          </div>
          <div class="section">
            <div class="section-title">BOOKING INFORMATION</div>
            <table>
              <tr><td>Resource</td><td>${resource}</td></tr>
              <tr><td>Date</td><td>${date}</td></tr>
              <tr><td>Time</td><td>${time}</td></tr>
              <tr><td>Purpose</td><td>${purpose}</td></tr>
              <tr><td>Status</td><td class="status">${status}</td></tr>
            </table>
          </div>
          <div class="signature">
            <div class="signature-box">Requestor</div>
            <div class="signature-box">Authorized Administrator</div>
          </div>
          <div class="footer">Generated by the Web-Based Real-Time Scheduling System</div>
        </div>
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  }

  // Batch Print Function for Month or Year
  function handlePrintBatch() {
    const matchingBookings = historyBookings.filter((booking) => {
      const dateStr = booking.start_date || booking.date || "";
      if (!dateStr) return false;

      if (printMode === "month") {
        // dateStr starts with "YYYY-MM"
        return dateStr.startsWith(selectedMonth);
      } else {
        // dateStr starts with "YYYY"
        return dateStr.startsWith(selectedYear);
      }
    });

    if (matchingBookings.length === 0) {
      alert(`No booking history found for the selected ${printMode}.`);
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow pop-ups to print the report.");
      return;
    }

    const periodLabel =
      printMode === "month"
        ? `Month: ${selectedMonth}`
        : `Year: ${selectedYear}`;

    const rowsHtml = matchingBookings
      .map((b, index) => {
        const id = b.id || b.booking_id;
        const req =
          b.full_name ||
          b.requester ||
          b.user_name ||
          b.user?.full_name ||
          "Unknown";
        const res = b.resource || b.resource_name || b.item_name || "Resource";
        const date = getDateValue(b);
        const status = (b.status || "").toUpperCase();

        return `
          <tr>
            <td>${index + 1}</td>
            <td>#${id}</td>
            <td>${req}</td>
            <td>${res}</td>
            <td>${date}</td>
            <td>${status}</td>
          </tr>
        `;
      })
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Booking Report - ${periodLabel}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 30px; color: #222; }
          .header { text-align: center; border-bottom: 2px solid #222; padding-bottom: 15px; margin-bottom: 20px; }
          .header h1 { margin: 0; font-size: 20px; }
          .header h2 { margin: 5px 0 0; font-size: 16px; }
          .title { text-align: center; margin-bottom: 20px; }
          .title h3 { margin: 0; font-size: 18px; text-transform: uppercase; }
          .meta { font-size: 13px; margin-bottom: 15px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ccc; padding: 8px 10px; font-size: 12px; text-align: left; }
          th { background: #f3f4f6; }
          .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #777; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>REPUBLIC OF THE PHILIPPINES</h1>
          <h2>MUNICIPALITY OF JABONGA</h2>
        </div>
        <div class="title">
          <h3>Booking History Report (${printMode.toUpperCase()})</h3>
        </div>
        <div class="meta">
          Period: ${periodLabel} | Total Records: ${matchingBookings.length}
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>ID</th>
              <th>Requestor</th>
              <th>Resource</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <div class="footer">Generated by the Web-Based Real-Time Scheduling System</div>
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  }

  return (
    <div className="pb-12">
      <div className="px-4 py-5 sm:px-6 sm:py-6 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2" role="tablist" aria-label="Booking history views">
          <button
            type="button"
            onClick={() => setListMode("history")}
            role="tab"
            aria-selected={listMode === "history"}
            className={`group flex min-h-[76px] items-center gap-3 rounded-xl border p-4 text-left transition-all ${
              listMode === "history"
                ? "border-blue-200 bg-white shadow-sm ring-2 ring-blue-100"
                : "border-slate-200 bg-white/70 hover:border-slate-300 hover:bg-white"
            }`}
          >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              listMode === "history" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
            }`}>
              <Clock size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-800">Booking History</span>
              <span className="mt-0.5 block text-xs text-slate-500">Completed and reviewed reservations</span>
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {historyBookings.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setListMode("removed")}
            role="tab"
            aria-selected={listMode === "removed"}
            className={`group flex min-h-[76px] items-center gap-3 rounded-xl border p-4 text-left transition-all ${
              listMode === "removed"
                ? "border-blue-200 bg-white shadow-sm ring-2 ring-blue-100"
                : "border-slate-200 bg-white/70 hover:border-slate-300 hover:bg-white"
            }`}
          >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              listMode === "removed" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
            }`}>
              <RotateCcw size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-800">Removed Bookings</span>
              <span className="mt-0.5 block text-xs text-slate-500">Soft-deleted records available for restore</span>
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {removedBookings.length}
            </span>
          </button>
        </div>

        {/* Unified Control & Toolbar Strip */ }
        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:flex-row xl:items-center xl:justify-between">
          {/* Left: Batch Print group */ }
          {listMode === "history" ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <span className="text-xs font-semibold text-slate-700">Batch print</span>
            <select
              value={printMode}
              onChange={(e) => setPrintMode(e.target.value)}
              aria-label="Batch print period"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="month">By Month</option>
              <option value="year">By Year</option>
            </select>

            {printMode === "month" ? (
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                aria-label="Select month to print"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            ) : (
              <input
                type="number"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                placeholder="YYYY"
                min="2020"
                max="2099"
                aria-label="Select year to print"
                className="w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            )}

            <button
              onClick={handlePrintBatch}
              className="flex items-center justify-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-900"
            >
              <Printer size={13} />
              Print
            </button>
          </div>
          ) : <div />}

          {/* Right: Search + Status Filter + Delete All */ }
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <p className="mr-1 whitespace-nowrap text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{filteredBookings.length}</span>{" "}
              {filteredBookings.length === 1 ? "record" : "records"}
            </p>
            {/* Search */ }
            <label className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                placeholder={
                  listMode === "removed"
                    ? "Search removed bookings..."
                    : "Search booking, requestor, resource..."
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search booking history"
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            {/* Status Filter */ }
            {listMode === "history" && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter booking history by status"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="all">All History</option>
                <option value="completed">Completed</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            )}

            {/* Delete All */ }
            {listMode === "history" && canDelete && filteredBookings.length > 0 && (
              <button
                onClick={handleDeleteAll}
                className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
              >
                <Trash2 size={13} /> Delete All ({filteredBookings.length})
              </button>
            )}
          </div>
        </div>

        {/* Modern Data Table */ }
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          {loading ? (
            <div className="animate-pulse">
              {/* Table skeleton — header + rows */ }
              <div className="border-b border-slate-200/80 bg-gray-50 px-4 py-3.5 flex items-center gap-4">
                <Skeleton className="h-3 w-8 bg-gray-200 rounded" />
                <Skeleton className="h-3 w-16 bg-gray-200 rounded" />
                <Skeleton className="h-3 w-20 bg-gray-200 rounded" />
                <Skeleton className="h-3 w-16 bg-gray-200 rounded" />
                <Skeleton className="h-3 w-12 bg-gray-200 rounded" />
              </div>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={`skeleton-row-${i}`} className="border-b border-slate-200/80 px-4 py-4 flex items-center gap-4">
                  <Skeleton className="h-3 w-12 bg-gray-200 rounded" />
                  <Skeleton className="h-3 w-24 bg-gray-200 rounded" />
                  <Skeleton className="h-3 w-28 bg-gray-200 rounded" />
                  <Skeleton className="h-3 w-20 bg-gray-200 rounded" />
                  <Skeleton className="h-5 w-16 bg-gray-200 rounded-full" />
                </div>
              ))}
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="py-16 text-center">
              <FileText size={32} className="mx-auto mb-3 text-gray-300" />

              <p className="text-[14px] font-medium text-gray-600">
                {listMode === "removed"
                  ? "No removed bookings found"
                  : "No booking history found"}
              </p>

              <p className="mt-1 text-[12px] text-steel">
                {listMode === "removed"
                  ? "Bookings removed by an administrator or approved removal request will appear here."
                  : "Completed, rejected, and cancelled bookings will appear here."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto whitespace-nowrap">
              <table className="w-full min-w-[850px]">
                <thead>
                  <tr>
                    <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200/80 bg-slate-50/80">
                      ID
                    </th>

                    <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200/80 bg-slate-50/80">
                      Requestor
                    </th>

                    <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200/80 bg-slate-50/80">
                      Resource
                    </th>

                    <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200/80 bg-slate-50/80">
                      Date
                    </th>

                    <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200/80 bg-slate-50/80">
                      Status
                    </th>

                    <th className="px-4 py-3.5 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200/80 bg-slate-50/80">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredBookings.map((booking) => {
                    const bookingId = booking.id || booking.booking_id;

                    const requester =
                      typeof booking.full_name === "string"
                        ? booking.full_name
                        : typeof booking.requester === "string"
                          ? booking.requester
                          : typeof booking.user_name === "string"
                            ? booking.user_name
                            : booking.user?.full_name || "Unknown";

                    const resource =
                      typeof booking.resource === "object"
                        ? booking.resource?.name ||
                          booking.resource?.resource_name ||
                          booking.resource_name ||
                          booking.item_name ||
                          "Resource"
                        : booking.resource ||
                          booking.resource_name ||
                          booking.item_name ||
                          "Resource";

                    const resourceImage = getResourceImage(booking, resources);

                    const status = (booking.status || "").toLowerCase();

                    const statusBadgeClass =
                      status === "approved"
                        ? "bg-blue-50 text-blue-700 border border-blue-200/60"
                        : status === "rejected"
                          ? "bg-rose-50 text-rose-700 border border-rose-200/60"
                          : status === "completed"
                            ? "bg-blue-50 text-blue-700 border border-blue-200/60"
                            : status === "cancelled"
                              ? "bg-slate-50 text-slate-700 border border-slate-200/60"
                              : "bg-amber-50 text-amber-800 border border-amber-200/60";

                    return (
                      <tr
                        key={bookingId}
                        className="hover:bg-slate-50/60 transition-colors border-b border-slate-100 text-xs text-slate-700"
                      >
                        <td className="px-4 py-4 font-medium text-slate-800">
                          #{bookingId}
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <User size={13} className="text-slate-400" />
                            <span>{requester}</span>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            {resourceImage ? (
                              <img
                                src={resourceImage}
                                alt={resource}
                                className="h-8 w-8 rounded object-cover"
                              />
                            ) : (
                              <ImageIcon size={16} className="text-slate-400" />
                            )}
                            <span>{resource}</span>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <Calendar size={13} className="text-slate-400" />
                            <span>{getDateValue(booking)}</span>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          {listMode === "removed" ? (
                            <div className="flex flex-col items-start gap-1">
                              <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-medium text-rose-700">
                                REMOVED
                              </span>
                              <span className="text-[10px] text-slate-500">
                                Previously {(booking.status || "unknown").toUpperCase()}
                              </span>
                            </div>
                          ) : (
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-medium ${statusBadgeClass}`}>
                              {(booking.status || "unknown").toUpperCase()}
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                console.log("Selected Booking Data:", booking);
                                setSelectedBooking(booking);
                              }}
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                              title="View"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => handlePrint(booking)}
                              className="p-1.5 text-slate-600 hover:text-brand hover:bg-brand/10 rounded-md transition-colors"
                              title="Print"
                            >
                              <Printer size={14} />
                            </button>
                            {listMode === "removed" && canRestore ? (
                              <button
                                onClick={() => handleRestore(bookingId)}
                                className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-md transition-colors"
                                title="Restore booking"
                              >
                                <RotateCcw size={14} />
                              </button>
                            ) : listMode === "history" && canDelete ? (
                              <button
                                onClick={() => handleDelete(bookingId)}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Details Modal */}
      {selectedBooking && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/40 p-4"
          onClick={() => setSelectedBooking(null)}>
          <div
            className="w-full max-w-lg rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}>
            {/* Resource Image Banner Header */ }
            <div className="relative w-full h-44 rounded-t-xl overflow-hidden bg-slate-100 mb-4">
              {selectedBooking.resource?.image_url ? (
                <img
                  src={selectedBooking.resource?.image_url}
                  alt={selectedBooking.resource?.name || "Resource"}
                  className="w-full h-full object-cover"
                />
              ) : getResourceImage(selectedBooking, resources) ? (
                <img
                  src={getResourceImage(selectedBooking, resources)}
                  alt={selectedBooking.resource || "Resource"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="bg-slate-100 flex flex-col items-center justify-center text-slate-400 gap-1.5 h-full">
                  <ImageIcon size={32} strokeWidth={1.5} />
                  <span className="text-xs">No image provided</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <h2 className="text-[16px] font-semibold">Booking Details</h2>

                <p className="text-[12px] text-steel">
                  Booking #{selectedBooking.id || selectedBooking.booking_id}
                </p>
                <p className="text-[11px] text-steel">
                  Ref: {selectedBooking.reference_id || `#${selectedBooking.id || selectedBooking.booking_id}`}
                </p>
              </div>

              <button
                onClick={() => setSelectedBooking(null)}
                className="text-gray-400 hover:text-gray-700">
                ×
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-steel">
                  Requestor
                </p>

                <p className="mt-1 text-[14px] font-medium">
                  {selectedBooking.full_name ||
                    selectedBooking.requester ||
                    selectedBooking.user?.full_name ||
                    "Unknown"}
                </p>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wide text-steel">
                  Resource
                </p>

                <div className="mt-1 flex items-center gap-3">
                  {selectedBooking.resource?.image_url || getResourceImage(selectedBooking, resources) ? (
                    <img
                      src={selectedBooking.resource?.image_url || getResourceImage(selectedBooking, resources)}
                      alt={selectedBooking.resource?.name || "Resource"}
                      className="w-8 h-8 rounded-md object-cover border border-slate-200"
                    />
                  ) : (
                    <ImageIcon size={20} className="text-slate-400" />
                  )}
                  <p className="text-[14px] font-medium">
                    {selectedBooking.resource ||
                      selectedBooking.resource_name ||
                      selectedBooking.item_name ||
                      "Resource"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-steel">
                    Date
                  </p>

                  <p className="mt-1 flex items-center gap-2 text-[13px]">
                    <Calendar size={14} />
                    {getDateValue(selectedBooking)}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-wide text-steel">
                    Time
                  </p>

                  <p className="mt-1 flex items-center gap-2 text-[13px]">
                    <Clock size={14} />
                    {getTimeValue(selectedBooking)}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wide text-steel">
                  Purpose
                </p>

                <p className="mt-1 text-[13px]">
                  {selectedBooking.purpose || "No purpose provided"}
                </p>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wide text-steel">
                  Email
                </p>
                <p className="mt-1 text-[13px]">
                  {selectedBooking.email ||
                    selectedBooking.user?.email ||
                    selectedBooking.requester_email ||
                    "N/A"}
                </p>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wide text-steel">
                  Status
                </p>

                <div className="mt-1">
                  <StatusBadge status={selectedBooking.status} />
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center border-t border-line px-5 py-4">
              {listMode === "removed" && canRestore ? (
                <button
                  onClick={() =>
                    handleRestore(selectedBooking.id || selectedBooking.booking_id)
                  }
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-200 px-4 py-2 text-[13px] font-medium text-emerald-700 hover:bg-emerald-50"
                >
                  <RotateCcw size={15} />
                  Restore Booking
                </button>
              ) : listMode === "history" && canDelete ? (
                <button
                  onClick={() =>
                    handleDelete(selectedBooking.id || selectedBooking.booking_id)
                  }
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-[13px] font-medium text-red-600 hover:bg-red-50">
                  <Trash2 size={15} />
                  Delete Booking
                </button>
              ) : null}
              <div className={`flex gap-2 ${
                (listMode === "removed" && canRestore) ||
                (listMode === "history" && canDelete)
                  ? ""
                  : "w-full justify-end"
              }`}>
                <button
                  onClick={() => setSelectedBooking(null)}
                  className="rounded-lg border border-line px-4 py-2 text-[13px] font-medium hover:bg-gray-50">
                  Close
                </button>

                <button
                  onClick={() => handlePrint(selectedBooking)}
                  className="flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-[13px] font-medium text-white hover:bg-gray-900">
                  <Printer size={15} />
                  Print
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
