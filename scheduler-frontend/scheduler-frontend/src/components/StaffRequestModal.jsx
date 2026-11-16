import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Loader2, ShieldAlert, X } from "lucide-react";
import * as api from "../api/endpoints";

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

export default function StaffRequestModal({
  isOpen,
  onClose,
  onGoogleSignUp,
  onSwitchToSignIn,
}) {
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [barangay, setBarangay] = useState("");
  const [barangays, setBarangays] = useState([]);
  const [loadingBarangays, setLoadingBarangays] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;

    let active = true;
    setFirstName("");
    setMiddleName("");
    setLastName("");
    setEmail("");
    setPassword("");
    setPasswordConfirmation("");
    setBarangay("");
    setSuccess(false);
    setError("");
    setLoadingBarangays(true);
    api
      .getBarangays()
      .then((response) => {
        if (active) setBarangays(response.data.map((item) => item.name));
      })
      .catch(() => {
        if (active) {
          setError("Could not load the barangay list. Please try again.");
        }
      })
      .finally(() => {
        if (active) setLoadingBarangays(false);
      });

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      active = false;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (password !== passwordConfirmation) {
      setError("The passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await api.registerStaff({
        first_name: firstName.trim(),
        middle_name: middleName.trim() || null,
        last_name: lastName.trim(),
        email: email.trim(),
        password,
        password_confirmation: passwordConfirmation,
        barangay,
      });
      setPassword("");
      setPasswordConfirmation("");
      setSuccess(true);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          Object.values(err.response?.data?.errors || {}).flat()[0] ||
          "Could not submit your registration. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignUp() {
    setError("");
    setGoogleSubmitting(true);
    try {
      await onGoogleSignUp();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Google sign-up could not be started. Please try again.",
      );
      setGoogleSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}>
      <section
        aria-labelledby="sign-up-title"
        aria-modal="true"
        className="my-auto w-full max-w-lg rounded-3xl border border-white/70 bg-white p-6 shadow-2xl shadow-slate-950/30 sm:p-8"
        role="dialog">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <ShieldAlert size={20} />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">
                Municipality of Jabonga
              </p>
              <h2
                className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
                id="sign-up-title">
                {success ? "Request submitted" : "Create your account"}
              </h2>
            </div>
          </div>
          <button
            aria-label="Close sign up"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            onClick={onClose}
            type="button">
            <X size={19} />
          </button>
        </div>

        {success ? (
          <div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
              Your staff registration request has been submitted for approval.
              You can sign in once a barangay administrator approves your
              account.
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <Link
                className="text-sm font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                onClick={onClose}
                to="/registration-status">
                Check registration status
              </Link>
              <button
                className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
                onClick={onSwitchToSignIn}
                type="button">
                Back to sign in
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="mb-5 text-sm leading-6 text-slate-600">
              New staff accounts are reviewed by the selected barangay
              administrator before access is approved.
            </p>

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
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:cursor-wait disabled:opacity-70"
              disabled={googleSubmitting || submitting}
              onClick={handleGoogleSignUp}
              type="button">
              {googleSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Connecting to Google…
                </>
              ) : (
                <>
                  <GoogleMark />
                  Continue with Google
                </>
              )}
            </button>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-semibold tracking-wider text-slate-400">
                OR
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    className="mb-1.5 block text-sm font-semibold text-slate-700"
                    htmlFor="signup-first-name">
                    First name
                  </label>
                  <input
                    autoComplete="given-name"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    id="signup-first-name"
                    onChange={(event) => setFirstName(event.target.value)}
                    required
                    value={firstName}
                  />
                </div>
                <div>
                  <label
                    className="mb-1.5 block text-sm font-semibold text-slate-700"
                    htmlFor="signup-middle-name">
                    Middle name <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <input
                    autoComplete="additional-name"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    id="signup-middle-name"
                    onChange={(event) => setMiddleName(event.target.value)}
                    value={middleName}
                  />
                </div>
              </div>
              <div>
                <label
                  className="mb-1.5 block text-sm font-semibold text-slate-700"
                  htmlFor="signup-last-name">
                  Last name
                </label>
                <input
                  autoComplete="family-name"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  id="signup-last-name"
                  onChange={(event) => setLastName(event.target.value)}
                  required
                  value={lastName}
                />
              </div>
              <div>
                <label
                  className="mb-1.5 block text-sm font-semibold text-slate-700"
                  htmlFor="signup-email">
                  Email
                </label>
                <input
                  autoComplete="email"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  id="signup-email"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </div>
              <div>
                <label
                  className="mb-1.5 block text-sm font-semibold text-slate-700"
                  htmlFor="signup-barangay">
                  Barangay
                </label>
                <select
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:cursor-wait disabled:bg-slate-50"
                  disabled={loadingBarangays || barangays.length === 0}
                  id="signup-barangay"
                  onChange={(event) => setBarangay(event.target.value)}
                  required
                  value={barangay}>
                  <option value="">
                    {loadingBarangays ? "Loading barangays…" : "Select your barangay"}
                  </option>
                  {barangays.map((item) => (
                    <option key={item} value={item}>
                      {item === "Poblacion" ? "Poblacion (Jabonga)" : item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    className="mb-1.5 block text-sm font-semibold text-slate-700"
                    htmlFor="signup-password">
                    Password
                  </label>
                  <input
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    id="signup-password"
                    minLength={8}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    type="password"
                    value={password}
                  />
                </div>
                <div>
                  <label
                    className="mb-1.5 block text-sm font-semibold text-slate-700"
                    htmlFor="signup-password-confirmation">
                    Confirm password
                  </label>
                  <input
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    id="signup-password-confirmation"
                    minLength={8}
                    onChange={(event) =>
                      setPasswordConfirmation(event.target.value)
                    }
                    required
                    type="password"
                    value={passwordConfirmation}
                  />
                </div>
              </div>
              <button
                className="w-full rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-wait disabled:opacity-60"
                disabled={
                  submitting ||
                  googleSubmitting ||
                  loadingBarangays ||
                  barangays.length === 0
                }
                type="submit">
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin" size={17} />
                    Submitting request…
                  </span>
                ) : (
                  "Sign up with system account"
                )}
              </button>
            </form>

            <div className="mt-5 border-t border-slate-100 pt-4 text-center text-sm text-slate-600">
              Already have an account?{" "}
              <button
                className="font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                onClick={onSwitchToSignIn}
                type="button">
                Sign in
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
