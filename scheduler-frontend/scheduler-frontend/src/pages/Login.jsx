import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CalendarClock, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false); // State for eye toggle
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from?.pathname || "/";

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signIn({ email, password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not sign in. Check your email and password.",
      );
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

          {error && (
            <p className="mb-4 text-[13px] text-status-rejected">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-brand py-2 text-[14px] font-medium text-white transition hover:bg-brand-dark disabled:opacity-60">
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-[12px] text-steel">
          Connects to your Laravel API at{" "}
          <code className="font-mono">/api/login</code>
        </p>
      </div>
    </div>
  );
}
