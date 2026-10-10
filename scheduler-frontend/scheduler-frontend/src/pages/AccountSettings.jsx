import { useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import * as api from "../api/endpoints";
import {
  Save,
  User,
  Mail,
  MailOpen,
  Phone,
  MapPin,
  Building,
  Lock,
  AlertCircle,
  CheckCircle,
  Camera,
  X,
} from "lucide-react";

export default function AccountSettings() {
  const { user, signIn, refreshUser } = useAuth();
  const [formData, setFormData] = useState({
    full_name: user?.full_name || user?.name || "",
    email: user?.email || "",
    barangay: user?.barangay || "",
    department: user?.department || "",
  });
  const [originalData, setOriginalData] = useState({
    full_name: user?.full_name || user?.name || "",
    email: user?.email || "",
    barangay: user?.barangay || "",
    department: user?.department || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const fileInputRef = useRef(null);

  // Resolve the current profile image URL
  const profileImageUrl = user?.profile_image_url || user?.image || user?.profile_image || null;

  // Change Email state
  const [emailForm, setEmailForm] = useState({
    current_password: "",
    email: "",
    email_confirmation: "",
  });
  const [emailLoading, setEmailLoading] = useState(false);
  const [verificationPending, setVerificationPending] = useState(false);

  const hasChanges = () => {
    return (
      formData.full_name !== originalData.full_name ||
      formData.email !== originalData.email ||
      formData.barangay !== originalData.barangay ||
      formData.department !== originalData.department
    );
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hasChanges()) {
      setSuccess("No changes to save.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await api.updateUser(formData);
      const updatedUser = res.data;
      // Update context with new user data
      localStorage.setItem("auth_user", JSON.stringify(updatedUser));
      refreshUser();
      setOriginalData({ ...formData });
      setSuccess("Profile updated successfully!");
    } catch (err) {
      console.error("Failed to update profile:", err);
      setError(
        err.response?.data?.message ||
          err.response?.data?.data?.email?.[0] ||
          "Failed to update profile. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({ ...originalData });
    setError("");
    setSuccess("");
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setUploadError("Please select an image file (JPEG, PNG, GIF, etc.).");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image file is too large. Maximum size is 5MB.");
      return;
    }

    setUploading(true);
    setUploadError("");
    setUploadSuccess("");

    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await api.updateProfileImage(formData);
      setUploadSuccess("Profile picture updated successfully!");
      // Refresh the user data to get the new image URL
      refreshUser();
    } catch (err) {
      console.error("Failed to upload profile image:", err);
      setUploadError(
        err.response?.data?.message ||
          "Failed to upload profile picture. Please try again."
      );
    } finally {
      setUploading(false);
      // Reset file input
      event.target.value = null;
    }
  };

  const handleEmailChange = (field, value) => {
    setEmailForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();

    // Frontend validation: ensure new email matches confirmation
    if (emailForm.email !== emailForm.email_confirmation) {
      setError("New email and confirmation email do not match.");
      return;
    }

    setEmailLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await api.changeEmail(emailForm);
      const response = res.data;

      if (response.verification_required) {
        // Email change initiated — verification email sent
        setVerificationPending(true);
        setSuccess(
          response.message ||
            "A verification email has been sent to your new address. Please check your inbox and click the confirmation link to complete the change."
        );
        // Clear the form fields
        setEmailForm({
          current_password: "",
          email: "",
          email_confirmation: "",
        });
      } else {
        // Email changed instantly (fallback for non-verification flows)
        const updatedUser = response.user || response;
        localStorage.setItem("auth_user", JSON.stringify(updatedUser));
        refreshUser();
        setFormData((prev) => ({ ...prev, email: updatedUser.email }));
        setOriginalData((prev) => ({ ...prev, email: updatedUser.email }));
        setEmailForm({
          current_password: "",
          email: "",
          email_confirmation: "",
        });
        setSuccess(response.message || "Email updated successfully!");
      }
    } catch (err) {
      console.error("Failed to update email:", err);
      setError(
        err.response?.data?.message ||
          err.response?.data?.data?.current_password?.[0] ||
          err.response?.data?.data?.email?.[0] ||
          "Failed to update email. Please try again."
      );
    } finally {
      setEmailLoading(false);
    }
  };

  const userRole = user?.role || "staff";

  return (
    <div className="pb-12">
      {/* Header */}
      <header className="border-b border-line bg-white px-4 sm:px-6 py-4">
        <h1 className="text-[17px] font-semibold">Account Settings</h1>
        <p className="text-[13px] text-steel">
          Manage your profile and account preferences
        </p>
      </header>

      <div className="px-4 sm:px-6 py-6 space-y-6">
        {/* Profile Picture Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-line bg-white p-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand overflow-hidden">
              {profileImageUrl ? (
                <img
                  src={profileImageUrl}
                  alt={user?.full_name || "User"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <User size={28} />
              )}
              {/* Camera overlay - appears on hover */}
              <div
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30 opacity-0 transition-opacity hover:opacity-100 cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera size={18} className="text-white" />
              </div>
              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                capture="user"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
            <div>
              <p className="text-[14px] font-medium text-ink">
                {formData.full_name || "Your Name"}
              </p>
              <p className="text-[13px] text-steel">{formData.email}</p>
              <p className="text-[12px] text-steel capitalize">
                Role: {userRole === "admin" ? "Administrator" : userRole}
              </p>
              {uploadSuccess && (
                <p className="mt-1 text-[12px] text-green-600">{uploadSuccess}</p>
              )}
              {uploadError && (
                <p className="mt-1 text-[12px] text-status-rejected">{uploadError}</p>
              )}
            </div>
          </div>

          {/* Upload status indicator */}
          {uploading && (
            <div className="flex items-center gap-2 text-[13px] text-steel">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent"></div>
              Uploading...
            </div>
          )}
        </div>

        {/* Form Section */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Information */}
          <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-[14px] font-semibold text-ink">
              Personal Information
            </h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
                  <User size={13} className="text-steel" />
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => handleChange("full_name", e.target.value)}
                  className="w-full rounded-lg border border-line px-3 py-2 text-[13px] text-ink outline-none focus:border-brand"
                  placeholder="Enter your full name"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
                  <Mail size={13} className="text-steel" />
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  className="w-full rounded-lg border border-line px-3 py-2 text-[13px] text-ink outline-none focus:border-brand"
                  placeholder="Enter your email"
                  disabled={userRole === "admin"}
                />
                {userRole === "admin" && (
                  <p className="mt-1 text-[11.5px] text-steel">
                    To change your email, use the Change Email form in the Security section below.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
                  <MapPin size={13} className="text-steel" />
                  Barangay
                </label>
                <input
                  type="text"
                  value={formData.barangay}
                  onChange={(e) => handleChange("barangay", e.target.value)}
                  className="w-full rounded-lg border border-line px-3 py-2 text-[13px] text-ink outline-none focus:border-brand"
                  placeholder="Enter your barangay"
                />
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
                  <Building size={13} className="text-steel" />
                  Department
                </label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => handleChange("department", e.target.value)}
                  className="w-full rounded-lg border border-line px-3 py-2 text-[13px] text-ink outline-none focus:border-brand"
                  placeholder="Enter your department"
                />
              </div>
            </div>
          </div>

          {/* Security Section */}
          <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-[14px] font-semibold text-ink">
              Security
            </h2>

            <div className="space-y-4">
              {/* Change Password card */}
              <div className="flex items-center justify-between rounded-lg border border-line bg-paper/30 p-3">
                <div className="flex items-center gap-3">
                  <Lock size={16} className="text-steel" />
                  <div>
                    <p className="text-[13px] font-medium text-ink">
                      Change Password
                    </p>
                    <p className="text-[11.5px] text-steel">
                      Update your account password
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    alert("Password change feature coming soon!")
                  }
                  className="rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-steel hover:bg-paper">
                  Change
                </button>
              </div>

              {/* Change Email form */}
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail size={16} className="text-steel" />
                  <h3 className="text-[13px] font-medium text-ink">
                    Change Email Address
                  </h3>
                </div>

                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
                    Current Email
                  </label>
                  <input
                    type="email"
                    value={user?.email || ""}
                    className="w-full rounded-lg border border-line px-3 py-2 text-[13px] text-steel/60 outline-none"
                    disabled
                    readOnly
                  />
                </div>

                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
                    New Email
                  </label>
                  <input
                    type="email"
                    value={emailForm.email}
                    onChange={(e) => handleEmailChange("email", e.target.value)}
                    autoComplete="new-email"
                    className="w-full rounded-lg border border-line px-3 py-2 text-[13px] text-ink outline-none focus:border-brand"
                    placeholder="Enter your new email"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
                    Confirm New Email
                  </label>
                  <input
                    type="email"
                    value={emailForm.email_confirmation}
                    onChange={(e) =>
                      handleEmailChange("email_confirmation", e.target.value)
                    }
                    autoComplete="new-email"
                    className="w-full rounded-lg border border-line px-3 py-2 text-[13px] text-ink outline-none focus:border-brand"
                    placeholder="Confirm your new email"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
                    <Lock size={13} className="text-steel" />
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={emailForm.current_password}
                    onChange={(e) =>
                      handleEmailChange("current_password", e.target.value)
                    }
                    autoComplete="new-password"
                    className="w-full rounded-lg border border-line px-3 py-2 text-[13px] text-ink outline-none focus:border-brand"
                    placeholder="Enter your current password"
                    required
                  />
                  <p className="mt-1 text-[11.5px] text-steel">
                    Enter your password to confirm this change
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={emailLoading}
                  className="flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-[13px] font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50">
                  {emailLoading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Updating...
                    </>
                  ) : (
                    "Update Email"
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Error/Success Messages */}
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
              {verificationPending ? (
                <MailOpen
                  size={16}
                  className="mt-0.5 flex-shrink-0 text-green-600"
                />
              ) : (
                <CheckCircle
                  size={16}
                  className="mt-0.5 flex-shrink-0 text-green-600"
                />
              )}
              <p className="text-[12.5px] text-green-700">{success}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 border-t border-line pt-4">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg border border-line px-4 py-2 text-[13px] font-medium text-steel hover:bg-paper">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !hasChanges()}
              className="flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-[13px] font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={15} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
