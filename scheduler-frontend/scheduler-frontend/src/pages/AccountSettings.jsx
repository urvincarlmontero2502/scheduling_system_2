import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import * as api from "../api/endpoints";
import {
  Save,
  User,
  Mail,
  MailOpen,
  MapPin,
  Building,
  Lock,
  Shield,
  AlertCircle,
  CheckCircle,
  Camera,
  Trash2,
  KeyRound,
} from "lucide-react";
import { SkeletonAvatar, SkeletonText, Skeleton } from "../components/Skeleton";
import { compressImageFile } from "../utils/imageCompression";

export default function AccountSettings() {
  const { user, refreshUser } = useAuth();
  const [profileLoading, setProfileLoading] = useState(!user);

  useEffect(() => {
    if (!user) {
      refreshUser().finally(() => setProfileLoading(false));
    } else {
      setProfileLoading(false);
    }
  }, [user, refreshUser]);

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
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
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
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    password: "",
    password_confirmation: "",
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

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
      const res = await api.updateUser({
        full_name: formData.full_name,
        barangay: formData.barangay,
        department: formData.department,
      });
      const updatedUser = res.data;
      // Update context with new user data
      localStorage.setItem("auth_user", JSON.stringify(updatedUser));
      await refreshUser();
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

    // Validate file size — allow up to 10MB before compression
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Image file is too large. Maximum size is 10MB.");
      return;
    }

    setUploading(true);
    setUploadError("");
    setUploadSuccess("");

    try {
      // Compress the image client-side to reduce upload size
      const compressedFile = await compressImageFile(file, 1200, 0.85);

      const formData = new FormData();
      formData.append("image", compressedFile);

      const res = await api.updateProfileImage(formData);
      setUploadSuccess("Profile picture updated successfully!");
      // Refresh the user data to get the new image URL
      await refreshUser();
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

  const handlePasswordChange = (field, value) => {
    setPasswordForm((prev) => ({ ...prev, [field]: value }));
    setPasswordError("");
    setPasswordSuccess("");
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (passwordForm.password !== passwordForm.password_confirmation) {
      setPasswordError("The new password and confirmation do not match.");
      return;
    }

    setPasswordLoading(true);
    try {
      const response = await api.updatePassword(passwordForm);
      setPasswordForm({
        current_password: "",
        password: "",
        password_confirmation: "",
      });
      setPasswordSuccess(response?.data?.message || "Password updated successfully.");
    } catch (requestError) {
      setPasswordError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.errors?.current_password?.[0] ||
          requestError?.response?.data?.errors?.password?.[0] ||
          "Could not update your password. Please try again.",
      );
    } finally {
      setPasswordLoading(false);
    }
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
        await refreshUser();
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

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== user?.email) {
      setDeleteError("Please type your email exactly to confirm account deletion.");
      return;
    }

    setDeleting(true);
    setDeleteError("");

    try {
      await api.deleteAccount();
      // Clear all local storage and redirect to login
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      localStorage.removeItem("auth_expires_at");
      localStorage.setItem("google_auth_success", "false");
      // Redirect to login
      window.location.href = "/login";
    } catch (err) {
      console.error("Failed to delete account:", err);
      setDeleteError(
        err.response?.data?.message ||
          "Failed to delete account. Please try again."
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-full bg-slate-50/70 pb-12">
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
        {/* Profile Picture Section */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400" />
          <div className="flex flex-col items-start justify-between gap-5 pt-1 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-blue-50 text-blue-700 ring-4 ring-slate-50">
              {profileLoading ? (
                <SkeletonAvatar size="h-20 w-20" />
              ) : profileImageUrl ? (
                <img
                  src={profileImageUrl}
                  alt={user?.full_name || "User"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <User size={28} />
              )}
              {/* Camera overlay - appears on hover */}
              <button
                type="button"
                aria-label="Change profile picture"
                disabled={uploading || profileLoading}
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 flex cursor-pointer items-center justify-center bg-slate-950/45 text-white opacity-0 transition-opacity hover:opacity-100 focus:opacity-100 disabled:cursor-not-allowed"
              >
                <Camera size={19} />
              </button>
              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
            <div>
              {profileLoading ? (
                <>
                  <SkeletonText lines={1} className="w-40 h-4" />
                  <SkeletonText lines={1} className="w-56 h-3 mt-1" />
                  <SkeletonText lines={1} className="w-24 h-3 mt-1" />
                </>
              ) : (
                <>
                  <p className="text-base font-semibold text-slate-900">
                    {formData.full_name || "Your Name"}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">{formData.email}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium capitalize text-blue-700">
                      <Shield size={13} />
                      {userRole === "admin" ? "Administrator" : userRole.replaceAll("_", " ")}
                    </span>
                    {user?.barangay && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        <MapPin size={12} />
                        {user.barangay}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col items-start gap-2 sm:items-end">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || profileLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <Camera size={15} />
              {uploading ? "Uploading..." : "Update photo"}
            </button>
            {uploadSuccess && <p className="text-xs text-green-600">{uploadSuccess}</p>}
            {uploadError && <p className="text-xs text-rose-600">{uploadError}</p>}
            {uploading && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                Uploading photo
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Form Section */}
        <div className="space-y-5">
          {/* Personal Information */}
          <form id="profile-form" onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-start gap-3 border-b border-slate-100 pb-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <User size={17} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Personal information</h2>
                <p className="mt-0.5 text-xs text-slate-500">Keep your contact and organization details up to date.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
                  <User size={13} className="text-steel" />
                  Full Name
                </label>
                {profileLoading ? (
                  <Skeleton className="h-10 w-full rounded-lg" />
                ) : (
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => handleChange("full_name", e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    placeholder="Enter your full name"
                    disabled={profileLoading}
                  />
                )}
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
                  <Mail size={13} className="text-steel" />
                  Email Address
                </label>
                {profileLoading ? (
                  <Skeleton className="h-10 w-full rounded-lg" />
                ) : (
                  <input
                    type="email"
                    value={formData.email}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600 outline-none"
                    disabled
                    readOnly
                  />
                )}
                {!profileLoading && (
                  <p className="mt-1 text-[11.5px] text-steel">
                    Use Change Email in Security to request a verified email change.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
                  <MapPin size={13} className="text-steel" />
                  Barangay
                </label>
                {profileLoading ? (
                  <Skeleton className="h-10 w-full rounded-lg" />
                ) : (
                  <input
                    type="text"
                    value={formData.barangay}
                    onChange={(e) => handleChange("barangay", e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    placeholder="Enter your barangay"
                    disabled={profileLoading}
                  />
                )}
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
                  <Building size={13} className="text-steel" />
                  Department
                </label>
                {profileLoading ? (
                  <Skeleton className="h-10 w-full rounded-lg" />
                ) : (
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => handleChange("department", e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    placeholder="Enter your department"
                    disabled={profileLoading}
                  />
                )}
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
                  <Shield size={13} className="text-steel" />
                  Role
                </label>
                <div className="flex min-h-[42px] items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm capitalize text-slate-600">
                  {profileLoading
                    ? <Skeleton className="h-4 w-24 rounded" />
                    : userRole === "admin"
                      ? "Administrator"
                      : userRole.replaceAll("_", " ")}
                </div>
                <p className="mt-1 text-[11.5px] text-steel">
                  Contact an administrator if your account role needs to change.
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !hasChanges()}
                className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={15} />
                    Save changes
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Security Section */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-start gap-3 border-b border-slate-100 pb-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <Shield size={17} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Security</h2>
                <p className="mt-0.5 text-xs text-slate-500">Manage your sign-in credentials and email verification.</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Change Password card */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm">
                    <KeyRound size={16} />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-ink">
                      Change Password
                    </p>
                    <p className="text-[11.5px] text-steel">
                      Update your account password
                    </p>
                  </div>
                </div>
                <span className="text-xs text-slate-500">Update it below</span>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-4 rounded-xl border border-slate-200 p-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="current-password">
                    Current password
                  </label>
                  <input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    value={passwordForm.current_password}
                    onChange={(event) => handlePasswordChange("current_password", event.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="new-password">
                      New password
                    </label>
                    <input
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      value={passwordForm.password}
                      onChange={(event) => handlePasswordChange("password", event.target.value)}
                      minLength={8}
                      required
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                    <p className="mt-1 text-xs text-slate-500">Use at least 8 characters.</p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="confirm-new-password">
                      Confirm new password
                    </label>
                    <input
                      id="confirm-new-password"
                      type="password"
                      autoComplete="new-password"
                      value={passwordForm.password_confirmation}
                      onChange={(event) => handlePasswordChange("password_confirmation", event.target.value)}
                      minLength={8}
                      required
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>
                {passwordError && (
                  <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {passwordError}
                  </p>
                )}
                {passwordSuccess && (
                  <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                    {passwordSuccess}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {passwordLoading ? "Updating password..." : "Update password"}
                </button>
              </form>

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
                  {profileLoading ? (
                    <Skeleton className="h-10 w-full rounded-lg" />
                  ) : (
                    <input
                      type="email"
                      value={user?.email || ""}
                      className="w-full rounded-lg border border-line px-3 py-2 text-[13px] text-steel/60 outline-none"
                      disabled
                      readOnly
                    />
                  )}
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

          {/* Delete Account Section */}
          <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3 mb-3">
              <Trash2 size={20} className="text-status-rejected" />
              <h2 className="text-[14px] font-semibold text-status-rejected">
                Delete Account
              </h2>
            </div>
            <p className="text-[13px] text-steel mb-4">
              This action cannot be undone. All your data will be permanently
              deleted. Type your email to confirm.
            </p>

            {deleteError && (
              <div className="flex items-start gap-2 rounded-lg border border-status-rejected/20 bg-status-rejected/10 px-4 py-2.5 mb-3">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-status-rejected" />
                <p className="text-[12.5px] text-status-rejected">{deleteError}</p>
              </div>
            )}

            <input
              type="email"
              value={deleteConfirm}
              onChange={(e) => {
                setDeleteConfirm(e.target.value);
                setDeleteError("");
              }}
              placeholder="Type your email to confirm"
              className="w-full rounded-lg border border-status-rejected/30 px-3 py-2 text-[13px] text-ink outline-none focus:border-status-rejected mb-3"
            />

            <button
              onClick={handleDeleteAccount}
              disabled={deleting || !deleteConfirm}
              className="w-full rounded-lg bg-status-rejected py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-status-rejected/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  Deleting Account...
                </div>
              ) : (
                "Delete My Account"
              )}
            </button>
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

        </div>
      </div>
    </div>
  );
}
