import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Link } from "react-router-dom";
import { ArrowRight, Mail, Search, Clock, CheckCircle } from "lucide-react";

const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    color: "text-amber-600",
    bg: "bg-amber-100",
    title: "Request Submitted",
    pill: "Pending Approval",
    pillColor: "text-amber-600",
    pillBg: "bg-amber-100",
    message:
      "Your registration request has been submitted to the barangay admin and is awaiting approval.",
    detail:
      "You will receive an email at the address you used to sign up once the admin reviews your request. This typically takes 1-2 business days.",
    actionLabel: "Request Staff Access",
    actionRoute: "/login?request=staff",
  },
  approved: {
    icon: CheckCircle,
    color: "text-emerald-600",
    bg: "bg-emerald-100",
    title: "Account Approved!",
    pill: "Approved",
    pillColor: "text-emerald-600",
    pillBg: "bg-emerald-100",
    message: "Your registration has been approved by the barangay admin.",
    detail: "You can now log in to the system using the button below.",
    actionLabel: "Proceed to Login",
    actionRoute: "/login?registration=approved",
  },
  declined: {
    icon: CheckCircle,
    color: "text-rose-600",
    bg: "bg-rose-100",
    title: "Request Declined",
    pill: "Declined",
    pillColor: "text-rose-600",
    pillBg: "bg-rose-100",
    message: "Your registration request was not approved.",
    detail:
      "Please contact your barangay administrator for more information or submit a new request.",
    actionLabel: "Request Staff Access",
    actionRoute: "/login?request=staff",
  },
};

export default function RegistrationStatus() {
  const navigate = useNavigate();
  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);
  const lookupEmail = urlParams.get("email");
  const storedStatus = localStorage.getItem("registration_submitted");

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [lookupResult, setLookupResult] = useState(null);

  const resetLookup = () => {
    setLookupResult(null);
    setEmail("");
    setError("");
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    if (lookupEmail && !lookupResult) {
      handleLookup(lookupEmail);
    }
  }, [lookupEmail, lookupResult]);

  const handleLookup = async (emailToLookup) => {
    setIsLoading(true);
    setError("");
    setLookupResult(null);

    try {
      const response = await fetch(
        `/api/registration-lookup?email=${encodeURIComponent(emailToLookup)}`,
      );
      if (!response.ok) {
        if (response.status === 404) {
          setError("No registration request found for this email.");
        } else {
          setError("Unable to check registration status. Please try again.");
        }
        return;
      }

      const data = await response.json();

      if (data.status) {
        setLookupResult({
          email: data.email,
          status: data.status,
          full_name: data.full_name,
          barangay: data.barangay,
          role: data.role,
          reviewed_at: data.reviewed_at,
        });
      } else {
        setError("No registration request found for this email.");
      }
    } catch (err) {
      console.error(err);
      setError("Unable to check registration status. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email.");
      return;
    }

    handleLookup(email);
  };

  const currentStatus = lookupResult?.status || storedStatus || "pending";
  const config = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.pending;
  const { icon: Icon } = config;

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-4">
      <div className="w-full max-w-md rounded-xl border border-line bg-white p-8 shadow-sm">
        {/* Back to Portal link inside top-left of card */}
        <Link
          to="/"
          className="mb-4 inline-flex items-center text-sm text-slate-500 hover:text-slate-800 no-underline transition">
          <ArrowRight size={14} className="-rotate-180 mr-1" /> Back to Portal
        </Link>
        {!lookupResult && !storedStatus ? (
          // Email Lookup Form State
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Search size={20} />
            </div>

            <h2 className="text-[18px] font-semibold text-ink mb-2">
              Check Your Registration Status
            </h2>
            <p className="text-[13px] text-steel mb-6">
              Enter the email address you used to sign up to check for a pending
              or approved registration request.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block text-left text-sm font-medium text-slate-700 mb-1.5">
                Email Address
              </label>
              <div className="relative mb-2">
                <div className="absolute inset-y-0 left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <Mail size={16} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="juandelacruz@gmail.com"
                  className="w-full rounded-lg border border-line pl-10 pr-3 py-2 text-[13px] text-ink outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition"
                  required
                />
              </div>
              {error && (
                <div className="text-[12px] text-red-600 text-center mb-2">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-lg bg-blue-600 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-70">
                {isLoading ? "Checking..." : "Check Status"}
              </button>
            </form>

            <div className="mt-8 border-t border-slate-100 pt-6">
              <div className="flex flex-col items-center gap-3 text-center">
                <p className="text-[12px] text-steel">
                  Already approved?{" "}
                  <Link
                    to="/login"
                    className="text-blue-600 font-medium no-underline hover:text-blue-700">
                    Sign in →
                  </Link>
                </p>
                <p className="text-[12px] text-steel">
                  Don't have an account?{" "}
                  <Link
                    to="/login?request=staff"
                    className="text-blue-600 font-medium no-underline hover:text-blue-700">
                    Request staff access
                  </Link>
                </p>
              </div>
              <p className="mt-3 text-[10px] text-slate-400">
                If you believe this is an error, please contact support.
              </p>
            </div>
          </div>
        ) : (
          // Status Result Card
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-xl ${config.bg}">
              <Icon size={20} className="${config.color}" />
            </div>

            <h1 className="text-[18px] font-bold text-ink mb-2">
              {config.title}
            </h1>

            <span
              className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-6 ${config.pillColor} ${config.pillBg}`}>
              {config.pill}
            </span>

            {/* Result Details Box */}
            {lookupResult && (
              <div className="mb-6 rounded-lg border border-slate-100 bg-slate-50 p-4 text-left">
                <div className="flex items-start gap-2 mb-3">
                  <span className="flex-shrink-0 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Email
                  </span>
                  <p className="text-[13px] text-ink break-all">
                    {lookupResult.email}
                  </p>
                </div>
                {lookupResult.barangay && (
                  <div className="flex items-start gap-2 mb-3">
                    <span className="flex-shrink-0 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Barangay
                    </span>
                    <p className="text-[13px] text-ink">
                      {lookupResult.barangay}
                    </p>
                  </div>
                )}
                {lookupResult.role && (
                  <div className="flex items-start gap-2 mb-3">
                    <span className="flex-shrink-0 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Role
                    </span>
                    <p className="text-[13px] text-ink">{lookupResult.role}</p>
                  </div>
                )}
                {lookupResult.reviewed_at && (
                  <div className="flex items-start gap-2 mb-0">
                    <span className="flex-shrink-0 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Reviewed At
                    </span>
                    <p className="text-[13px] text-ink">
                      {new Date(lookupResult.reviewed_at).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            )}

            <p className="text-[13px] text-steel mb-6">{config.message}</p>
            <p className="text-[12px] text-slate-500 mb-6">{config.detail}</p>

            <div className="space-y-3">
              {config.actionRoute && (
                <button
                  onClick={() => navigate(config.actionRoute)}
                  className={`w-full rounded-lg py-2.5 text-[14px] font-semibold transition-colors ${currentStatus === "approved" ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
                  {config.actionLabel}
                </button>
              )}
              <button
                onClick={resetLookup}
                className="w-full rounded-lg border border-line py-2 text-[12px] font-medium text-slate-600 hover:bg-slate-50 transition">
                Check another email
              </button>
            </div>

            {currentStatus !== "approved" && (
              <p className="mt-4 text-[11px] text-slate-400">
                You will be redirected to the login page once your account is
                approved.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
