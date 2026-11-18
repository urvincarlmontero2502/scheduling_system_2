import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import * as api from "../api/endpoints";
import { useToast } from "./Toast";
import ConfirmModal from "./ConfirmModal";

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function emptyForm() {
  const date = localDateString();
  return { name: "", start_date: date, end_date: date, resource_ids: [] };
}

function recurringDateLabel(template) {
  const start = new Date(`${template.start_date}T00:00:00`);
  const end = new Date(`${template.end_date}T00:00:00`);
  const format = (date) =>
    date.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
  const dateRange = format(start) === format(end)
    ? format(start)
    : `${format(start)}–${format(end)}`;

  return `${dateRange} every year from ${template.start_year}`;
}

export default function SpecialEventsEditorModal({ open, onClose }) {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const [templates, setTemplates] = useState([]);
  const [resources, setResources] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [templateResponse, resourceResponse] = await Promise.all([
        api.fetchSpecialEventTemplates(),
        api.fetchResources(),
      ]);
      setTemplates(templateResponse.data || []);
      setResources(resourceResponse.data || []);
    } catch (error) {
      toastRef.current.error(
        error?.response?.data?.message || "Unable to load special events.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadData();
  }, [loadData, open]);

  if (!open) return null;

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  const editTemplate = (template) => {
    const activeResourceIds = new Set(
      resources.map((resource) => String(resource.resource_id)),
    );
    setEditingId(template.id);
    setForm({
      name: template.name,
      start_date: template.start_date,
      end_date: template.end_date,
      resource_ids: (template.resource_ids || [])
        .map(String)
        .filter((id) => activeResourceIds.has(id)),
    });
  };

  const toggleResource = (resourceId) => {
    const id = String(resourceId);
    setForm((current) => ({
      ...current,
      resource_ids: current.resource_ids.includes(id)
        ? current.resource_ids.filter((selectedId) => selectedId !== id)
        : [...current.resource_ids, id],
    }));
  };

  const saveTemplate = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        resource_ids: form.resource_ids.map(Number),
      };
      if (editingId) {
        await api.updateSpecialEventTemplate(editingId, payload);
        toast.success("Recurring special event updated.");
      } else {
        await api.createSpecialEventTemplate(payload);
        toast.success("Recurring special event added.");
      }
      await loadData();
      resetForm();
    } catch (error) {
      toast.error(
        error?.response?.data?.errors?.resource_ids?.[0] ||
          error?.response?.data?.errors?.end_date?.[0] ||
          error?.response?.data?.message ||
          "Unable to save this special event.",
      );
    } finally {
      setSaving(false);
    }
  };

  const removeTemplate = async () => {
    if (!deleteCandidate) return;
    try {
      await api.deleteSpecialEventTemplate(deleteCandidate.id);
      toast.success("Recurring special event removed.");
      if (editingId === deleteCandidate.id) resetForm();
      setDeleteCandidate(null);
      await loadData();
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Unable to remove this special event.",
      );
      setDeleteCandidate(null);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="special-events-editor-title"
          className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        >
          <header className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-purple-700">
                <Sparkles size={14} />
                Calendar settings
              </p>
              <h2
                id="special-events-editor-title"
                className="mt-1 text-lg font-semibold text-slate-900"
              >
                Recurring special events
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Events repeat every year from the selected start year.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close special events editor"
              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              <X size={18} />
            </button>
          </header>

          <div className="grid min-h-0 gap-5 overflow-y-auto p-5 md:grid-cols-[1fr_1.1fr]">
            <form onSubmit={saveTemplate} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">
                  {editingId ? "Edit event" : "Add event"}
                </h3>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800"
                  >
                    Cancel edit
                  </button>
                )}
              </div>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-700">
                  Event name
                </span>
                <input
                  required
                  maxLength={255}
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="e.g. Municipal Foundation Day"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-slate-700">
                    First date
                  </span>
                  <input
                    required
                    type="date"
                    value={form.start_date}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        start_date: event.target.value,
                        end_date:
                          current.end_date < event.target.value
                            ? event.target.value
                            : current.end_date,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-slate-700">
                    Last date
                  </span>
                  <input
                    required
                    type="date"
                    min={form.start_date}
                    value={form.end_date}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        end_date: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                  />
                </label>
              </div>
              <p className="text-[11px] leading-relaxed text-purple-700">
                <CalendarDays size={13} className="mr-1 inline" />
                The month and day repeat annually, starting in the first date&apos;s year.
              </p>

              <fieldset className="space-y-2">
                <legend className="text-xs font-medium text-slate-700">
                  Reserved resources
                </legend>
                <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                  {resources.length === 0 ? (
                    <p className="p-2 text-xs text-slate-500">
                      No active resources are available.
                    </p>
                  ) : (
                    resources.map((resource) => (
                      <label
                        key={resource.resource_id}
                        className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={form.resource_ids.includes(
                            String(resource.resource_id),
                          )}
                          onChange={() => toggleResource(resource.resource_id)}
                          className="mt-0.5 accent-purple-700"
                        />
                        <span>
                          <span className="font-medium">{resource.name}</span>
                          {resource.description && (
                            <span className="block text-[10px] text-slate-500">
                              {resource.description}
                            </span>
                          )}
                        </span>
                      </label>
                    ))
                  )}
                </div>
                {form.resource_ids.length === 0 && (
                  <p className="text-[11px] text-rose-600">
                    Select at least one resource.
                  </p>
                )}
              </fieldset>

              <button
                type="submit"
                disabled={saving || form.resource_ids.length === 0}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-purple-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {editingId ? <Pencil size={15} /> : <Plus size={16} />}
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Save recurring event"
                    : "Add recurring event"}
              </button>
            </form>

            <section aria-label="Configured recurring events" className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">
                Events ({templates.length})
              </h3>
              {loading ? (
                <p className="rounded-xl border border-slate-100 p-4 text-xs text-slate-500">
                  Loading events...
                </p>
              ) : templates.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 p-4 text-xs text-slate-500">
                  No recurring special events have been configured.
                </p>
              ) : (
                templates.map((template) => (
                  <article
                    key={template.id}
                    className="rounded-xl border border-purple-100 bg-purple-50/50 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-purple-950">
                          {template.name}
                        </p>
                        <p className="mt-1 text-[11px] text-purple-800">
                          {recurringDateLabel(template)}
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                          {template.resources
                            .map((resource) => resource.name)
                            .join(", ") || "No active resources assigned"}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => editTemplate(template)}
                          aria-label={`Edit ${template.name}`}
                          className="rounded-md p-2 text-slate-500 hover:bg-white hover:text-purple-700"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteCandidate(template)}
                          aria-label={`Remove ${template.name}`}
                          className="rounded-md p-2 text-slate-500 hover:bg-white hover:text-rose-700"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </section>
          </div>
        </section>
      </div>

      <ConfirmModal
        open={Boolean(deleteCandidate)}
        onClose={() => setDeleteCandidate(null)}
        onConfirm={removeTemplate}
        title="Remove recurring event?"
        message={`Remove "${deleteCandidate?.name || "this event"}" from future years? Its upcoming reservations will be removed; past calendar records will remain.`}
        confirmText="Remove event"
        confirmButtonClass="bg-rose-600"
        titleIcon={Trash2}
      />
    </>
  );
}
