import { useEffect, useState } from "react";
import { ShieldCheck, Building2, Warehouse as WarehouseIcon, Plus, X, KeyRound } from "lucide-react";
import { api, ApiError, type ListResponse } from "../lib/apiClient";
import { useOptions } from "../lib/useOptions";
import { FIELD_CLASS, LABEL_CLASS } from "./CrudTable";

interface UserRoleRow {
  id: string;
  roleId: string;
  companyId: string | null;
  effectiveFrom: string | null;
  effectiveTill: string | null;
  role?: { id: string; code: string; name: string };
}

interface BranchAccessRow {
  id: string;
  branchId: string;
  branch?: { id: string; code: string; name: string };
}

interface WarehouseAccessRow {
  id: string;
  warehouseId: string;
  warehouse?: { id: string; code: string; name: string };
}

function todayIsoToDisplay(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString();
}

/**
 * Everything that controls what a user can actually do once logged in,
 * beyond the basic profile fields on the Users form itself: which Roles
 * they hold (optionally scoped to one Company and/or a time window - see
 * UserRole.effectiveFrom/effectiveTill, enforced in auth.routes.ts login),
 * which Branches they're restricted to (empty = unrestricted, sees every
 * branch - see auth.routes.ts), and which Warehouses. Rendered as
 * Users.tsx's extraPanel, existing users only (need a real id to attach
 * grants to).
 */
export function UserAccessPanel({ userId }: { userId: string }) {
  const [roleRows, setRoleRows] = useState<UserRoleRow[]>([]);
  const [branchRows, setBranchRows] = useState<BranchAccessRow[]>([]);
  const [warehouseRows, setWarehouseRows] = useState<WarehouseAccessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const roleOptions = useOptions("/api/security/roles", (r) => `${r.code} - ${r.name}`);
  const companyOptions = useOptions("/api/admin/companies", (c) => `${c.code} - ${c.name}`);
  const branchOptions = useOptions("/api/admin/branches", (b) => `${b.code} - ${b.name}`);
  const warehouseOptions = useOptions("/api/admin/warehouses", (w) => `${w.code} - ${w.name}`);

  const [newRoleId, setNewRoleId] = useState("");
  const [newCompanyId, setNewCompanyId] = useState("");
  const [newFrom, setNewFrom] = useState("");
  const [newTill, setNewTill] = useState("");
  const [addingRole, setAddingRole] = useState(false);

  const [newBranchId, setNewBranchId] = useState("");
  const [addingBranch, setAddingBranch] = useState(false);

  const [newWarehouseId, setNewWarehouseId] = useState("");
  const [addingWarehouse, setAddingWarehouse] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [passwordResetOk, setPasswordResetOk] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [rolesRes, branchRes, warehouseRes] = await Promise.all([
        api.get<ListResponse<UserRoleRow>>(`/api/security/user-roles?userId=${userId}`),
        api.get<ListResponse<BranchAccessRow>>(`/api/security/branch-access?userId=${userId}`),
        api.get<ListResponse<WarehouseAccessRow>>(`/api/security/warehouse-access?userId=${userId}`),
      ]);
      setRoleRows(rolesRes.data);
      setBranchRows(branchRes.data);
      setWarehouseRows(warehouseRes.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load access");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function handleAddRole() {
    if (!newRoleId) return;
    setAddingRole(true);
    setError(null);
    try {
      await api.post("/api/security/user-roles", {
        userId,
        roleId: newRoleId,
        companyId: newCompanyId || undefined,
        effectiveFrom: newFrom || undefined,
        effectiveTill: newTill || undefined,
      });
      setNewRoleId("");
      setNewCompanyId("");
      setNewFrom("");
      setNewTill("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not assign role");
    } finally {
      setAddingRole(false);
    }
  }

  async function handleRemoveRole(id: string) {
    setError(null);
    try {
      await api.del(`/api/security/user-roles/${id}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove role");
    }
  }

  async function handleAddBranch() {
    if (!newBranchId) return;
    setAddingBranch(true);
    setError(null);
    try {
      await api.post("/api/security/branch-access", { userId, branchId: newBranchId });
      setNewBranchId("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not grant branch access");
    } finally {
      setAddingBranch(false);
    }
  }

  async function handleRemoveBranch(id: string) {
    setError(null);
    try {
      await api.del(`/api/security/branch-access/${id}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove branch access");
    }
  }

  async function handleAddWarehouse() {
    if (!newWarehouseId) return;
    setAddingWarehouse(true);
    setError(null);
    try {
      await api.post("/api/security/warehouse-access", { userId, warehouseId: newWarehouseId });
      setNewWarehouseId("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not grant warehouse access");
    } finally {
      setAddingWarehouse(false);
    }
  }

  async function handleRemoveWarehouse(id: string) {
    setError(null);
    try {
      await api.del(`/api/security/warehouse-access/${id}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove warehouse access");
    }
  }

  async function handleResetPassword() {
    if (newPassword.length < 8) return;
    setResettingPassword(true);
    setError(null);
    setPasswordResetOk(false);
    try {
      await api.post(`/api/security/users/${userId}/reset-password`, { password: newPassword });
      setNewPassword("");
      setPasswordResetOk(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset password");
    } finally {
      setResettingPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="py-4 text-center text-sm text-gray-400">Loading access...</div>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* Reset password */}
      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-1.5 border-b border-gray-100 pb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
          <KeyRound size={12} />
          Reset password
        </div>
        <p className="mb-3 text-xs text-gray-500">Sets this user's password directly - no email/link flow yet, so share it with them yourself.</p>
        {passwordResetOk && (
          <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Password updated.
          </div>
        )}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className={LABEL_CLASS}>New password (min 8 characters)</label>
            <input
              type="password"
              className={FIELD_CLASS}
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setPasswordResetOk(false);
              }}
            />
          </div>
          <button
            onClick={handleResetPassword}
            disabled={resettingPassword || newPassword.length < 8}
            className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            {resettingPassword ? "Saving..." : "Reset password"}
          </button>
        </div>
      </div>

      {/* Roles */}
      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-1.5 border-b border-gray-100 pb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
          <ShieldCheck size={12} />
          Roles
        </div>
        <p className="mb-3 text-xs text-gray-500">
          What this user can do. Scope a role to one Company, or leave blank for every company they can already reach
          via branch access below. Effective from/till is optional - leave blank for "always".
        </p>

        {roleRows.length === 0 ? (
          <div className="mb-3 py-3 text-center text-sm text-gray-400">No roles assigned yet - this user can't do anything until you add one.</div>
        ) : (
          <div className="mb-3 overflow-hidden rounded-lg border border-gray-200">
            <div className="grid grid-cols-[1fr_1fr_7rem_7rem_2.5rem] gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <div>Role</div>
              <div>Company</div>
              <div>From</div>
              <div>Till</div>
              <div></div>
            </div>
            <div className="divide-y divide-gray-100">
              {roleRows.map((row) => (
                <div key={row.id} className="grid grid-cols-[1fr_1fr_7rem_7rem_2.5rem] items-center gap-2 px-3 py-2 text-sm">
                  <div className="truncate font-medium text-navy-900">
                    {row.role ? `${row.role.code} - ${row.role.name}` : "-"}
                  </div>
                  <div className="truncate text-gray-600">
                    {row.companyId ? companyOptions.find((o) => o.value === row.companyId)?.label ?? row.companyId : "All companies"}
                  </div>
                  <div className="text-gray-600">{todayIsoToDisplay(row.effectiveFrom)}</div>
                  <div className="text-gray-600">{todayIsoToDisplay(row.effectiveTill)}</div>
                  <button
                    onClick={() => handleRemoveRole(row.id)}
                    title="Remove this role"
                    className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-[1fr_1fr_7rem_7rem_5rem] items-end gap-2">
          <div>
            <label className={LABEL_CLASS}>Role</label>
            <select className={FIELD_CLASS} value={newRoleId} onChange={(e) => setNewRoleId(e.target.value)}>
              <option value="">Select...</option>
              {roleOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS}>Company (optional)</label>
            <select className={FIELD_CLASS} value={newCompanyId} onChange={(e) => setNewCompanyId(e.target.value)}>
              <option value="">All companies</option>
              {companyOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS}>From</label>
            <input type="date" className={FIELD_CLASS} value={newFrom} onChange={(e) => setNewFrom(e.target.value)} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Till</label>
            <input type="date" className={FIELD_CLASS} value={newTill} onChange={(e) => setNewTill(e.target.value)} />
          </div>
          <button
            onClick={handleAddRole}
            disabled={addingRole || !newRoleId}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            <Plus size={14} />
            Add
          </button>
        </div>
      </div>

      {/* Branch access */}
      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-1.5 border-b border-gray-100 pb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
          <Building2 size={12} />
          Branch access
        </div>
        <p className="mb-3 text-xs text-gray-500">
          Restricts which branches' transactions and masters this user sees. Leave empty for no restriction (sees
          every active branch) - most head-office/admin users should stay this way.
        </p>

        {branchRows.length === 0 ? (
          <div className="mb-3 py-3 text-center text-sm text-gray-400">No restriction - this user sees every active branch.</div>
        ) : (
          <div className="mb-3 flex flex-wrap gap-2">
            {branchRows.map((row) => (
              <span
                key={row.id}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-navy-900"
              >
                {row.branch ? `${row.branch.code} - ${row.branch.name}` : "-"}
                <button onClick={() => handleRemoveBranch(row.id)} className="text-gray-400 hover:text-red-600">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className={LABEL_CLASS}>Add a branch</label>
            <select className={FIELD_CLASS} value={newBranchId} onChange={(e) => setNewBranchId(e.target.value)}>
              <option value="">Select a branch...</option>
              {branchOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAddBranch}
            disabled={addingBranch || !newBranchId}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            <Plus size={14} />
            Add
          </button>
        </div>
      </div>

      {/* Warehouse access */}
      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-1.5 border-b border-gray-100 pb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
          <WarehouseIcon size={12} />
          Warehouse access
        </div>
        <p className="mb-3 text-xs text-gray-500">
          Restricts which warehouses' stock this user can see/move (GRN, transfers, adjustments). Leave empty for no
          restriction.
        </p>

        {warehouseRows.length === 0 ? (
          <div className="mb-3 py-3 text-center text-sm text-gray-400">No restriction - this user sees every warehouse.</div>
        ) : (
          <div className="mb-3 flex flex-wrap gap-2">
            {warehouseRows.map((row) => (
              <span
                key={row.id}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-navy-900"
              >
                {row.warehouse ? `${row.warehouse.code} - ${row.warehouse.name}` : "-"}
                <button onClick={() => handleRemoveWarehouse(row.id)} className="text-gray-400 hover:text-red-600">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className={LABEL_CLASS}>Add a warehouse</label>
            <select className={FIELD_CLASS} value={newWarehouseId} onChange={(e) => setNewWarehouseId(e.target.value)}>
              <option value="">Select a warehouse...</option>
              {warehouseOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAddWarehouse}
            disabled={addingWarehouse || !newWarehouseId}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            <Plus size={14} />
            Add
          </button>
        </div>
      </div>
    </>
  );
}
