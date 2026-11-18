import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import * as api from "../api/endpoints";
import { useAuth } from "../context/AuthContext";
import { Loader, AlertCircle, CheckCircle } from "lucide-react";

export default function GoogleCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [message, setMessage] = useState(
    "Completing Google authentication..."
  );

  // Guard against double invocation — authorization codes are single-use.
  // React 18 StrictMode and re-renders can cause the effect to fire twice.
  const hasAttempted = useRef(false);

  useEffect(() => {
    if (hasAttempted.current) return;
    hasAttempted.current = true;

    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const state = searchParams.get("state");
    const expectedState = sessionStorage.getItem("google_oauth_state");
    sessionStorage.removeItem("google_oauth_state");

    if (!state || !expectedState || state !== expectedState) {
      setStatus("error");
      setMessage("The Google sign-in request could not be verified. Please try again.");
      localStorage.setItem("google_auth_success", "false");
      return;
    }

    if (error) {
      setStatus("error");
      setMessage(
        searchParams.get("error_description") ||
          "Google could not complete authentication. Please try again."
      );
      localStorage.setItem("google_auth_success", "false");
      return;
    }

    if (!code) {
      setStatus("error");
      setMessage(
        "Google did not return an authorization code. Please start sign-in again."
      );
      localStorage.setItem("google_auth_success", "false");
      return;
    }

    // Exchange the code for tokens
    api
      .googleCallback(code, state)
      .then(async (res) => {
        if (res.data.requires_barangay_setup) {
          // New user — redirect to two-step registration
          setStatus("success");
          setMessage("Google authenticated! Please select your barangay to continue.");
          setTimeout(() => navigate("/register/barangay?google-registration=1"), 1500);
        } else {
          // Existing user — full login
          localStorage.setItem("google_auth_success", "true");

          await refreshUser();

          setStatus("success");
          setMessage("Successfully signed in with Google!");
          setTimeout(() => navigate("/"), 1500);
        }
      })
      .catch((err) => {
        console.error("Google callback error:", err);
        setStatus("error");
        setMessage(
          err.response?.data?.message ||
            (err.response
              ? "Google sign-in could not be completed. Please try again."
              : "Could not reach the sign-in service. Check your connection and try again.")
        );
        if (err.response?.data?.error_detail) {
          console.error("Error details:", err.response.data.error_detail);
        }
        localStorage.setItem("google_auth_success", "false");
      });
  }, [searchParams, navigate, refreshUser]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-4">
      <div className="w-full max-w-md rounded-xl border border-line bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center gap-4 text-center">
          {status === "loading" && (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10">
                <Loader size={28} className="animate-spin text-brand" />
              </div>
              <h2 className="text-[18px] font-semibold text-ink">
                Signing in...
              </h2>
              <p className="text-[13px] text-steel">{message}</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle size={28} className="text-green-600" />
              </div>
              <h2 className="text-[18px] font-semibold text-ink">
                Success!
              </h2>
              <p className="text-[13px] text-steel">{message}</p>
            </>
          )}

          {status === "error" && (
            <>
              <div
                role="alert"
                className="w-full rounded-lg border border-red-200 bg-red-50 p-4 text-left"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle size={22} className="mt-0.5 shrink-0 text-red-600" />
                  <div>
                    <h2 className="text-[15px] font-semibold text-red-800">
                      Sign-in or registration could not be completed
                    </h2>
                    <p className="mt-1 text-[13px] text-red-700">{message}</p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate("/login", { replace: true })}
                className="w-full rounded-lg bg-brand px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover"
              >
                Return to sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
