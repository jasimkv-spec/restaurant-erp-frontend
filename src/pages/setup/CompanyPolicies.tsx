import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { api, ApiError, type ListResponse } from "../../lib/apiClient";
import { useOptions } from "../../lib/useOptions";

interface PolicyRule {
  id: string;
  companyId: string;
  branchId: string | null;
  userId: string | null;
  roleId: string | null;
  policyType: string;
  value: number | null;
  allow: boolean;
  branch?: { name: string } | null;
  user?: { displayName: string } | null;
  role?: { name: string } | null;
}

const POLICY_TYPES: { value: string; label: string; hasValue?: string }[] = [
  { value: "AllowNegativeStock", label: "Allow negative stock" },
  { value: "MinStockLevelCross", label: "Allow min stock level to be crossed" },
  { value: "PoGrnInvoiceTolerancePct", label: "PO / GRN / invoice amount tolerance", hasValue: "%" },
  { value: "BackdatedTransaction", label: "Allow to create/edit back-dated transaction", hasValue: "days" },
  { value: "PostdatedTransaction", label: "Allow to create/edit post-dated transaction", hasValue: "days" },
  { value: "PriorYearTransaction", label: "Allow to create/edit previous financial year transaction" },
  { value: "PriceEditing", label: "Allow price editing" },
  { value: "DiscountEditing", label: "Allow discount editing", hasValue: "max %" },
  { value: "PurchaseAboveVendorCreditLimit", label: "Allow purchase invoice above vendor credit limit" },
  { value: "SellBelowCost", label: "Allow selling items below purchase cost" },
];

function policyLabel(type: string) {
  return POLICY_TYPES.find((p) => p.value === type)?.label ?? type;
}

/**
 * Rebuilt from a fixed 3-checkbox screen into a scoped rule table, matching
 * how mature ERPs actually do this (see the iRujul reference the user
 * shared): each policyType can have several rules, narrowed to a specific
 * branch/user/role - "blank" means "applies to All". The most specific
 * matching rule wins at check time; see src/services/policyRuleService.ts
 * on the backend.
 */
export default function CompanyPolicies() {
  const companyOptions = useOptions("/api/admin/companies", (c) => `${c.code} - ${c.name}`);
  const branchOptions = useOptions("/api/admin/branches", (b) => b.name);
  const userOptions = useOptions("/api/security/users", (u) => u.displayName || u.email);
  const roleOptions = useOptions("/api/security/roles", (r) => r.name);

  const [companyId, setCompanyId] = useState("");
  const [rules, setRules] = useState<PolicyRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ policyType: POLICY_TYPES[0].value, allow: "true" });

  useEffect(() => {
    if (companyOptions.length > 0 && !companyId) setCompanyId(companyOptions[0].value);
  }, [companyOptions, companyId]);

  async function load() {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ListResponse<PolicyRule>>(`/api/admin/policy-rules?companyId=${companyId}`);
      setRules(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load policies");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  function openAdd() {
    setForm({ policyType: POLICY_TYPES[0].value, allow: "true" });
    setFormOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await api.post("/api/admin/policy-rules", {
        companyId,
        branchId: form.branchId || undefined,
        userId: form.userId || undefined,
        roleId: form.roleId || undefined,
        policyType: form.policyType,
        value: form.value ? Number(form.value) : undefined,
        allow: form.allow === "true",
      });
      setFormOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await api.del(`/api/admin/policy-rules/${id}`);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete");
    }
  }

  const selectedType = POLICY_TYPES.find((p) => p.value === form.policyType);

  return (
    <div className="p-6">
      <h2 className="text-lg font-medium text-navy-900">Company Policies</h2>
      <p className="mb-4 mt-0.5 text-xs text-gray-500">
        Rules that change how transactions behave, scoped to a branch, user, or role. Leave a scope blank for
        "applies to everyone" - a more specific rule (a named user beats a role, which beats a branch) always wins
        over a blanket one.
      </p>

      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="max-w-xs flex-1">
          <label className="mb-1 block text-xs text-gray-500">Company</label>
          <select
            className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
          >
            {companyOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-brand-700"
        >
          <Plus size={14} />
          Add rule
        </button>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Branch</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">User</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Role</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Policy type</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Value</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Allow</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-400">Loading...</td>
              </tr>
            ) : rules.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-400">
                  No rules yet - everything behaves as it did before this screen existed.
                </td>
              </tr>
            ) : (
              rules.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 text-gray-700">{r.branch?.name ?? "All branches"}</td>
                  <td className="px-3 py-2 text-gray-700">{r.user?.displayName ?? "All users"}</td>
                  <td className="px-3 py-2 text-gray-700">{r.role?.name ?? "All roles"}</td>
                  <td className="px-3 py-2 text-gray-700">{policyLabel(r.policyType)}</td>
                  <td className="px-3 py-2 text-gray-700">{r.value ?? "-"}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] ${
                        r.allow ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                      }`}
                    >
                      {r.allow ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      title="Delete rule"
                    >
                      <X size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-40 flex items-stretch justify-end bg-black/30" onClick={() => setFormOpen(false)}>
          <div className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-base font-semibold text-gray-900">New Policy Rule</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Policy type *</label>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={form.policyType}
                  onChange={(e) => setForm((p) => ({ ...p, policyType: e.target.value }))}
                >
                  {POLICY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Branch (blank = all)</label>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={form.branchId ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, branchId: e.target.value }))}
                >
                  <option value="">All branches</option>
                  {branchOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">User (blank = all)</label>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={form.userId ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, userId: e.target.value }))}
                >
                  <option value="">All users</option>
                  {userOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Role (blank = all)</label>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={form.roleId ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, roleId: e.target.value }))}
                >
                  <option value="">All roles</option>
                  {roleOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {selectedType?.hasValue && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Value ({selectedType.hasValue})</label>
                  <input
                    type="number"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    value={form.value ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))}
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Allow</label>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={form.allow}
                  onChange={(e) => setForm((p) => ({ ...p, allow: e.target.value }))}
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => setFormOpen(false)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
