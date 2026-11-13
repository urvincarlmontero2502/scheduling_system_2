import { Link } from "react-router-dom";
import {
  ArrowRight,
  BellRing,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  LifeBuoy,
  MessageSquareText,
  ShieldCheck,
  Truck,
} from "lucide-react";

const features = [
  {
    icon: Building2,
    title: "Municipal Venue Approvals",
    description:
      "Coordinate facility reservations through a clear request and approval process.",
  },
  {
    icon: Truck,
    title: "Fleet & Equipment Dispatch",
    description:
      "Plan municipal vehicle and equipment schedules in one shared calendar.",
  },
  {
    icon: ClipboardCheck,
    title: "Inter-Barangay Coordination",
    description:
      "Help municipal and barangay teams keep official schedules aligned.",
  },
];

function InfoCard({ icon: Icon, eyebrow, title, children, tone = "blue" }) {
  const iconTone =
    tone === "amber"
      ? "bg-amber-50 text-amber-700"
      : tone === "green"
        ? "bg-emerald-50 text-emerald-700"
        : "bg-blue-50 text-blue-700";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconTone}`}>
          <Icon size={19} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-sm font-semibold text-slate-900">{title}</h2>
        </div>
      </div>
      <div className="mt-3 text-sm leading-6 text-slate-600">{children}</div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3 no-underline">
            <img
              src="/jabonga-logo.png"
              alt="Municipality of Jabonga seal"
              className="h-11 w-11 shrink-0 object-contain"
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold tracking-tight text-slate-900 sm:text-base">
                Facility &amp; Vehicle Scheduler
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Municipality of Jabonga
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-2.5">
            <Link
              to="/login?request=staff"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 no-underline shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
              Sign Up
            </Link>
            <Link
              to="/login"
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white no-underline shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
              Sign In
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(300px,0.9fr)] lg:gap-8 lg:px-8 lg:py-8">
        <div className="min-w-0 space-y-6">
          <section
            className="relative isolate flex min-h-[390px] items-end overflow-hidden rounded-3xl bg-slate-900 p-6 shadow-lg sm:min-h-[440px] sm:p-9 lg:p-11"
            style={{
              backgroundImage:
                "linear-gradient(90deg, rgba(7, 24, 50, 0.88) 0%, rgba(7, 24, 50, 0.65) 55%, rgba(7, 24, 50, 0.24) 100%), linear-gradient(0deg, rgba(7, 24, 50, 0.28), transparent 60%), url('/login-bg/login_img.jpg')",
              backgroundPosition: "center",
              backgroundSize: "cover",
            }}>
            <div className="max-w-2xl text-white">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-blue-100 backdrop-blur">
                <ShieldCheck size={14} />
                MUNICIPALITY OF JABONGA · LGU PORTAL
              </div>
              <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                Internal Facility &amp; Vehicle Dispatch System
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-blue-50 sm:text-base sm:leading-7">
                A shared scheduling portal for authorized municipal and barangay
                personnel to coordinate venues, vehicles, and official
                dispatches.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-blue-800 no-underline shadow-sm transition hover:bg-blue-50">
                  Proceed to Portal Login
                  <ArrowRight size={16} />
                </Link>
                <Link
                  to="/login?request=staff"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/40 bg-white/10 px-5 py-3 text-sm font-semibold text-white no-underline backdrop-blur transition hover:bg-white/20">
                  <FileCheck2 size={16} />
                  Request Staff Account
                </Link>
              </div>
            </div>
          </section>

          <section aria-labelledby="features-heading">
            <div className="mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                Scheduling tools
              </p>
              <h2
                id="features-heading"
                className="mt-1 text-lg font-bold text-slate-900">
                One coordinated view of municipal resources
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {features.map(({ icon: Icon, title, description }) => (
                <article
                  key={title}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <Icon size={19} />
                  </span>
                  <h3 className="mt-3 text-sm font-semibold leading-5 text-slate-900">
                    {title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-5 text-slate-600">
                    {description}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4" aria-label="Scheduling information">
          <InfoCard
            icon={BellRing}
            eyebrow="Announcements & advisories"
            title="Plan ahead for every booking"
            tone="amber">
            <p>
              Submit facility, vehicle, and equipment requests at least{" "}
              <strong className="font-semibold text-slate-800">
                48 hours in advance
              </strong>
              . Late requests may not be reviewed or approved in time.
            </p>
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900">
              <CalendarClock size={15} className="mt-0.5 shrink-0" />
              Requests remain subject to availability and approval.
            </div>
          </InfoCard>

          <InfoCard
            icon={CheckCircle2}
            eyebrow="How scheduling works"
            title="Submit, review, and receive updates"
            tone="green">
            <ul className="space-y-2.5">
              <li className="flex items-start gap-2">
                <ShieldCheck
                  size={15}
                  className="mt-0.5 shrink-0 text-emerald-700"
                />
                Access is for authorized LGU and Barangay personnel.
              </li>
              <li className="flex items-start gap-2">
                <MessageSquareText
                  size={15}
                  className="mt-0.5 shrink-0 text-emerald-700"
                />
                Automated SMS alerts may be sent for booking updates when
                enabled.
              </li>
            </ul>
          </InfoCard>

          <InfoCard
            icon={LifeBuoy}
            eyebrow="Account & technical support"
            title="Need an account or help signing in?">
            <p>
              Staff account requests start with Google sign-in and require
              approval. Email changes must be verified using the link sent to
              the new address.
            </p>
            <div className="mt-4 flex flex-col items-start gap-2">
              <Link
                to="/login?request=staff"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 no-underline hover:text-blue-900">
                Request a staff account
                <ArrowRight size={15} />
              </Link>
              <Link
                to="/registration-status"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 no-underline hover:text-slate-900">
                Check registration status
                <ArrowRight size={15} />
              </Link>
            </div>
          </InfoCard>
        </aside>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>
            Municipality of Jabonga · Facility &amp; Vehicle Scheduler
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-emerald-600" />
            For authorized LGU and Barangay personnel
          </span>
        </div>
      </footer>
    </div>
  );
}
