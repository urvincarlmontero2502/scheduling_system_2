import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import * as api from "../api/endpoints";
import { Loader, AlertCircle, CheckCircle } from "lucide-react";

export default function GoogleCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [message, setMessage] = useState(
    "Completing Google authentication..."
  );

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      setStatus("error");
      setMessage("Google authentication was denied or failed.");
      localStorage.setItem("google_auth_success", "false");
      setTimeout(() => navigate("/login"), 3000);
      return;
    }

    if (!code) {
      setStatus("error");
      setMessage("Authorization code not found.");
      localStorage.setItem("google_auth_success", "false");
      setTimeout(() => navigate("/login"), 3000);
      return;
    }

    // Exchange the code for tokens
    api
      .googleCallback(code)
      .then((res) => {
        const { token, user: signInUser, expires_at } = res.data;
        localStorage.setItem("auth_token", token);
        localStorage.setItem("auth_user", JSON.stringify(signInUser));
        if (expires_at) {
          localStorage.setItem("auth_expires_at", expires_at);
        }
        localStorage.setItem("google_auth_success", "true");
        setStatus("success");
        setMessage("Successfully signed in with Google!");
        setTimeout(() => navigate("/"), 1500);
      })
      .catch((err) => {
        console.error("Google callback error:", err);
        setStatus("error");
        setMessage(
          err.response?.data?.message ||
            "Google authentication failed. Please try again."
        );
        localStorage.setItem("google_auth_success", "false");
        setTimeout(() => navigate("/login"), 3000);
      });
  }, [searchParams, navigate]);

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
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-status-rejected/10">
                <AlertCircle size={28} className="text-status-rejected" />
              </div>
              <h2 className="text-[18px] font-semibold text-ink">
                Authentication Failed
              </h2>
              <p className="text-[13px] text-steel">{message}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
