import { useState } from "react";
import { CrudTable } from "../../components/CrudTable";
import { useOptions } from "../../lib/useOptions";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/apiClient";

/**
 * Older, self-referencing (parent/child tree) classification, kept
 * alongside the newer Group -> Subgroup -> Family structure specifically
 * because it carries the default GL accounts (see Item's categoryId) -
 * Group/Subgroup/Family don't. Use whichever fits how you think about
 * your menu; Item lets you set both independently.
 */
export default function ItemCategories() {
  const parentOptions = useOptions("/api/inventory/item-categories", (c) => `${c.code} - ${c.name}`);
  const glOptions = useOptions("/api/finance/chart-of-accounts", (a) => `${a.code} - ${a.name}`);
  const { user, activeCompanyScope } = useAuth();
  const scopedCompanyId = activeCompanyScope && activeCompanyScope !== "GLOBAL" ? activeCompanyScope : null;
  const companyId = scopedCompanyId ?? user?.companies?.[0]?.id;
  const [loadingStarter, setLoadingStarter] = useState(false);
  const [starterMessage, setStarterMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  async function loadStarterSet() {
    if (!companyId) {
      setStarterMessage("No company found for this session - pick a company first.");
      return;
    }
    setLoadingStarter(true);
    setStarterMessage(null);
    try {
      await api.post("/api/inventory/item-categories/load-starter-set", { companyId });
      setStarterMessage("Starter categories loaded. Existing categories were left untouched.");
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      setStarterMessage(err?.message ?? "Couldn't load starter categories.");
    } finally {
      setLoadingStarter(false);
    }
  }

  return (
    <CrudTable
      key={refreshKey}
      title="Item Categories"
      description="Parent/child category tree with default GL accounts for costing - an item's category can auto-suggest its inventory and COGS accounts."
      basePath="/api/inventory/item-categories"
      headerExtra={
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadStarterSet}
            disabled={loadingStarter}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {loadingStarter ? "Loading..." : "Load starter categories"}
          </button>
          {starterMessage && <span className="text-sm text-slate-500">{starterMessage}</span>}
        </div>
      }
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "parent", label: "Parent", render: (row: any) => row.parent?.name },
        { key: "status", label: "Status" },
      ]}
      formFields={[
        { key: "code", label: "Code", type: "text", required: true },
        { key: "name", label: "Name", type: "text", required: true },
        { key: "parentId", label: "Parent category", type: "select", options: parentOptions },
        { key: "defaultInventoryGlId", label: "Default inventory account", type: "select", options: glOptions },
        { key: "defaultCogsGlId", label: "Default COGS account", type: "select", options: glOptions },
      ]}
    />
  );
}
