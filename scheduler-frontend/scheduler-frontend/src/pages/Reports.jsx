import { useState } from "react";
import {
  Building2,
  CalendarDays,
  CarFront,
  Download,
  FileText,
  Info,
  Layers3,
  Printer,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import * as api from "../api/endpoints";
import { useCachedData } from "../hooks/useCachedData";
import ReportDropdown from "../components/ReportDropdown";
import "./Reports.css";

const REPORT_ROLES = ["admin", "barangay_admin", "staff"];
const PERIOD_GROUPS = [
  {
    label: "Quick ranges",
    options: [
      { value: "week", label: "This Week", icon: CalendarDays },
      { value: "month", label: "This Month", icon: CalendarDays },
      { value: "year", label: "This Year", icon: CalendarDays },
    ],
  },
  {
    label: "Date range",
    options: [
      {
        value: "custom",
        label: "Custom Date Range",
        detail: "Choose your own start and end dates",
        icon: CalendarDays,
      },
    ],
  },
];

function formatCurrency(value) {
  if (value == null || value === "" || !Number.isFinite(Number(value))) {
    return "For assessment";
  }
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(Number(value));
}

function formatReportAmount(value, isComplete) {
  if (isComplete) return formatCurrency(value);
  return Number(value) > 0
    ? `${formatCurrency(value)} (partial)`
    : "For assessment";
}

function formatDate(value) {
  if (!value) return "—";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(year, month - 1, day));
}

function formatTime(value) {
  if (!value) return "";
  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value;
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? "PM" : "AM"}`;
}

function formatPeriod(value) {
  if (!value) return "—";
  const start = formatDate(value.start_date);
  const end = formatDate(value.end_date);
  return start === end ? start : `${start} – ${end}`;
}

function csvCell(value) {
  const text = String(value ?? "");
  const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

export default function Reports() {
  const { user } = useAuth();
  const { data: resources, loading: resourcesLoading } = useCachedData(
    "resources",
    api.fetchResources,
  );
  const [resourceSelection, setResourceSelection] = useState("all");
  const [period, setPeriod] = useState("month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canAccessReports = REPORT_ROLES.includes(user?.role);
  const customRangeValid =
    period !== "custom" ||
    (startDate && endDate && startDate <= endDate);
  const facilities = (resources || []).filter(
    (resource) => resource.type?.toLowerCase() === "facility",
  );
  const vehicles = (resources || []).filter(
    (resource) => resource.type?.toLowerCase() === "vehicle",
  );
  const resourceGroups = [
    {
      label: "Report scope",
      options: [
        {
          value: "all",
          label: "All Resources",
          detail: "Facilities and utility vehicles",
          icon: Layers3,
        },
        {
          value: "vehicles",
          label: "All Utility Vehicles",
          detail: "Municipal vehicle fleet only",
          icon: CarFront,
        },
      ],
    },
    ...(facilities.length
      ? [
          {
            label: "Facilities",
            count: facilities.length,
            options: facilities.map((resource) => ({
              value: `resource:${resource.resource_id}`,
              label: resource.name,
              detail: "Facility",
              icon: Building2,
            })),
          },
        ]
      : []),
    ...(vehicles.length
      ? [
          {
            label: "Utility Vehicles",
            count: vehicles.length,
            options: vehicles.map((resource) => ({
              value: `resource:${resource.resource_id}`,
              label: resource.name,
              detail: "Utility vehicle",
              icon: CarFront,
            })),
          },
        ]
      : []),
  ];

  const generateReport = async (event) => {
    event.preventDefault();
    if (!canAccessReports || !customRangeValid) return;

    setLoading(true);
    setError("");
    try {
      const params = { period };
      if (resourceSelection === "vehicles") {
        params.resource_type = "vehicle";
      } else if (resourceSelection.startsWith("resource:")) {
        params.resource_id = resourceSelection.slice("resource:".length);
      } else {
        params.resource_type = "all";
      }
      if (period === "custom") {
        params.start_date = startDate;
        params.end_date = endDate;
      }

      const response = await api.fetchResourceReport(params);
      setReport(response?.data || null);
    } catch (requestError) {
      const validationMessage = Object.values(
        requestError?.response?.data?.errors || {},
      )
        .flat()
        .find(Boolean);
      setError(
        validationMessage ||
          requestError?.response?.data?.message ||
          "Unable to generate the report. Please try again.",
      );
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  const downloadCsv = () => {
    if (!report) return;

    const summaryRows = [
      ["Municipality of Jabonga", "Agusan del Norte"],
      ["Resource Utilization and Booking Report"],
      ["Resource", report.meta.resource.name],
      ["Period", report.meta.period_label],
      ["Date range", formatPeriod(report.meta)],
      ["Generated", report.meta.generated_at],
      [],
      ["Summary", "Value"],
      ["Total requests", report.summary.total_bookings],
      ["Resource assignments", report.summary.resource_assignments],
      ["Approved bookings", report.summary.approved_bookings],
      ["Completed bookings", report.summary.completed_bookings],
      ["Pending bookings", report.summary.pending_bookings],
      ["Rejected bookings", report.summary.rejected_bookings],
      ["Cancelled/removed bookings", report.summary.cancelled_bookings],
      ["Approved usage days", report.summary.total_usage_days],
      ["Approved usage hours", report.summary.total_usage_hours],
      [
        "Estimated/assessed amount",
        report.summary.amount_is_complete
          ? report.summary.estimated_assessed_amount
          : formatReportAmount(
              report.summary.estimated_assessed_amount,
              false,
            ),
      ],
      ["Payment tracking", "Not configured"],
      [],
      [
        "Booking No.",
        "Requester",
        "Resource(s)",
        "Rate(s)",
        "Start Date",
        "End Date",
        "Start Time",
        "End Time",
        "Purpose",
        "Status",
        "Estimated/Assessed Amount",
      ],
      ...report.bookings.map((booking) => [
        booking.booking_number,
        booking.requester,
        booking.resource_names.join("; "),
        booking.resource_assignments
          .map(
            (assignment) =>
              `${assignment.rate == null ? "For assessment" : formatCurrency(assignment.rate)} / ${assignment.rate_unit} × ${assignment.billable_units} ${assignment.billable_unit_label}`,
          )
          .join("; "),
        booking.start_date,
        booking.end_date,
        booking.start_time || "All day",
        booking.end_time || "",
        booking.purpose,
        booking.status_label,
        booking.amount_status === "not_included"
          ? "Not included"
          : booking.estimated_amount == null
            ? "For assessment"
            : booking.amount_status === "partial"
              ? `Partial: ${booking.estimated_amount}`
              : booking.estimated_amount,
      ]),
    ];

    const csv = summaryRows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "resource-booking-report.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!canAccessReports) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
          You are not authorized to view resource reports.
        </div>
      </div>
    );
  }

  const summary = report?.summary;
  const amountText = summary
    ? formatReportAmount(
        summary.estimated_assessed_amount,
        summary.amount_is_complete,
      )
    : "—";
  const chartMax = Math.max(
    1,
    ...(report?.breakdown || []).map((bucket) => bucket.total_bookings),
  );
  const stats = report
    ? [
        { label: "Total Requests", value: summary.total_bookings },
        { label: "Approved", value: summary.approved_bookings },
        { label: "Completed", value: summary.completed_bookings },
        { label: "Pending", value: summary.pending_bookings },
        { label: "Rejected", value: summary.rejected_bookings },
        { label: "Cancelled / Removed", value: summary.cancelled_bookings },
        { label: "Resource Assignments", value: summary.resource_assignments },
        {
          label: "Approved Usage",
          value: `${summary.total_usage_days} days · ${summary.total_usage_hours == null ? "hours not recorded" : `${summary.total_usage_hours} hours`}`,
        },
        {
          label: "Average Duration",
          value: `${summary.average_duration_days == null ? "—" : `${summary.average_duration_days} days`} · ${summary.average_duration_hours == null ? "hours not recorded" : `${summary.average_duration_hours} hours`}`,
        },
        { label: "Estimated / Assessed Amount", value: amountText },
      ]
    : [];

  return (
    <main className="resource-reports-page mx-auto w-full max-w-[1680px] p-4 md:p-6">
      <form
        onSubmit={generateReport}
        className="no-print relative z-20 mb-6 overflow-visible rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/[0.03] sm:p-5 lg:p-6"
      >
        <div className="mb-5 flex flex-col gap-1 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Configure your report
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Select a resource and reporting period to get started.
            </p>
          </div>
          <span className="hidden items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500 sm:inline-flex">
            <CalendarDays size={13} />
            Dates use the booking start date
          </span>
        </div>

        <div
          className={`grid gap-4 ${
            period === "custom"
              ? "md:grid-cols-2 xl:grid-cols-4"
              : "md:grid-cols-2"
          }`}
        >
          <ReportDropdown
            label="Resource"
            value={resourceSelection}
            onChange={setResourceSelection}
            groups={resourceGroups}
            searchable
            searchPlaceholder="Search facilities or vehicles"
            disabled={resourcesLoading}
          />
          <ReportDropdown
            label="Period"
            value={period}
            onChange={setPeriod}
            groups={PERIOD_GROUPS}
          />

          {period === "custom" && (
            <>
              <label className="block min-w-0 text-sm font-semibold text-slate-700">
                Start date
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="mt-1.5 min-h-[50px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>
              <label className="block min-w-0 text-sm font-semibold text-slate-700">
                End date
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="mt-1.5 min-h-[50px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>
            </>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-4 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex max-w-3xl items-start gap-2.5 text-xs leading-relaxed text-slate-500">
            <Info
              size={16}
              className="mt-0.5 shrink-0 text-blue-600"
              aria-hidden="true"
            />
            <p>
              Multi-vehicle requests count once as a booking, with one
              assignment per vehicle. Staff reports are limited to their own
              bookings.
            </p>
          </div>
          <button
            type="submit"
            disabled={loading || resourcesLoading || !customRangeValid}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-900/10 transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileText size={16} />
            {loading ? "Generating..." : "Generate Report"}
          </button>
        </div>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700"
          >
            {error}
          </p>
        )}
      </form>

      {!report && !loading && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-50/70 via-white to-white px-5 py-10 text-center sm:flex-row sm:text-left">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm ring-1 ring-slate-200">
            <FileText size={22} />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800">
              Your report will appear here
            </h2>
            <p className="mt-1 max-w-xl text-sm text-slate-500">
              Choose a resource and period above, then generate a report to see
              booking totals, utilization, and estimated amounts.
            </p>
          </div>
        </div>
      )}

      {loading && (
        <div
          role="status"
          className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-12 text-sm font-medium text-slate-500 shadow-sm"
        >
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-100 border-t-blue-700" />
          Generating your report…
        </div>
      )}

      {report && (
        <section
          id="resource-report-print"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6"
        >
          <header className="mb-6 border-b border-slate-200 pb-4 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-700">
              Municipality of Jabonga
            </p>
            <p className="text-xs text-slate-500">Agusan del Norte</p>
            <p className="mt-2 text-xs text-slate-500">
              Scheduling System for Facility and Utility Vehicle Coordination
            </p>
            <h2 className="mt-3 text-lg font-bold uppercase tracking-wide text-slate-900">
              Resource Utilization and Booking Report
            </h2>
            <p className="mt-2 text-sm font-semibold text-slate-800">
              {report.meta.resource.name}
            </p>
            <p className="text-xs text-slate-600">
              {report.meta.period_label} · {formatPeriod(report.meta)}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Generated{" "}
              {new Intl.DateTimeFormat("en-PH", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Asia/Manila",
              }).format(new Date(report.meta.generated_at))}
            </p>
          </header>

          <div className="no-print mb-5 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={downloadCsv}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download size={15} />
              Download CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900"
            >
              <Printer size={15} />
              Print / Save as PDF
            </button>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <p className="text-[11px] font-medium text-slate-500">
                  {stat.label}
                </p>
                <p className="mt-1 break-words text-base font-bold text-slate-900">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {!summary.amount_is_complete && (
            <p className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {summary.unassessed_successful_assignments} approved/completed
              resource assignment
              {summary.unassessed_successful_assignments === 1 ? "" : "s"}{" "}
              require
              {summary.unassessed_successful_assignments === 1 ? "s" : ""}{" "}
              assessment because rate or billable-unit data is unavailable.
            </p>
          )}
          <p className="mb-5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Payment tracking is not configured. This report does not represent
            amounts collected or balances due.
          </p>

          {report.summary.most_common_purpose && (
            <p className="mb-5 text-xs text-slate-600">
              Most common purpose:{" "}
              <span className="font-semibold text-slate-800">
                {report.summary.most_common_purpose.purpose}
              </span>{" "}
              ({report.summary.most_common_purpose.count})
            </p>
          )}

          <div className="mb-7">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">
              {report.meta.grouping === "day"
                ? "Daily"
                : report.meta.grouping === "week"
                  ? "Weekly"
                  : "Monthly"}{" "}
              Booking Breakdown
            </h3>
            {report.breakdown.length > 0 ? (
              <>
                <div className="no-print mb-4 flex h-36 items-end gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 px-3 pt-3">
                  {report.breakdown.map((bucket) => (
                    <div
                      key={bucket.key}
                      className="flex h-full min-w-8 flex-1 flex-col items-center justify-end gap-1"
                      title={`${bucket.label}: ${bucket.total_bookings} bookings`}
                    >
                      <span className="text-[9px] text-slate-500">
                        {bucket.total_bookings || ""}
                      </span>
                      <div
                        className="w-full max-w-10 rounded-t bg-blue-600"
                        style={{
                          height: `${bucket.total_bookings === 0 ? 2 : Math.max(8, (bucket.total_bookings / chartMax) * 100)}%`,
                        }}
                      />
                      <span className="max-w-full truncate text-[9px] text-slate-500">
                        {bucket.label}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Period</th>
                        <th className="px-3 py-2 font-semibold">Bookings</th>
                        <th className="px-3 py-2 font-semibold">Approved</th>
                        <th className="px-3 py-2 font-semibold">Completed</th>
                        <th className="px-3 py-2 font-semibold">Pending</th>
                        <th className="px-3 py-2 font-semibold">Rejected</th>
                        <th className="px-3 py-2 font-semibold">Cancelled</th>
                        <th className="px-3 py-2 font-semibold">Assignments</th>
                        <th className="px-3 py-2 font-semibold">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.breakdown.map((bucket) => (
                        <tr key={bucket.key}>
                          <td className="whitespace-nowrap px-3 py-2">
                            {bucket.label}
                          </td>
                          <td className="px-3 py-2">{bucket.total_bookings}</td>
                          <td className="px-3 py-2">{bucket.approved_bookings}</td>
                          <td className="px-3 py-2">{bucket.completed_bookings}</td>
                          <td className="px-3 py-2">{bucket.pending_bookings}</td>
                          <td className="px-3 py-2">{bucket.rejected_bookings}</td>
                          <td className="px-3 py-2">{bucket.cancelled_bookings}</td>
                          <td className="px-3 py-2">{bucket.resource_assignments}</td>
                          <td className="whitespace-nowrap px-3 py-2">
                            {formatReportAmount(
                              bucket.estimated_assessed_amount,
                              bucket.amount_is_complete,
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                No bookings found for this period.
              </p>
            )}
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">
              Booking Details
            </h3>
            {report.bookings.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                No bookings found for the selected resource and period.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="resource-report-table min-w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Booking No.</th>
                      <th className="px-3 py-2 font-semibold">Requester</th>
                      <th className="px-3 py-2 font-semibold">Resource(s)</th>
                      <th className="px-3 py-2 font-semibold">Date</th>
                      <th className="px-3 py-2 font-semibold">Time</th>
                      <th className="px-3 py-2 font-semibold">Purpose</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      <th className="px-3 py-2 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.bookings.map((booking) => (
                      <tr key={booking.booking_id} className="align-top">
                        <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-800">
                          {booking.booking_number}
                        </td>
                        <td className="px-3 py-2">{booking.requester}</td>
                        <td className="min-w-40 px-3 py-2">
                          <div className="font-medium text-slate-800">
                            {booking.resource_assignments
                              .map((assignment) => assignment.name)
                              .join(", ")}
                          </div>
                          <div className="mt-1 space-y-0.5 text-[10px] text-slate-500">
                            {booking.resource_assignments.map((assignment) => (
                              <p key={assignment.resource_id}>
                                {assignment.rate == null
                                  ? `Rate not set · ${assignment.billable_units} ${assignment.billable_unit_label}`
                                  : `${formatCurrency(assignment.rate)} / ${assignment.rate_unit} × ${assignment.billable_units} ${assignment.billable_unit_label}`}
                              </p>
                            ))}
                          </div>
                        </td>
                        <td className="min-w-36 whitespace-nowrap px-3 py-2">
                          {formatDate(booking.start_date)}
                          {booking.end_date !== booking.start_date && (
                            <>
                              <br />
                              to {formatDate(booking.end_date)}
                            </>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {booking.start_time || booking.end_time
                            ? `${formatTime(booking.start_time) || "12:00 AM"} – ${formatTime(booking.end_time) || "End of day"}`
                            : "All day"}
                        </td>
                        <td className="max-w-56 px-3 py-2">{booking.purpose}</td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {booking.status_label}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-medium">
                          {booking.amount_status === "not_included"
                            ? "Not included"
                            : booking.amount_status === "for_assessment"
                              ? "For assessment"
                              : `${booking.amount_status === "partial" ? "Partial: " : ""}${formatCurrency(booking.estimated_amount)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
