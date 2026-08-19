import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { api, ApiError, type ListResponse } from "../lib/apiClient";

interface Branch {
  id: string;
  code: string;
  name: string;
}

interface BranchLink {
  id: string;
  branchId: string;
  branch?: Branch;
}

/**
 * Which branches belong to a Price Group - Item Prices sets one price per
 * item per group, and every branch checked here shares that price. See
 * price-group-branches endpoints in inventory.routes.ts.
 */
export function PriceGroupBranches({ priceGroupId }: { priceGroupId: string }) {
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [links, setLinks] = useState<BranchLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyBranchId, setBusyBranchId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [branchesRes, linksRes] = await Promise.all([
        api.get<ListResponse<Branch>>(`/api/admin/branches?pageSize=200`),
        api.get<ListResponse<BranchLink>>(`/api/inventory/price-groups/${priceGroupId}/branches`),
      ]);
      setAllBranches(branchesRes.data);
      setLinks(linksRes.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load branches");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceGroupId]);

  async function toggle(branch: Branch) {
    setBusyBranchId(branch.id);
    setError(null);
    try {
      const existing = links.find((l) => l.branchId === branch.id);
      if (existing) {
        await api.del(`/api/inventory/price-groups/${priceGroupId}/branches/${existing.id}`);
      } else {
        await api.post(`/api/inventory/price-groups/${priceGroupId}/branches`, { branchId: branch.id });
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update branch");
    } finally {
      setBusyBranchId(null);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-medium text-gray-400">
        <Building2 size={12} />
        Branches in this price group
      </div>

      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="py-4 text-center text-sm text-gray-400">Loading...</div>
      ) : allBranches.length === 0 ? (
        <div className="py-2 text-xs text-gray-400">No branches set up yet.</div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {allBranches.map((branch) => {
            const checked = links.some((l) => l.branchId === branch.id);
            return (
              <label
                key={branch.id}
                className="flex items-center gap-2 rounded-md border border-gray-100 px-2.5 py-1.5 text-sm hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={busyBranchId === branch.id}
                  onChange={() => toggle(branch)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                {branch.code} - {branch.name}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
