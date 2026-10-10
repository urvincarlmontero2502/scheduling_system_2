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
          className="border border-line rounded-lg bg-white p-6 pb-8">
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
          <div className="my-6 flex items-center gap-2">
            <div className="flex-1 border-t border-line"></div>
            <span className="text-[11px] text-steel">Or continue with</span>
            <div className="flex-1 border-t border-line"></div>
          </div>

          {/* Google Sign-In Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="mb-4 flex w-full items-center justify-center gap-3 rounded-md border border-line bg-white px-4 py-2.5 text-[13px] font-medium text-ink transition hover:bg-paper">
            <svg
              width="18"
              height="18"
              viewBox="0 0 48 48"
              xmlns="http://www.w3.org/2000/svg"
              flex-none
            >
              <path
                fill="#4285F4"
                d="M46.1 24.2C46.1 22.8 46.0 21.5 45.7 20.2L38.2 20.2C38.9 21.8 39.3 23.5 39.3 25.2C39.3 26.8 38.9 28.5 38.2 29.9L45.7 29.9C46.0 28.5 46.1 27.1 46.1 25.6C46.1 25.3 46.1 25.0 46.1 24.7C46.1 24.5 46.1 24.3 46.1 24.2Z"
              />
              <path
                fill="#34A853"
                d="M24 46.1C26.2 46.1 28.2 45.6 30.1 44.6C31.8 43.7 33.3 42.6 34.4 41.3C35.6 40.0 36.5 38.5 37.1 36.9C37.8 35.1 38.3 33.2 38.3 31.2C38.3 29.1 37.8 27.2 37.1 25.3C36.5 23.7 35.6 22.2 34.4 20.9C33.3 19.6 31.8 18.5 30.1 17.6C28.2 16.6 26.2 16.1 24 16.1C21.8 16.1 19.8 16.6 17.9 17.6C16.2 18.5 14.7 19.6 13.4 20.9C12.2 22.2 11.3 23.7 10.7 25.3C10.0 27.2 9.5 29.1 9.5 31.2C9.5 33.2 10.0 35.1 10.7 36.9C11.3 38.5 12.2 40.0 13.4 41.3C14.5 42.6 16.0 43.7 17.7 44.6C19.6 45.6 21.6 46.1 23.9 46.1L24 46.1Z"
              />
              <path
                fill="#FBBC05"
                d="M9.8 17.5C8.1 19.3 6.9 21.6 6.9 24.1C6.9 25.9 7.4 27.7 8.4 29.2L1.3 34.6C-.1 32.4 -1 29.9 -1 27.3C-1 20.9 4.3 15.5 10.7 14.5C12.4 14.2 14.1 14.3 15.8 14.7L9.8 17.5Z"
              />
              <path
                fill="#EA4335"
                d="M24 9.5C28.3 9.5 32.1 11.2 34.9 14.1L34.9 14.1C35.6 14.8 36.2 15.6 36.6 16.5C36.9 17.3 37.2 18.2 37.3 19.1C37.4 20.0 37.5 20.9 37.5 21.8C37.5 23.9 36.9 25.9 35.9 27.6L36 27.6C36.8 26.8 37.5 25.9 37.9 24.8C38.3 23.7 38.5 22.6 38.5 21.5C38.5 18.1 36.5 15.3 33.4 13.6C32.5 13.1 31.5 12.8 30.4 12.6C29.4 12.5 28.4 12.4 27.4 12.4C26.3 12.4 25.3 12.5 24.4 12.6C24.2 11.2 24.1 9.8 24 9.5Z"
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
