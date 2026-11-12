import { ClipboardX, FileCheck, Inbox } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTabUrlSync } from "../hooks/useTabUrlSync";
import RegistrationRequests from "./RegistrationRequests";
import BookingRemovalRequests from "./BookingRemovalRequests";

const REQUEST_SECTIONS = [
  { value: "registration", label: "Registration Requests", icon: FileCheck },
  { value: "removal", label: "Booking Removal Requests", icon: ClipboardX },
];

export default function Requests() {
  const { user } = useAuth();
  const [section, setSection] = useTabUrlSync("section", "registration");
  const activeSection = REQUEST_SECTIONS.some((item) => item.value === section)
    ? section
    : "registration";
  const activeSectionInfo = REQUEST_SECTIONS.find((item) => item.value === activeSection);

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            <Inbox size={14} />
            Request center
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Review requests
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage account registrations and booking removal requests
            {user?.role === "barangay_admin" && user?.barangay
              ? ` for ${user.barangay}`
              : ""}
            .
          </p>
        </div>
        <div className="text-sm text-slate-500">
          Viewing{" "}
          <span className="font-semibold text-slate-700">
            {activeSectionInfo?.label}
          </span>
        </div>
      </header>

      <div
        role="tablist"
        aria-label="Request type"
        className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {REQUEST_SECTIONS.map(({ value, label, icon: Icon }, index) => (
          <button
            key={value}
            id={`requests-tab-${value}`}
            type="button"
            role="tab"
            aria-selected={activeSection === value}
            aria-controls={`requests-panel-${value}`}
            onClick={() => setSection(value)}
            className={`group flex min-h-[76px] items-center gap-3 rounded-xl border p-4 text-left transition-all ${
              activeSection === value
                ? "border-blue-200 bg-white shadow-sm ring-2 ring-blue-100"
                : "border-slate-200 bg-white/70 hover:border-slate-300 hover:bg-white"
            }`}
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                activeSection === value
                  ? "bg-blue-100 text-blue-700"
                  : "bg-slate-100 text-slate-500 group-hover:text-slate-700"
              }`}
            >
              <Icon size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-800">
                {label}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {index === 0
                  ? "Review new user account applications"
                  : "Review staff requests to remove bookings"}
              </span>
            </span>
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                activeSection === value ? "bg-blue-600" : "bg-slate-300"
              }`}
            />
          </button>
        ))}
      </div>

      <div
        id={`requests-panel-${activeSection}`}
        role="tabpanel"
        aria-labelledby={`requests-tab-${activeSection}`}
        className="min-h-72"
      >
        {activeSection === "registration" ? (
          <RegistrationRequests embedded />
        ) : (
          <BookingRemovalRequests embedded />
        )}
      </div>
    </div>
  );
}
