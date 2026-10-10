import { useState } from "react";
import { X, Mail, AlertCircle, CheckCircle, Loader } from "lucide-react";
import * as api from "../api/endpoints";

export default function ForgotPasswordModal({ isOpen, onClose }) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const res = await api.forgotPassword(email);
      setSuccess(
        res.data.message ||
          "If an account with that email exists, a reset code has been sent."
      );
      // In dev, show the code; in production this would be hidden
      if (res.data.reset_code) {
        setSuccess(
          (prev) =>
            prev +
            ` Your reset code is: ${res.data.reset_code}`
        );
      }
      setEmail("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to send reset code. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        {/* Header */}
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
                Enter your email to receive a reset code
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-steel hover:bg-paper">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-ink">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full rounded-lg border border-line px-3 py-2 text-[13px] text-ink outline-none focus:border-brand"
              placeholder="you@organization.edu"
              required
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-status-rejected/20 bg-status-rejected/10 px-4 py-2.5">
              <AlertCircle
                size={16}
                className="mt-0.5 flex-shrink-0 text-status-rejected"
              />
              <p className="text-[12.5px] text-status-rejected">{error}</p>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5">
              <CheckCircle
                size={16}
                className="mt-0.5 flex-shrink-0 text-green-600"
              />
              <p className="text-[12.5px] text-green-700">{success}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-line px-4 py-2 text-[13px] font-medium text-steel hover:bg-paper">
              Close
            </button>
            <button
              type="submit"
              disabled={submitting || !email}
              className="flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-[13px] font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? (
                <>
                  <Loader size={14} className="animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Reset Code"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
