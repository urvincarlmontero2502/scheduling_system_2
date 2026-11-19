import { ClipboardX, FileCheck } from "lucide-react";
import { useTabUrlSync } from "../hooks/useTabUrlSync";
import RegistrationRequests from "./RegistrationRequests";
import BookingRemovalRequests from "./BookingRemovalRequests";

const REQUEST_SECTIONS = [
  { value: "registration", label: "Registration Requests", icon: FileCheck },
  { value: "removal", label: "Booking Removal Requests", icon: ClipboardX },
];

export default function Requests() {
  const [section, setSection] = useTabUrlSync("section", "registration");
  const activeSection = REQUEST_SECTIONS.some((item) => item.value === section)
    ? section
    : "registration";

  return (
    <div className="mx-auto max-w-7xl">
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
