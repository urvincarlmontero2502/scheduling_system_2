import { useCallback, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  ShieldCheck,
  Truck,
} from "lucide-react";
import jabongaLogo from "../assets/jabonga-logo.png";
import StaffRequestModal from "../components/StaffRequestModal";
import SignInModal from "../components/SignInModal";
import { useAuth } from "../context/AuthContext";

const services = [
  {
    icon: Building2,
    title: "Facility Scheduling",
    description:
      "Find a suitable venue and manage facility bookings from one place.",
    items: [
      "Check facility availability",
      "Submit booking requests and view scheduled dates",
      "Track booking status and avoid reservation conflicts",
    ],
  },
  {
    icon: Truck,
    title: "Utility Vehicle Scheduling",
    description:
      "Coordinate municipal utility vehicles and keep dispatch plans in sync.",
    items: [
      "Check vehicle availability before requesting",
      "View schedules and prevent booking conflicts",
      "Track dispatch and return details where available",
    ],
  },
];

export default function Login() {
  const { signInWithGoogle, user, loading } = useAuth();
  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);
  const registrationPending = urlParams.get("registration") === "pending";
  const registrationApproved = urlParams.get("registration") === "approved";
  const [activeModal, setActiveModal] = useState(
    urlParams.get("request") === "staff" ? "signup" : null,
  );

  const closeAuthModal = useCallback(() => setActiveModal(null), []);
  const openSignUp = useCallback(() => setActiveModal("signup"), []);
  const openSignIn = useCallback(() => setActiveModal("signin"), []);

  if (!loading && user) {
    return (
      <Navigate replace to={location.state?.from?.pathname || "/"} />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            aria-label="Scheduling System for Facility and Utility Vehicle Coordination home"
            className="flex min-w-0 items-center gap-2.5 no-underline sm:gap-3"
            to="/login">
            <img
              alt="Municipality of Jabonga seal"
              className="h-10 w-10 shrink-0 object-contain sm:h-12 sm:w-12"
              src={jabongaLogo}
            />
            <span className="min-w-0">
              <span className="block max-w-[220px] text-xs font-bold leading-tight tracking-tight text-slate-900 sm:max-w-none sm:text-sm md:text-base">
                Scheduling System for Facility and Utility Vehicle Coordination
              </span>
              <span className="mt-1 block text-[11px] leading-tight text-slate-500 sm:text-xs">
                Municipality of Jabonga
              </span>
            </span>
          </Link>
          <nav aria-label="Account" className="flex shrink-0 items-center gap-2">
            <button
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:px-4 sm:py-2.5 sm:text-sm"
              onClick={openSignUp}
              type="button">
              Sign Up
            </button>
            <button
              className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:px-4 sm:py-2.5 sm:text-sm"
              onClick={openSignIn}
              type="button">
              Sign In
            </button>
          </nav>
        </div>
      </header>

      <main>
        {(registrationPending || registrationApproved) && (
          <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8">
            <div
              className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${
                registrationApproved
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              }`}
              role="status">
              {registrationApproved ? (
                <CheckCircle2 className="mt-0.5 shrink-0" size={17} />
              ) : (
                <ShieldCheck className="mt-0.5 shrink-0" size={17} />
              )}
              <p>
                {registrationApproved
                  ? "Your registration has been approved. You can now sign in."
                  : "Your registration request is awaiting approval. You will be notified after it has been reviewed."}
              </p>
            </div>
          </div>
        )}

        <section
          aria-labelledby="hero-title"
          className="relative isolate mx-auto mt-5 flex min-h-[410px] max-w-7xl items-center justify-between gap-10 overflow-hidden rounded-3xl bg-slate-900 px-6 py-12 shadow-lg sm:min-h-[450px] sm:px-10 lg:px-14">
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-cover bg-center"
            style={{
              backgroundImage:
                "linear-gradient(90deg, rgba(7, 24, 50, 0.9) 0%, rgba(7, 24, 50, 0.72) 58%, rgba(7, 24, 50, 0.42) 100%), url('/login-bg/login_img.jpg')",
            }}
          />
          <div className="max-w-2xl text-white">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-blue-100 backdrop-blur sm:text-xs">
              <ShieldCheck aria-hidden="true" size={15} />
              Municipality of Jabonga · LGU Scheduling Portal
            </div>
            <h1
              className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl"
              id="hero-title">
              Facility and Utility Vehicle Scheduling
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-blue-50 sm:text-base sm:leading-7">
              An online scheduling platform for coordinating municipal
              facilities and utility vehicles, providing centralized
              availability, booking requests, approvals, and scheduling
              management.
            </p>
          </div>
          <div
            aria-hidden="true"
            className="hidden w-full max-w-sm shrink-0 rounded-2xl border border-white/20 bg-slate-950/30 p-5 text-white shadow-xl backdrop-blur-sm lg:block">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">
              One coordinated view
            </p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/10 p-3">
                <Building2 className="shrink-0 text-blue-100" size={19} />
                <span className="text-sm font-medium">Facility availability</span>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/10 p-3">
                <Truck className="shrink-0 text-blue-100" size={19} />
                <span className="text-sm font-medium">Utility vehicle schedules</span>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/10 p-3">
                <CalendarCheck2 className="shrink-0 text-blue-100" size={19} />
                <span className="text-sm font-medium">Booking requests and decisions</span>
              </div>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="services-title"
          className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
          <div className="mb-6 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              Services
            </p>
            <h2
              className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
              id="services-title">
              Scheduling made clear and coordinated
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
              Authorized personnel can check availability, submit requests, and
              follow each booking through its approval.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 md:gap-6">
            {services.map(({ icon: Icon, title, description, items }) => (
              <article
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
                key={title}>
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <Icon size={22} />
                  </span>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {title}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {description}
                    </p>
                  </div>
                </div>
                <ul className="mt-5 space-y-3 border-t border-slate-100 pt-4">
                  {items.map((item) => (
                    <li
                      className="flex items-start gap-2.5 text-sm leading-5 text-slate-700"
                      key={item}>
                      <CheckCircle2
                        className="mt-0.5 shrink-0 text-emerald-600"
                        size={16}
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-blue-950 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex items-start gap-2.5">
              <CalendarCheck2
                className="mt-0.5 shrink-0 text-blue-700"
                size={18}
              />
              <p>
                All requests are subject to resource availability and
                administrator approval.
              </p>
            </div>
            <Link
              className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-blue-800 no-underline hover:text-blue-950"
              to="/registration-status">
              Check registration status
              <ArrowRight size={15} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>
            Municipality of Jabonga · Scheduling System for Facility and
            Utility Vehicle Coordination
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="text-emerald-600" size={14} />
            For authorized LGU and Barangay personnel
          </span>
        </div>
      </footer>

      <SignInModal
        isOpen={activeModal === "signin"}
        onClose={closeAuthModal}
        onSwitchToSignUp={openSignUp}
      />
      <StaffRequestModal
        isOpen={activeModal === "signup"}
        onClose={closeAuthModal}
        onGoogleSignUp={signInWithGoogle}
        onSwitchToSignIn={openSignIn}
      />
    </div>
  );
}
