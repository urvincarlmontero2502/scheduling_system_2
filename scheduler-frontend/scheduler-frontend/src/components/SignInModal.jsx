import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import ForgotPasswordModal from "./ForgotPasswordModal";
import { executeLoginRecaptcha } from "../utils/recaptcha";

function GoogleMark() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg">
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
  );
}

export default function SignInModal({
  isOpen,
  onClose,
  onSwitchToSignUp,
}) {
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const from = location.state?.from?.pathname || "/";

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const recaptchaToken = await executeLoginRecaptcha();
      await signIn({
        email,
        password,
        remember_me: rememberMe,
        recaptcha_token: recaptchaToken,
      });
      onClose();
      navigate(from, { replace: true });
    } catch (err) {
      setError(
        err.response?.status === 429
          ? "Too many login attempts. Please wait a few minutes before trying again."
          : err.response?.data?.message ||
              err.message ||
              "Could not sign in. Check your email and password.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setError("");
    setGoogleSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          (err.response
            ? "Google sign-in could not be started. Please try again."
            : "Could not connect to the sign-in service. Check your internet connection and try again."),
      );
      setGoogleSubmitting(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}>
        <section
          aria-labelledby="sign-in-title"
          aria-modal="true"
          className="my-auto w-full max-w-md rounded-3xl border border-white/70 bg-white p-6 shadow-2xl shadow-slate-950/30 sm:p-8"
          role="dialog">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">
                Welcome back
              </p>
              <h2
                className="mt-1 text-2xl font-bold tracking-tight text-slate-900"
                id="sign-in-title">
                Sign in
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Access your scheduling workspace.
              </p>
            </div>
            <button
              aria-label="Close sign in"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              onClick={onClose}
              type="button">
              <X size={19} />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <label
              className="mb-2 block text-sm font-semibold text-slate-700"
              htmlFor="sign-in-email">
              Email
            </label>
            <input
              autoComplete="email"
              className="mb-5 w-full rounded-xl border border-slate-300 px-4 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              id="sign-in-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@organization.gov"
              required
              type="email"
              value={email}
            />

            <label
              className="mb-2 block text-sm font-semibold text-slate-700"
              htmlFor="sign-in-password">
              Password
            </label>
            <div className="relative mb-4">
              <input
                autoComplete="current-password"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-12 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                id="sign-in-password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                required
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-500 transition hover:text-slate-800"
                onClick={() => setShowPassword((visible) => !visible)}
                type="button">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="mb-5 flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  checked={rememberMe}
                  className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                  onChange={(event) => setRememberMe(event.target.checked)}
                  type="checkbox"
                />
                Remember me
              </label>
              <button
                className="text-sm font-semibold text-blue-700 transition hover:text-blue-900 hover:underline"
                onClick={() => setShowForgotModal(true)}
                type="button">
                Forgot password?
              </button>
            </div>

            {error && (
              <div
                className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3"
                role="alert">
                <AlertCircle
                  className="mt-0.5 shrink-0 text-rose-600"
                  size={16}
                />
                <p className="text-xs leading-5 text-rose-800">{error}</p>
              </div>
            )}

            <button
              className="w-full rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting || googleSubmitting}
              type="submit">
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="animate-spin" size={17} />
                  Signing in…
                </span>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-medium text-slate-400">or</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            aria-live="polite"
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:cursor-wait disabled:opacity-70"
            disabled={googleSubmitting || submitting}
            onClick={handleGoogleSignIn}
            type="button">
            {googleSubmitting ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Connecting to Google…
              </>
            ) : (
              <>
                <GoogleMark />
                Sign in with Google
              </>
            )}
          </button>

          <div className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-600">
            Don&apos;t have an account?{" "}
            <button
              className="font-semibold text-blue-700 hover:text-blue-900 hover:underline"
              onClick={onSwitchToSignUp}
              type="button">
              Sign up
            </button>
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="text-emerald-600" size={15} />
            Secure access for authorized LGU personnel
          </div>
        </section>
      </div>

      <ForgotPasswordModal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
      />
    </>
  );
}
