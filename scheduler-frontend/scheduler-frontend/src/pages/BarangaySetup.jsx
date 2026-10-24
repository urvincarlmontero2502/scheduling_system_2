import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../api/endpoints";
import { useAuth } from "../context/AuthContext";

const FALLBACK_BARANGAYS = [
  "A. Beltran",
  "Baleguian",
  "Bangonay",
  "Bunga",
  "Colorado",
  "Cuyago",
  "Libas",
  "Magdagooc",
  "Magsaysay",
  "Maraiging",
  "Poblacion",
  "San Jose",
  "San Pablo",
  "San Vicente",
  "Santo Nino",
];

export default function BarangaySetup() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [barangays, setBarangays] = useState(FALLBACK_BARANGAYS);
  const [selectedBarangay, setSelectedBarangay] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // For the registration flow, we need a temporary token, not a regular auth token
  const registrationToken = localStorage.getItem("google_registration_token");
  const hasAuthToken = localStorage.getItem("auth_token");

  useEffect(() => {
    // If no auth token or registration token, redirect to login
    if (!registrationToken && !hasAuthToken) {
      navigate("/login");
      return;
    }

    // Always fetch barangays from API
    api
      .getBarangays()
      .then((res) => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          setBarangays(res.data.map((b) => b.name));
        }
      })
      .catch(() => {});

    // If existing user, try to restore their previously selected barangay
    if (hasAuthToken) {
      api
        .fetchCurrentUser()
        .then((userRes) => {
          if (userRes.data.barangay) {
            setSelectedBarangay(userRes.data.barangay);
          }
        })
        .catch(() => {});
    }
  }, [navigate, registrationToken, hasAuthToken]);

  const handleSubmit = async () => {
    if (!selectedBarangay) {
      setError("Please select a barangay.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (registrationToken) {
        // New user completing registration — creates a PENDING registration request
        const res = await api.completeGoogleRegistration(
          registrationToken,
          selectedBarangay
        );

        // Clean up the temporary registration token
        localStorage.removeItem("google_registration_token");
        localStorage.setItem("registration_submitted", "true");

        // Redirect to login with a message about pending approval
        navigate("/login?registration=pending");
      } else {
        // Existing user updating their barangay
        await api.updateUser({ barangay: selectedBarangay });
        try {
          await refreshUser();
        } catch {}
        navigate("/");
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to submit registration request. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-4">
      <div className="w-full max-w-md rounded-xl border border-line bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10">
            <svg
              className="h-8 w-8 text-brand"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.25 12h-.75v-.75h-3.75v3h3.75V12M9 12V9a3 3 0 013-3h.75a.75.75 0 01.75.75V12m-3 0v3.75a.75.75 0 001.5 0V12m-1.5 0H9z"
              />
            </svg>
          </div>

          <h2 className="text-[18px] font-semibold text-ink">
            Select Your Barangay
          </h2>
          <p className="text-[13px] text-steel">
            Please select your barangay to complete your profile setup.
            {registrationToken && (
              <span className="block mt-2 text-xs text-amber-600">
                Your account will need approval from the barangay admin before
                you can log in.
              </span>
            )}
          </p>
        </div>

        <div className="mt-6 space-y-2">
          {barangays.map((brgy) => (
            <label
              key={brgy}
              className="flex items-center gap-3 rounded-lg border border-line p-3 cursor-pointer transition-colors"
            >
              <input
                type="radio"
                name="barangay"
                value={brgy}
                checked={selectedBarangay === brgy}
                onChange={(e) => setSelectedBarangay(e.target.value)}
                className="h-4 w-4 text-brand focus:ring-brand"
              />
              <span className="text-[14px] text-ink">{brgy}</span>
            </label>
          ))}
        </div>

        {error && (
          <p className="mt-4 text-[13px] text-status-rejected">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !selectedBarangay}
          className="mt-6 w-full rounded-lg bg-brand py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
        >
          {loading
            ? "Submitting..."
            : registrationToken
              ? "Submit Registration Request"
              : "Save Barangay"}
        </button>
      </div>
    </div>
  );
}
