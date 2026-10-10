import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CalendarClock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import ForgotPasswordModal from "../components/ForgotPasswordModal";

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

          {/* Divider */}
          <div className="mb-4 flex items-center gap-2">
            <div className="flex-1 border-t border-line"></div>
            <span className="text-[11px] text-steel">Or continue with</span>
            <div className="flex-1 border-t border-line"></div>
          </div>

          {/* Google Sign-In Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-md border border-line bg-white py-2 text-[13px] font-medium text-ink transition hover:bg-paper">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.24c0-.76-.06-1.46-.18-2.12H12v4.2h5.92a5.06 5.06 0 0 1-1.34 3.27l-.01-.01c2.1 1.57 3.57 3.9 3.57 6.55 0 4.67-3.81 8.48-8.48 8.48-3.4 0-6.28-1.36-8.45-3.6l-.01.01C3.53 19.65 1.5 16.75 1.5 13.18 1.5 9.25 4.87 5.87 9.44 5.87c2.3 0 4.35.86 5.89 2.25l.01-.01.01.01c.82 1.18 1.28 2.6 1.28 4.12 0 3.02-2.45 5.47-5.65 5.47-2.17 0-4.07-1.22-4.96-2.9l-.01-.01C4.56 15.57 3.5 13.97 3.5 12.18c0-3.03 2.45-5.48 5.48-5.48 2.1 0 3.98.83 5.38 2.17l.01-.01.01.01c.82 1.18 1.28 2.6 1.28 4.12 0 3.02-2.45 5.47-5.65 5.47-2.17 0-4.07-1.22-4.96-2.9" fill="#4285F4"/>
              <path d="M23.524 10.078a11.333 11.333 0 0 0 0-2.382c-.06-.25-.3-.39-.53-.32a47.45 47.45 0 0 0-5.886 1.46 1.5 1.5 0 0 0-.97.89c-.15.31-.13.66.05.95.18.3.43.53.73.59a32.42 32.42 0 0 0 5.35 0c.3-.06.55-.29.73-.59.15-.3.17-.65.05-.95" fill="#34A853"/>
              <path d="M12 24c2.45 0 4.71-.75 6.48-2.05l-.01-.01c-1.22-.83-2.74-1.33-4.36-1.33h-.01c-1.61 0-3.14.5-4.35 1.33C5.37 22.72 7.5 24 10.1 24c.73 0 1.44-.08 2.13-.24.01-.02.02-.04.02-.07" fill="#FBBC05"/>
              <path d="M5.52 10.12c-.18-.36-.44-.66-.77-.89a12.4 12.4 0 0 0 0 7.22h.01a10.47 10.47 0 0 0 5.32 4.67c.2.07.41.1.62.08.34-.04.58-.35.54-.69-.04-.34-.34-.57-.68-.55-.23.01-.47.05-.7.15-1.57.7-3.1-.06-3.88-1.38-.12-.18-.11-.39-.02-.59Z" fill="#EA4335"/>
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
