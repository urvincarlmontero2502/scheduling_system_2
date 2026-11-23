import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, Loader2, LogOut, ShieldCheck } from "lucide-react";
import * as api from "../api/endpoints";
import { useAuth } from "../context/AuthContext";
import jabongaLogo from "../assets/jabonga-logo.png";

export default function SetPassword() {
  const { user, refreshUser, signOut } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("The password and confirmation do not match.");
      return;
    }

    setSaving(true);
    try {
      await api.updatePassword({
        password,
        password_confirmation: confirmation,
      });
      await refreshUser();
      navigate("/", { replace: true });
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.errors?.password?.[0] ||
          "Could not save your password. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch {
      setError("Could not sign out. Please try again.");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper p-4">
      <section className="w-full max-w-md rounded-xl border border-line bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <img
            src={jabongaLogo}
            alt="Municipality of Jabonga logo"
            className="h-14 w-14 object-contain"
          />
          <div className="mt-4 flex h-11 w-11 items-center justify-center rounded-full bg-brand/10 text-brand">
            <KeyRound size={21} />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-ink">
            Create a password
          </h1>
          <p className="mt-2 text-sm leading-6 text-steel">
            Set a password for {user?.email || "your account"} so you can sign
            in with your email if Google sign-in is unavailable.
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-steel">
            <ShieldCheck size={14} />
            Use at least 8 characters.
          </p>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-ink"
              htmlFor="initial-password"
            >
              New password
            </label>
            <input
              autoComplete="new-password"
              className="w-full rounded-lg border border-line px-3.5 py-3 text-sm focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
              id="initial-password"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </div>
          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-ink"
              htmlFor="initial-password-confirmation"
            >
              Confirm new password
            </label>
            <input
              autoComplete="new-password"
              className="w-full rounded-lg border border-line px-3.5 py-3 text-sm focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
              id="initial-password-confirmation"
              minLength={8}
              onChange={(event) => setConfirmation(event.target.value)}
              required
              type="password"
              value={confirmation}
            />
          </div>
          {error && (
            <p
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700"
              role="alert"
            >
              {error}
            </p>
          )}
          <button
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saving}
            type="submit"
          >
            {saving ? (
              <>
                <Loader2 className="animate-spin" size={17} />
                Saving password...
              </>
            ) : (
              "Save password"
            )}
          </button>
        </form>

        <button
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-steel hover:bg-paper"
          onClick={handleSignOut}
          type="button"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </section>
    </main>
  );
}
