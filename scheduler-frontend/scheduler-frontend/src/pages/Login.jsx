import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CalendarClock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import ForgotPasswordModal from "../components/ForgotPasswordModal";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false); // State for eye toggle
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  const from = location.state?.from?.pathname || "/";

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand text-white">
            <CalendarClock size={18} />
          </div>
          <div>
            <p className="text-[15px] font-semibold leading-tight">
              Facility & Vehicle Scheduler
            </p>
            <p className="text-[13px] text-steel leading-tight">
              Sign in to manage bookings
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="border border-line rounded-lg bg-white p-6">
          <label className="mb-1.5 block text-[13px] font-medium text-steel">
            Email
          </label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-4 w-full rounded-md border border-line px-3 py-2 text-[14px] outline-none focus:border-brand"
            placeholder="you@organization.edu"
          />

          <label className="mb-1.5 block text-[13px] font-medium text-steel">
            Password
          </label>
          <div className="relative mb-4">
            <input
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-line px-3 py-2 pr-10 text-[14px] outline-none focus:border-brand"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-steel hover:text-gray-700 focus:outline-none">
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Remember Me + Forgot Password row */}
          <div className="mb-4 flex items-center justify-between">
            <label className="flex items-center gap-2 text-[13px] text-steel">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-line text-brand focus:ring-brand"
              />
              Remember me
            </label>
            <button
              type="button"
              onClick={() => setShowForgotModal(true)}
              className="text-[12px] font-medium text-brand hover:underline">
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
            className="w-full rounded-md bg-brand py-2 text-[14px] font-medium text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? (
              <div className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Signing in…
              </div>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <p className="mt-4 text-center text-[12px] text-steel">
          Connects to your Laravel API at{" "}
          <code className="font-mono">/api/login</code>
        </p>
      </div>

        {/* Forgot Password Modal */}
        <ForgotPasswordModal
          isOpen={showForgotModal}
          onClose={() => setShowForgotModal(false)}
        />
      </div>
    </div>
  );
}
