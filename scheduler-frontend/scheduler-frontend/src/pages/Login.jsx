import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CalendarClock, Eye, EyeOff, AlertCircle, CheckCircle, Building2, Truck, FileText } from "lucide-react";
import jabongaLogo from "../assets/jabonga-logo.png";
import { useAuth } from "../context/AuthContext";
import ForgotPasswordModal from "../components/ForgotPasswordModal";

// Trigger fresh Vercel deployment
const SLIDESHOW_IMAGES = [
  "/login-bg/login_img.jpg",
  "/login-bg/login_img2.jpg",
  "/login-bg/login_img3.jpg",
  "/login-bg/login_img4.jpg",
  "/login-bg/login_img5.jpg",
  "/login-bg/login_img6.jpg",
];

export default function Login() {
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false); // State for eye toggle
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

  const from = location.state?.from?.pathname || "/";
  const urlParams = new URLSearchParams(location.search);
  const registrationPending = urlParams.get("registration") === "pending";
  const registrationApproved = urlParams.get("registration") === "approved";

  // Auto-advance slideshow
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % SLIDESHOW_IMAGES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signIn({ email, password, remember_me: rememberMe });
      navigate(from, { replace: true });
    } catch (err) {
      // Handle rate limiting (HTTP 429)
      if (err.response?.status === 429) {
        setError(
          "Too many login attempts. Please wait a few minutes before trying again."
        );
      } else {
        setError(
          err.response?.data?.message ||
            "Could not sign in. Check your email and password.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setError("");
    try {
      await signInWithGoogle();
      navigate(from, { replace: true });
    } catch (err) {
      setError(
        "Google sign-in failed. Please try again."
      );
    }
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-between px-4 md:px-8 lg:px-16 xl:px-24 overflow-hidden">
      {/* Background slideshow */}
      <div className="absolute inset-0 w-full h-full -z-10 overflow-hidden">
        {SLIDESHOW_IMAGES.map((img, idx) => (
          <div
            key={img}
            className={`absolute inset-0 bg-center bg-cover transition-all duration-1000 blur-sm${idx === activeSlide ? " opacity-100 scale-105" : " opacity-0 scale-100"}`}
            style={{ backgroundImage: `url(${img})` }}
          />
        ))}
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-blue-900/40" />
      </div>
      {/* Left-hand hero section for municipal personnel (desktop only) */}
      <nav className="hidden lg:flex flex-col justify-center max-w-xl p-12 text-white z-10">
        <p className="text-xs font-bold uppercase tracking-wider text-sky-300 drop-shadow-md">
          MUNICIPALITY OF JABONGA • LGU PORTAL
        </p>
        <h1 className="mt-4 text-4xl font-extrabold leading-tight drop-shadow-md">
          Internal Facility & Vehicle Dispatch System
        </h1>
        <p className="mt-6 max-w-md text-[15px text-blue-100 drop-shadow-md">
          Secure portal for Mayor's Office staff and Barangay personnel to coordinate venue reservations, manage utility fleet schedules, and track official LGU dispatches.
        </p>
        <div className="mt-8 inline-flex flex-row items-center gap-3 p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 w-fit">
          <div className="flex shrink-0 items-center gap-2 whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-medium text-white bg-brand/25 backdrop-blur-sm">
            <Building2 size={14} /> Municipal Venue Approvals
          </div>
          <div className="flex shrink-0 items-center gap-2 whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-medium text-white bg-brand/25 backdrop-blur-sm">
            <Truck size={14} /> Fleet & Heavy Equipment Dispatch
          </div>
          <div className="flex shrink-0 items-center gap-2 whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-medium text-white bg-brand/25 backdrop-blur-sm">
            <FileText size={14} /> Inter-Barangay Coordination
          </div>
        </div>
      </nav>

      <div className="w-full max-w-sm">
        <form
          onSubmit={handleSubmit}
          className="border border-blue-200 rounded-lg bg-white/95 backdrop-blur-sm p-8">
          {/* Logo & Title (centered, inside the card) */}
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="flex w-12 h-12 aspect-square items-center justify-center rounded-full bg-transparent text-white overflow-hidden">
              <img src={jabongaLogo} alt="Jabonga Logo" className="h-full w-full object-contain" />
            </div>
            <div className="mt-3">
              <p className="text-[15px] font-semibold leading-tight">
                Facility & Vehicle Scheduler
              </p>
              <p className="text-[13px] text-blue-800 leading-tight">
                Sign in to manage bookings
              </p>
            </div>
          </div>
          {/* Pending Approval Info */}
          {registrationPending && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
              <AlertCircle
                size={16}
                className="mt-0.5 flex-shrink-0 text-amber-600"
              />
              <p className="text-[12.5px] text-amber-800">
                Your registration request has been submitted and is pending
                approval by the barangay admin. You will receive an email once
                your account is approved.
              </p>
            </div>
          )}

          {registrationApproved && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2.5">
              <CheckCircle
                size={16}
                className="mt-0.5 flex-shrink-0 text-green-600"
              />
              <p className="text-[12.5px] text-green-800">
                Your registration has been approved! You can now log in with
                your email address and password.
              </p>
            </div>
          )}

          <label className="mb-1.5 block text-[13px] font-medium text-blue-800">
            Email
          </label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-4 w-full rounded-md border border-line px-3 py-2 text-[14px] outline-none focus:border-blue-500 focus:ring-blue-500"
            placeholder="you@organization.edu"
          />

          <label className="mb-1.5 block text-[13px] font-medium text-blue-800">
            Password
          </label>
          <div className="relative mb-4">
            <input
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-line px-3 py-2 pr-10 text-[14px] outline-none focus:border-blue-500 focus:ring-blue-500"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-blue-800 hover:text-gray-700 focus:outline-none">
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Remember Me + Forgot Password row */}
          <div className="mb-4 flex items-center justify-between">
            <label className="flex items-center gap-2 text-[13px] text-blue-800">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-line text-blue-600 focus:ring-blue-500"
              />
              Remember me
            </label>
            <button
              type="button"
              onClick={() => setShowForgotModal(true)}
              className="text-[12px] font-medium text-blue-600 hover:text-blue-700 hover:underline">
              Forgot password?
            </button>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-status-rejected/20 bg-status-rejected/10 px-3 py-2">
              <AlertCircle
                size={16}
                className="mt-0.5 flex-shrink-0 text-status-rejected"
              />
              <p className="text-[12.5px] text-status-rejected">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-blue-600 py-2 text-[14px] font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? (
              <div className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Signing in…
              </div>
            ) : (
              "Sign in"
            )}
          </button>

          {/* Divider */}
          <div className="my-6 flex items-center gap-2">
            <div className="flex-1 border-t border-line"></div>
            <span className="text-[11px] text-blue-800">Or continue with</span>
            <div className="flex-1 border-t border-line"></div>
          </div>

          {/* Google Sign-In Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="mb-4 flex w-full items-center justify-center gap-3 rounded-md border border-blue-200 bg-white px-4 py-2.5 text-[13px] font-medium text-blue-800 transition hover:bg-blue-50">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </button>
        </form>

        {/* Forgot Password Modal */}
        <ForgotPasswordModal
          isOpen={showForgotModal}
          onClose={() => setShowForgotModal(false)}
        />
      </div>
    </div>
  );
}
