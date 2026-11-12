import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../api/endpoints";
import { useAuth } from "../context/AuthContext";
import { AlertCircle, Check, ChevronDown, Loader2 } from "lucide-react";
import jabongaLogo from "../assets/jabonga-logo.png";

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
  const [barangayMenuOpen, setBarangayMenuOpen] = useState(false);
  const barangayDropdownRef = useRef(null);
  const barangayTriggerRef = useRef(null);

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

  useEffect(() => {
    if (!barangayMenuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!barangayDropdownRef.current?.contains(event.target)) {
        setBarangayMenuOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setBarangayMenuOpen(false);
        barangayTriggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [barangayMenuOpen]);

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

        // Redirect to registration status page (thank you / pending approval)
        navigate("/registration-status?status=pending");
      } else {
        // Existing user updating their barangay
        await api.updateUser({ barangay: selectedBarangay });
        try {
          await refreshUser();
        } catch {}
        navigate("/");
      }
    } catch (err) {
      let errorMsg =
        err.response?.data?.message ||
        "Failed to submit registration request. Please try again.";

      // Include error details if the server provides them
      const errorDetail = err.response?.data?.error_detail;
      if (errorDetail) {
        errorMsg += `\nDetails: ${errorDetail}`;
      }

      // Also include raw response info for debugging if available
      if (!err.response) {
        errorMsg += "\nNetwork error — please check your connection.";
      }

      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (registrationToken) {
      localStorage.removeItem("google_registration_token");
      navigate("/login", { replace: true });
      return;
    }

    navigate("/");
  };

  const getBarangayLabel = (barangay) =>
    barangay === "Poblacion" ? "Poblacion (Jabonga)" : barangay;

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-4">
      <div className="w-full max-w-md rounded-xl border border-line bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center gap-4 text-center">
          <img
            src={jabongaLogo}
            alt="Municipality of Jabonga logo"
            className="h-16 w-16 object-contain"
          />

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

        <div className="mt-6">
          <label className="mb-1.5 block text-left text-[13px] font-medium text-ink">
            Barangay
          </label>
          <div className="relative" ref={barangayDropdownRef}>
            <button
              ref={barangayTriggerRef}
              id="barangay"
              type="button"
              aria-haspopup="listbox"
              aria-expanded={barangayMenuOpen}
              aria-controls="barangay-options"
              disabled={loading}
              onClick={() => setBarangayMenuOpen((isOpen) => !isOpen)}
              className={`flex w-full items-center justify-between rounded-lg border bg-white px-3.5 py-3 text-left text-[14px] transition-all focus:outline-none focus:ring-4 focus:ring-brand/10 disabled:cursor-not-allowed disabled:opacity-60 ${
                barangayMenuOpen
                  ? "border-brand ring-4 ring-brand/10"
                  : "border-line hover:border-slate-300"
              }`}
            >
              <span className={selectedBarangay ? "text-ink" : "text-slate-400"}>
                {selectedBarangay
                  ? getBarangayLabel(selectedBarangay)
                  : "Select your barangay"}
              </span>
              <ChevronDown
                size={18}
                className={`text-slate-500 transition-transform ${barangayMenuOpen ? "rotate-180" : ""}`}
              />
            </button>

            {barangayMenuOpen && (
              <div
                id="barangay-options"
                role="listbox"
                aria-label="Barangay options"
                className="absolute left-0 right-0 top-full z-20 mt-2 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10 ring-1 ring-black/5"
              >
                {barangays.map((brgy) => {
                  const isSelected = selectedBarangay === brgy;
                  return (
                    <button
                      key={brgy}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        setSelectedBarangay(brgy);
                        setError("");
                        setBarangayMenuOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[13px] transition-colors ${
                        isSelected
                          ? "bg-blue-50 font-semibold text-brand"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {getBarangayLabel(brgy)}
                      {isSelected && <Check size={16} className="text-brand" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-left"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600" />
            <p className="whitespace-pre-wrap text-[13px] text-red-700">
              {error}
            </p>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="min-h-10 flex-1 whitespace-nowrap rounded-lg border border-line bg-white px-3 py-2 text-[13px] font-semibold text-steel transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !selectedBarangay}
            className="min-h-10 flex-1 whitespace-nowrap rounded-lg bg-brand px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                {registrationToken ? "Submitting..." : "Saving..."}
              </span>
            ) : registrationToken ? (
              "Submit Request"
            ) : (
              "Save Barangay"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
