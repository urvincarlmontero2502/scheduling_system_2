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
            className="flex w-full items-center justify-center gap-3 rounded-md border border-line bg-white px-4 py-2.5 text-[13px] font-medium text-ink transition hover:bg-paper">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              flex-none
            >
              <path
                d="M22.2563 9.93318C21.9197 8.10691 21.0248 6.43879 19.7162 5.13369C18.4075 3.82859 16.7388 2.94087 14.8747 2.58919C13.0106 2.24751 11.0066 2.34865 9.10629 2.91458C7.20596 3.48052 5.45158 4.61123 4.0401 6.08142C2.62862 7.55161 1.59489 9.32425 1.04876 11.2811C0.502634 13.2379 0.474876 15.3257 0.966835 17.3068C1.45879 19.2879 2.54953 21.0992 4.14165 22.517C5.73377 23.9348 7.76231 24.9028 10.0663 25.3083C12.3703 25.7138 14.8545 25.5328 17.3161 24.7925C18.9774 24.2842 20.4737 23.4186 21.6799 22.2615C22.8861 21.1044 23.7567 19.6926 24.2058 18.1447C24.6549 16.5968 24.6616 14.9629 24.2252 13.3818C23.7888 11.8007 22.9218 10.3272 22.2563 9.93318ZM12 23.3148C9.34786 23.3148 6.99587 22.3473 5.31098 20.6215C3.6261 18.8957 2.71337 16.4729 2.71337 13.7769C2.71337 11.0809 3.6261 8.65814 5.31098 6.9323C6.99587 5.2065 9.34786 4.239 12 4.239C14.6521 4.239 17.0042 5.2065 18.689 6.9323C20.3739 8.65814 21.2866 11.0809 21.2866 13.7769C21.2866 16.4729 20.3739 18.8957 18.689 20.6215C17.0042 22.3473 14.6521 23.3148 12 23.3148ZM10.0459 17.3326L6.96522 14.2519C6.64231 13.929 6.64231 13.4189 6.96522 13.096C7.28813 12.7731 7.79822 12.7731 8.12113 13.096L11.2018 16.1767L15.8789 11.5323C16.2018 11.2094 16.7119 11.2094 17.0348 11.5323C17.3577 11.8552 17.3577 12.3653 17.0348 12.6882L11.6445 17.7965C11.4838 17.9572 11.2405 18.0375 10.9972 18.0375C10.7539 18.0375 10.5106 17.9572 10.35 17.6954C10.2546 17.5618 10.1642 17.4413 10.0459 17.3326Z"
                fill="url(#google-color)"
              />
              <defs>
                <linearGradient id="google-color" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#EA4335" />
                  <stop offset="20%" stopColor="#EA4335" />
                  <stop offset="20%" stopColor="#FBBC05" />
                  <stop offset="40%" stopColor="#FBBC05" />
                  <stop offset="40%" stopColor="#4285F4" />
                  <stop offset="60%" stopColor="#4285F4" />
                  <stop offset="60%" stopColor="#34A853" />
                  <stop offset="100%" stopColor="#34A853" />
                </linearGradient>
              </defs>
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
