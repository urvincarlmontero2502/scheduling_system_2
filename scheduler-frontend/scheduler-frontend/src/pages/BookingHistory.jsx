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
} from "lucide-react";
import * as api from "../api/endpoints";
import StatusBadge from "../components/StatusBadge";

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

function getDateValue(booking) {
  const startDate = booking.start_date || booking.date;
  const endDate = booking.end_date || booking.date;

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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedBooking, setSelectedBooking] = useState(null);

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
      .catch(() => {});
  }, []);

  const historyBookings = bookings.filter((booking) => {
    const status = (booking.status || "").toLowerCase();

    return (
      status === "completed" || status === "rejected" || status === "cancelled"
    );
  });

  const filteredBookings = historyBookings.filter((booking) => {
    const status = (booking.status || "").toLowerCase();

    const resource =
      booking.resource || booking.resource_name || booking.item_name || "";

    const requester =
      booking.full_name ||
      booking.requester ||
      booking.user_name ||
      booking.user?.full_name ||
      "";

    const searchText = `${resource} ${requester} ${
      booking.purpose || ""
    } ${booking.id || booking.booking_id || ""}`.toLowerCase();

    const matchesSearch = searchText.includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  async function handleDelete(bookingId) {
    if (
      !window.confirm(`Are you sure you want to delete booking #${bookingId}?`)
    ) {
      return;
    }

    try {
      await api.deleteBooking(bookingId);
      setBookings((prev) =>
        prev.filter((b) => (b.id || b.booking_id) !== bookingId),
      );
      if (
        selectedBooking &&
        (selectedBooking.id || selectedBooking.booking_id) === bookingId
      ) {
        setSelectedBooking(null);
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete booking.");
    }
  }

  function handlePrint(booking) {
    const bookingId = booking.id || booking.booking_id;
    const resource =
      booking.resource ||
      booking.resource_name ||
      booking.item_name ||
      "Resource";
    const requester =
      booking.full_name ||
      booking.requester ||
      booking.user_name ||
      booking.user?.full_name ||
      "Unknown Requestor";
    const barangay = booking.barangay || booking.user?.barangay || "Poblacion";
    const cellNumber =
      booking.cell_number || booking.contact || booking.phone || "N/A";
    const address =
      booking.where_do_you_live || booking.address || booking.location || "N/A";
    const purpose =
      booking.purpose ||
      booking.reason ||
      booking.description ||
      "No purpose provided";

    const date = getDateValue(booking);
    const time = getTimeValue(booking);
    const status = (booking.status || "unknown").toUpperCase();

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
          </div>
          <div class="section">
            <div class="section-title">REQUESTOR INFORMATION</div>
            <table>
              <tr><td>Full Name</td><td>${requester}</td></tr>
              <tr><td>Barangay</td><td>${barangay}</td></tr>
              <tr><td>Cell Number</td><td>${cellNumber}</td></tr>
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
      {/* Header */}
      <header className="border-b border-line bg-white px-6 py-4">
        <h1 className="text-[17px] font-semibold">Booking History</h1>

        <p className="text-[13px] text-steel">
          View previous facility and utility vehicle reservation records
        </p>
      </header>

      <div className="px-6 py-6 space-y-6">
        {/* Batch Print Controls Bar */}
        <div className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[13px] font-medium text-gray-700">
              Batch Print:
            </span>
            <select
              value={printMode}
              onChange={(e) => setPrintMode(e.target.value)}
              className="rounded-lg border border-line bg-white px-3 py-2 text-[13px] outline-none">
              <option value="month">By Month</option>
              <option value="year">By Year</option>
            </select>

            {printMode === "month" ? (
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded-lg border border-line bg-white px-3 py-2 text-[13px] outline-none"
              />
            ) : (
              <input
                type="number"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                placeholder="YYYY"
                min="2020"
                max="2099"
                className="w-28 rounded-lg border border-line bg-white px-3 py-2 text-[13px] outline-none"
              />
            )}
          </div>

          <button
            onClick={handlePrintBatch}
            className="flex items-center justify-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-[13px] font-medium text-white hover:bg-gray-950">
            <Printer size={15} />
            Print Selected Period
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type="text"
              placeholder="Search booking, requestor, resource..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-line bg-white py-2.5 pl-9 pr-3 text-[13px] outline-none focus:border-brand"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-line bg-white px-3 py-2.5 text-[13px] outline-none">
            <option value="all">All History</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* History Table */}
        <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
          {filteredBookings.length === 0 ? (
            <div className="py-16 text-center">
              <FileText size={32} className="mx-auto mb-3 text-gray-300" />

              <p className="text-[14px] font-medium text-gray-600">
                No booking history found
              </p>

              <p className="mt-1 text-[12px] text-steel">
                Completed, rejected, and cancelled bookings will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px]">
                <thead className="border-b border-line bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-[12px] font-semibold text-steel">
                      ID
                    </th>

                    <th className="px-4 py-3 text-left text-[12px] font-semibold text-steel">
                      Requestor
                    </th>

                    <th className="px-4 py-3 text-left text-[12px] font-semibold text-steel">
                      Resource
                    </th>

                    <th className="px-4 py-3 text-left text-[12px] font-semibold text-steel">
                      Date
                    </th>

                    <th className="px-4 py-3 text-left text-[12px] font-semibold text-steel">
                      Status
                    </th>

                    <th className="px-4 py-3 text-right text-[12px] font-semibold text-steel">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-line">
                  {filteredBookings.map((booking) => {
                    const bookingId = booking.id || booking.booking_id;

                    const requester =
                      booking.full_name ||
                      booking.requester ||
                      booking.user_name ||
                      booking.user?.full_name ||
                      "Unknown";

                    const resource =
                      booking.resource ||
                      booking.resource_name ||
                      booking.item_name ||
                      "Resource";

                    return (
                      <tr key={bookingId} className="hover:bg-gray-50">
                        <td className="px-4 py-4 text-[13px] font-medium">
                          #{bookingId}
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <User size={15} className="text-gray-400" />

                            <span className="text-[13px]">{requester}</span>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <Building2 size={15} className="text-gray-400" />

                            <span className="text-[13px]">{resource}</span>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <Calendar size={15} className="text-gray-400" />

                            <span className="text-[13px]">
                              {getDateValue(booking)}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <StatusBadge status={booking.status} />
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setSelectedBooking(booking)}
                              className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[12px] font-medium text-steel hover:bg-gray-50">
                              <Eye size={14} />
                              View
                            </button>

                            <button
                              onClick={() => handlePrint(booking)}
                              className="flex items-center gap-1.5 rounded-lg bg-gray-800 px-3 py-2 text-[12px] font-medium text-white hover:bg-gray-900">
                              <Printer size={14} />
                              Print
                            </button>

                            <button
                              onClick={() => handleDelete(bookingId)}
                              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-[12px] font-medium text-red-600 hover:bg-red-50">
                              <Trash2 size={14} />
                              Delete
                            </button>
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelectedBooking(null)}>
          <div
            className="w-full max-w-lg rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <h2 className="text-[16px] font-semibold">Booking Details</h2>

                <p className="text-[12px] text-steel">
                  Booking #{selectedBooking.id || selectedBooking.booking_id}
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

                <p className="mt-1 text-[14px] font-medium">
                  {selectedBooking.resource ||
                    selectedBooking.resource_name ||
                    selectedBooking.item_name ||
                    "Resource"}
                </p>
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
                  Status
                </p>

                <div className="mt-1">
                  <StatusBadge status={selectedBooking.status} />
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center border-t border-line px-5 py-4">
              <button
                onClick={() =>
                  handleDelete(selectedBooking.id || selectedBooking.booking_id)
                }
                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-[13px] font-medium text-red-600 hover:bg-red-50">
                <Trash2 size={15} />
                Delete Booking
              </button>

              <div className="flex gap-2">
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
