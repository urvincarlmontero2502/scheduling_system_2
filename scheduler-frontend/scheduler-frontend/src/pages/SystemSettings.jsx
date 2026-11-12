import { useEffect, useState } from "react";
import { AlertCircle, Bell, CheckCircle, Clock3, Save } from "lucide-react";
import * as api from "../api/endpoints";
import { useAuth } from "../context/AuthContext";

const REMINDER_OPTIONS = [
  { days: 1, title: "1 day before" },
  { days: 3, title: "3 days before" },
  { days: 5, title: "5 days before" },
];

export default function SystemSettings() {
  const { user } = useAuth();
  const [daysBefore, setDaysBefore] = useState(1);
  const [savedDaysBefore, setSavedDaysBefore] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (user?.role !== "admin") {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    let active = true;

    api.fetchBookingReminderSettings()
      .then(({ data }) => {
        if (active) {
          setDaysBefore(data.days_before);
          setSavedDaysBefore(data.days_before);
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              "Could not load booking reminder settings.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user?.role]);

  const saveSettings = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const { data } = await api.updateBookingReminderSettings(daysBefore);
      setDaysBefore(data.days_before);
      setSavedDaysBefore(data.days_before);
      setSuccess("Reminder setting saved.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Could not save the reminder setting. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== "admin") {
    return (
      <section className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-white p-6 text-red-700">
        You do not have permission to change system settings.
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-brand-light p-3 text-brand-dark">
            <Bell size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">
              Notifications
            </p>
            <h2 className="text-lg font-semibold text-slate-900">
              Booking email reminders
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Choose how early to email a reminder for approved bookings. This
              setting applies across the system.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {REMINDER_OPTIONS.map((option) => (
            <button
              key={option.days}
              type="button"
              disabled={loading || saving}
              onClick={() => {
                setDaysBefore(option.days);
                setError("");
                setSuccess("");
              }}
              aria-pressed={daysBefore === option.days}
              className={`rounded-xl border p-4 text-left transition ${
                daysBefore === option.days
                  ? "border-brand bg-brand-light text-brand-dark ring-2 ring-brand/20"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <span className="block font-semibold">{option.title}</span>
              <span className="mt-1 block text-xs text-slate-500">
                Before the booking starts
              </span>
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
          <Clock3 size={18} className="mt-0.5 shrink-0 text-slate-500" />
          <p>
            Reminder emails are sent at <strong>9:00 AM Philippine time</strong>.
            Only approved bookings with a valid email address are included.
          </p>
        </div>

        {error && (
          <p role="alert" className="mt-4 flex items-start gap-2 text-sm text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="mt-4 flex items-center gap-2 text-sm text-green-700">
            <CheckCircle size={18} />
            {success}
          </p>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={saveSettings}
            disabled={loading || saving || daysBefore === savedDaysBefore}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? "Saving..." : "Save reminder setting"}
          </button>
        </div>
      </div>
    </section>
  );
}
