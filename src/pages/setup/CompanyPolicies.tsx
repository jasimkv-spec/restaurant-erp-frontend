import { useEffect, useState } from "react";
import { api, ApiError, type ListResponse } from "../../lib/apiClient";
import { useOptions } from "../../lib/useOptions";

interface CompanyPolicy {
  policyKey: string;
  policyValue: unknown;
}

/**
 * Not built on the generic CrudTable - these aren't records in a list,
 * they're a fixed handful of named switches per company, read/written one
 * key at a time via GET/PUT /api/admin/company-policies/:companyId(/:policyKey).
 * See src/services/policyService.ts on the backend for which of these are
 * actually read by real business logic vs just stored for later.
 */
export default function CompanyPolicies() {
  const companyOptions = useOptions("/api/admin/companies", (c) => `${c.code} - ${c.name}`);
  const [companyId, setCompanyId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [allowNegativeStock, setAllowNegativeStock] = useState(true);
  const [approvalAmountLimit, setApprovalAmountLimit] = useState("");
  const [tolerancePct, setTolerancePct] = useState("2"); // shown as a percentage, e.g. 2 = 2%

  useEffect(() => {
    if (companyOptions.length > 0 && !companyId) {
      setCompanyId(companyOptions[0].value);
    }
  }, [companyOptions, companyId]);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    api
      .get<ListResponse<CompanyPolicy>>(`/api/admin/company-policies/${companyId}`)
      .then((res) => {
        const byKey = new Map(res.data.map((p) => [p.policyKey, p.policyValue]));
        setAllowNegativeStock(
          byKey.has("allowNegativeStock") ? Boolean(byKey.get("allowNegativeStock")) : true
        );
        setApprovalAmountLimit(
          byKey.has("approvalAmountLimit") ? String(byKey.get("approvalAmountLimit")) : ""
        );
        const tol = byKey.has("poGrnInvoiceTolerancePct") ? Number(byKey.get("poGrnInvoiceTolerancePct")) : 0.02;
        setTolerancePct(String(tol * 100));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load policies"))
      .finally(() => setLoading(false));
  }, [companyId]);

  async function handleSave() {
    if (!companyId) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await Promise.all([
        api.put(`/api/admin/company-policies/${companyId}/allowNegativeStock`, { value: allowNegativeStock }),
        api.put(`/api/admin/company-policies/${companyId}/approvalAmountLimit`, {
          value: approvalAmountLimit === "" ? null : Number(approvalAmountLimit),
        }),
        api.put(`/api/admin/company-policies/${companyId}/poGrnInvoiceTolerancePct`, {
          value: Number(tolerancePct) / 100,
        }),
      ]);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6">
      <h2 className="text-lg font-medium text-navy-900">Company Policies</h2>
      <p className="mb-4 mt-0.5 text-xs text-gray-500">
        On/off switches and limits that change how transactions behave for a company.
      </p>

      <div className="mb-4 max-w-xs">
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

      {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {saved && !error && (
        <div className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Saved.</div>
      )}

      {loading ? (
        <div className="text-sm text-gray-400">Loading...</div>
      ) : (
        <div className="max-w-xl space-y-4 rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-navy-900">Allow negative stock</div>
              <p className="text-xs text-gray-400">
                When off, stock issues (consumption, transfers out, deliveries) are blocked if they'd take an
                item's balance below zero at that warehouse. Actively enforced on every stock movement.
              </p>
            </div>
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300"
              checked={allowNegativeStock}
              onChange={(e) => setAllowNegativeStock(e.target.checked)}
            />
          </div>

          <div>
            <div className="text-sm font-medium text-navy-900">PO / GRN / Invoice amount tolerance</div>
            <p className="mb-1 text-xs text-gray-400">
              How far a purchase invoice's amount may vary from the matched GRN value before posting is blocked.
              Actively enforced when posting a purchase invoice.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                min="0"
                className="w-28 rounded-md border border-gray-200 px-2.5 py-1.5 text-sm"
                value={tolerancePct}
                onChange={(e) => setTolerancePct(e.target.value)}
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-navy-900">Approval amount limit</div>
            <p className="mb-1 text-xs text-gray-400">
              Stored here for reference, but approval thresholds are actually set per workflow on the Approval
              Workflows screen - this value isn't read by the approval engine yet.
            </p>
            <input
              type="number"
              min="0"
              placeholder="No limit set"
              className="w-40 rounded-md border border-gray-200 px-2.5 py-1.5 text-sm"
              value={approvalAmountLimit}
              onChange={(e) => setApprovalAmountLimit(e.target.value)}
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !companyId}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}
