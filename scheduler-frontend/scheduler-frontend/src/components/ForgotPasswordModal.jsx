import { useState } from "react";
import { X, Mail, AlertCircle, CheckCircle, Loader } from "lucide-react";
import * as api from "../api/endpoints";

export default function ForgotPasswordModal({ isOpen, onClose }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      if (!codeSent) {
        const response = await api.forgotPassword(email);
        setCodeSent(true);
        setSuccess(
          response.data.message ||
            "If an account with that email exists, a reset code has been sent.",
        );
        return;
      }

      if (password !== passwordConfirmation) {
        setError("The new password and confirmation do not match.");
        return;
      }

      const response = await api.resetPassword({
        email,
        code: code.trim(),
        password,
        password_confirmation: passwordConfirmation,
      });
      setResetComplete(true);
      setSuccess(response.data.message || "Password reset successfully.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Could not reset the password. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Mail size={20} />
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-ink">
                Reset Password
              </h2>
              <p className="text-[12px] text-steel">
                {codeSent
                  ? "Enter the code from your email and choose a new password."
                  : "Enter your email to receive a reset code."}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-steel hover:bg-paper"
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              className="mb-1.5 block text-[12.5px] font-medium text-ink"
              htmlFor="reset-email"
            >
              Email Address
            </label>
            <input
              autoComplete="email"
              className="w-full rounded-lg border border-line px-3 py-2 text-[13px] text-ink outline-none focus:border-brand disabled:bg-paper"
              disabled={codeSent}
              id="reset-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@organization.edu"
              required
              type="email"
              value={email}
            />
          </div>

          {codeSent && !resetComplete && (
            <>
              <div>
                <label
                  className="mb-1.5 block text-[12.5px] font-medium text-ink"
                  htmlFor="reset-code"
                >
                  Six-digit reset code
                </label>
                <input
                  autoComplete="one-time-code"
                  className="w-full rounded-lg border border-line px-3 py-2 text-[13px] text-ink outline-none focus:border-brand"
                  id="reset-code"
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => {
                    setCode(event.target.value.replace(/\D/g, ""));
                    setError("");
                  }}
                  pattern="[0-9]{6}"
                  required
                  value={code}
                />
              </div>
              <div>
                <label
                  className="mb-1.5 block text-[12.5px] font-medium text-ink"
                  htmlFor="reset-new-password"
                >
                  New password
                </label>
                <input
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-line px-3 py-2 text-[13px] text-ink outline-none focus:border-brand"
                  id="reset-new-password"
                  minLength={8}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
                <p className="mt-1 text-[12px] text-steel">
                  Use at least 8 characters.
                </p>
              </div>
              <div>
                <label
                  className="mb-1.5 block text-[12.5px] font-medium text-ink"
                  htmlFor="reset-password-confirmation"
                >
                  Confirm new password
                </label>
                <input
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-line px-3 py-2 text-[13px] text-ink outline-none focus:border-brand"
                  id="reset-password-confirmation"
                  minLength={8}
                  onChange={(event) =>
                    setPasswordConfirmation(event.target.value)
                  }
                  required
                  type="password"
                  value={passwordConfirmation}
                />
              </div>
            </>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-status-rejected/20 bg-status-rejected/10 px-4 py-2.5">
              <AlertCircle
                size={16}
                className="mt-0.5 flex-shrink-0 text-status-rejected"
              />
              <p className="text-[12.5px] text-status-rejected">{error}</p>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5">
              <CheckCircle
                size={16}
                className="mt-0.5 flex-shrink-0 text-green-600"
              />
              <p className="text-[12.5px] text-green-700">{success}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-line px-4 py-2 text-[13px] font-medium text-steel hover:bg-paper"
            >
              {resetComplete ? "Done" : "Close"}
            </button>
            {!resetComplete && (
              <button
                type="submit"
                disabled={
                  submitting ||
                  !email ||
                  (codeSent &&
                    (!/^\d{6}$/.test(code) ||
                      password.length < 8 ||
                      !passwordConfirmation))
                }
                className="flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-[13px] font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader size={14} className="animate-spin" />
                    {codeSent ? "Resetting..." : "Sending..."}
                  </>
                ) : codeSent ? (
                  "Reset Password"
                ) : (
                  "Send Reset Code"
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
