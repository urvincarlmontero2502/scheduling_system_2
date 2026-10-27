import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Clock, CheckCircle, XCircle, FileText } from "lucide-react";

const STATUS_INFO = {
    pending: {
        icon: Clock,
        color: "text-amber-600",
        bg: "bg-amber-100",
        title: "Request Submitted",
        message: "Your registration request has been submitted to the barangay admin and is awaiting approval.",
        detail: "You will receive an email at the address you used to sign up once the admin reviews your request. This typically takes 1-2 business days.",
    },
    approved: {
        icon: CheckCircle,
        color: "text-green-600",
        bg: "bg-green-100",
        title: "Account Approved!",
        message: "Your registration has been approved by the barangay admin.",
        detail: "You can now log in to the system using the button below.",
    },
};

export default function RegistrationStatus() {
    const navigate = useNavigate();
    const location = useLocation();
    const urlParams = new URLSearchParams(location.search);
    const status = urlParams.get("status") || "pending";

    // Check for stored registration status
    const [storedStatus, setStoredStatus] = useState(null);

    useEffect(() => {
        // If navigating away from BarangaySetup, check for registration_submitted flag
        const submitted = localStorage.getItem("registration_submitted");
        if (submitted) {
            setStoredStatus("pending");
            // Clean up the flag so it doesn't show again on refresh
            localStorage.removeItem("registration_submitted");
        }
    }, []);

    const currentStatus = status || storedStatus || "pending";
    const info = STATUS_INFO[currentStatus] || STATUS_INFO.pending;
    const { icon: Icon } = info;


    const handleLoginClick = () => {
        navigate("/login?registration=approved", { replace: true });
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-paper p-4">
            <div className="w-full max-w-md rounded-xl border border-line bg-white p-8 shadow-sm text-center">
                {/* Status Icon */}
                <div className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full ${info.bg}`}>
                    <Icon className={`h-10 w-10 ${info.color}`} />
                </div>

                {/* Title */}
                <h1 className="text-[20px] font-bold text-ink mb-2">{info.title}</h1>

                {/* Status Badge */}
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-6 ${
                    currentStatus === "approved"
                        ? "bg-green-100 text-green-800"
                        : "bg-amber-100 text-amber-800"
                }`}>
                    {currentStatus === "approved" ? "Approved" : "Pending Approval"}
                </span>

                {/* Status Message */}
                <p className="text-[14px] text-steel mb-4">{info.message}</p>
                <p className="text-[13px] text-steel mb-6">{info.detail}</p>

                {/* Action Buttons */}
                <div className="space-y-3">
                    {currentStatus === "approved" ? (
                        <button
                            onClick={handleLoginClick}
                            className="w-full rounded-lg bg-brand py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover"
                        >
                            Log In to Your Account
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={handlePrint}
                                className="w-full rounded-lg border border-line py-2.5 text-[14px] font-medium text-ink hover:bg-paper transition-colors flex items-center justify-center gap-2"
                            >
                                <FileText size={16} />
                                Print Reference
                            </button>
                            <button
                                onClick={() => navigate("/login")}
                                className="w-full rounded-lg bg-paper border border-line py-2.5 text-[14px] font-medium text-steel hover:text-ink transition-colors"
                            >
                                Back to Login
                            </button>
                        </>
                    )}
                </div>

                {/* Footer Note */}
                {currentStatus !== "approved" && (
                    <p className="mt-6 text-[12px] text-steel">
                        You will be redirected to the login page once your account is approved.
                    </p>
                )}
            </div>
        </div>
    );
}
