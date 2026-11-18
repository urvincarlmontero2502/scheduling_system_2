import { useEffect, useMemo, useState } from "react";
import { Search, ShieldCheck, Trash2, UserRound, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import ConfirmModal from "../components/ConfirmModal";
import * as api from "../api/endpoints";

const roleLabel = (role) => {
  if (role === "admin") return "Super Admin";
  if (role === "barangay_admin") return "Barangay Admin";
  if (role === "staff") return "Staff";
  return "User";
};

const isRegularUser = (role) => role === "staff" || role === "user";

export default function UserRoles() {
  const { user } = useAuth();
  const toast = useToast();
  const isSuperAdmin = user?.role === "admin";
  const [users, setUsers] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [savingUserId, setSavingUserId] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [deletingUserId, setDeletingUserId] = useState(null);

  useEffect(() => {
    let active = true;

    Promise.all([
      api.fetchUsers(),
      isSuperAdmin ? api.getBarangays() : Promise.resolve({ data: [] }),
    ])
      .then(([usersResponse, barangaysResponse]) => {
        if (!active) return;
        setUsers(Array.isArray(usersResponse.data) ? usersResponse.data : []);
        setBarangays(
          Array.isArray(barangaysResponse.data) ? barangaysResponse.data : [],
        );
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(
          error?.response?.data?.message || "Unable to load user accounts.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isSuperAdmin]);

  const manageableUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((candidate) => {
      if (candidate.user_id === user?.user_id) return false;
      const eligible = isRegularUser(candidate.role) ||
        (isSuperAdmin && candidate.role === "barangay_admin");
      if (!eligible) return false;
      if (!isSuperAdmin && candidate.barangay !== user?.barangay) return false;
      if (!query) return true;
      return [candidate.full_name, candidate.email, candidate.barangay]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query));
    });
  }, [isSuperAdmin, search, user?.barangay, user?.user_id, users]);

  const updateDraft = (userId, values) => {
    setDrafts((current) => ({
      ...current,
      [userId]: { ...current[userId], ...values },
    }));
  };

  const promote = async (candidate) => {
    const defaults = isSuperAdmin && candidate.role === "barangay_admin"
      ? "admin"
      : "barangay_admin";
    const role = drafts[candidate.user_id]?.role || defaults;
    const barangay = drafts[candidate.user_id]?.barangay || "";

    if (role === "barangay_admin" && isSuperAdmin && !barangay) {
      toast.error("Choose a barangay for this administrator.");
      return;
    }

    const confirmMessage = role === "admin"
      ? `Promote ${candidate.full_name} to Super Admin?`
      : `Promote ${candidate.full_name} to Barangay Admin${isSuperAdmin ? ` for ${barangay}` : ` for ${user.barangay}`}?`;
    if (!window.confirm(confirmMessage)) return;

    setSavingUserId(candidate.user_id);
    try {
      const response = await api.promoteUser(candidate.user_id, {
        role,
        ...(role === "barangay_admin" && isSuperAdmin ? { barangay } : {}),
      });
      setUsers((current) =>
        current.map((item) =>
          item.user_id === candidate.user_id ? response.data.user : item,
        ),
      );
      toast.success(response.data.message || "User role updated.");
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Unable to update this user role.",
      );
    } finally {
      setSavingUserId(null);
    }
  };

  const moveUserToTrash = async () => {
    if (!deleteCandidate) return;

    setDeletingUserId(deleteCandidate.user_id);
    try {
      const response = await api.deleteUser(deleteCandidate.user_id);
      setUsers((current) =>
        current.filter((candidate) => candidate.user_id !== deleteCandidate.user_id),
      );
      toast.success(response.data.message || "User moved to the Trash Bin.");
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Unable to remove this user.",
      );
    } finally {
      setDeletingUserId(null);
      setDeleteCandidate(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-6">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          <ShieldCheck size={14} />
          Administration
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Manage user roles
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {isSuperAdmin
            ? "Promote eligible accounts or move users to the Trash Bin."
            : `Promote eligible users to Barangay Admin for ${user?.barangay || "your barangay"}.`}
        </p>
      </header>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Users size={17} className="text-slate-500" />
            Eligible accounts
            {!loading && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {manageableUsers.length}
              </span>
            )}
          </div>
          <label className="relative block sm:w-72">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, or barangay"
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading user accounts...
          </div>
        ) : loadError ? (
          <div role="alert" className="p-8 text-center text-sm text-red-600">
            {loadError}
          </div>
        ) : manageableUsers.length === 0 ? (
          <div className="p-10 text-center">
            <UserRound size={24} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium text-slate-700">
              No eligible accounts found
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {search
                ? "Try a different search."
                : "Only regular accounts can be promoted."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {manageableUsers.map((candidate) => {
              const defaultRole = isSuperAdmin && candidate.role === "barangay_admin"
                ? "admin"
                : "barangay_admin";
              const selectedRole = drafts[candidate.user_id]?.role || defaultRole;
              return (
                <div
                  key={candidate.user_id}
                  className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {candidate.full_name}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {candidate.email}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {roleLabel(candidate.role)}
                      {candidate.barangay ? ` · ${candidate.barangay}` : ""}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    {isSuperAdmin ? (
                      <select
                        aria-label={`Role for ${candidate.full_name}`}
                        value={selectedRole}
                        onChange={(event) =>
                          updateDraft(candidate.user_id, {
                            role: event.target.value,
                          })
                        }
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      >
                        {candidate.role === "barangay_admin" ? (
                          <option value="admin">Super Admin</option>
                        ) : (
                          <>
                            <option value="barangay_admin">Barangay Admin</option>
                            <option value="admin">Super Admin</option>
                          </>
                        )}
                      </select>
                    ) : (
                      <span className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        Barangay Admin
                      </span>
                    )}

                    {isSuperAdmin && selectedRole === "barangay_admin" && (
                      <select
                        aria-label={`Barangay for ${candidate.full_name}`}
                        value={drafts[candidate.user_id]?.barangay || ""}
                        onChange={(event) =>
                          updateDraft(candidate.user_id, {
                            barangay: event.target.value,
                          })
                        }
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      >
                        <option value="">Select barangay</option>
                        {barangays.map((barangay) => (
                          <option key={barangay.id} value={barangay.name}>
                            {barangay.name}
                          </option>
                        ))}
                      </select>
                    )}

                    <button
                      type="button"
                      disabled={savingUserId === candidate.user_id}
                      onClick={() => promote(candidate)}
                      className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingUserId === candidate.user_id
                        ? "Saving..."
                        : "Promote"}
                    </button>
                    {isSuperAdmin && (
                      <button
                        type="button"
                        disabled={deletingUserId === candidate.user_id}
                        onClick={() => setDeleteCandidate(candidate)}
                        aria-label={`Move ${candidate.full_name} to the Trash Bin`}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 size={15} />
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      <ConfirmModal
        open={Boolean(deleteCandidate)}
        onClose={() => setDeleteCandidate(null)}
        onConfirm={moveUserToTrash}
        title="Move user to Trash?"
        message={`Move "${deleteCandidate?.full_name || "this user"}" to the Trash Bin? They will lose access, but their booking history will be kept. A Super Admin can restore the account later.`}
        confirmText="Move to Trash"
        confirmButtonClass="bg-rose-600"
        titleIcon={Trash2}
      />
    </div>
  );
}
