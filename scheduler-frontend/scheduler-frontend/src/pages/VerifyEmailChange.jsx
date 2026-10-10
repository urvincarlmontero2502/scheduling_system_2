import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import * as api from "../api/endpoints";
import { useAuth } from "../context/AuthContext";
import { CheckCircle, AlertCircle, Loader } from "lucide-react";

export default function VerifyEmailChange() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Invalid or missing verification token.");
      return;
    }

    const verify = async () => {
      try {
        const res = await api.verifyEmailChange(token);
        // Update the user context with refreshed data
        localStorage.setItem("auth_user", JSON.stringify(res.data.user));
        await refreshUser();
        setStatus("success");
        setMessage(
          res.data.message || "Your email has been verified and updated."
        );
      } catch (err) {
        setStatus("error");
        setMessage(
          err.response?.data?.message ||
            "The verification link is invalid or has expired. Please request a new email change."
        );
      }
    };

    verify();
  }, [token, refreshUser]);

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
                Verifying your email...
              </h2>
              <p className="text-[13px] text-steel">
                Please wait while we verify your email change request.
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle size={28} className="text-green-600" />
              </div>
              <h2 className="text-[18px] font-semibold text-ink">
                Email Verified Successfully!
              </h2>
              <p className="text-[13px] text-steel">{message}</p>
              <button
                onClick={() => navigate("/account-settings")}
                className="mt-2 rounded-lg bg-brand px-4 py-2 text-[13px] font-medium text-white hover:bg-brand-dark">
                Go to Account Settings
              </button>
            </>
          )}

          {status === "error" && (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-status-rejected/10">
                <AlertCircle size={28} className="text-status-rejected" />
              </div>
              <h2 className="text-[18px] font-semibold text-ink">
                Verification Failed
              </h2>
              <p className="text-[13px] text-steel">{message}</p>
              <button
                onClick={() => navigate("/account-settings")}
                className="mt-2 rounded-lg border border-line px-4 py-2 text-[13px] font-medium text-steel hover:bg-paper">
                Back to Account Settings
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
