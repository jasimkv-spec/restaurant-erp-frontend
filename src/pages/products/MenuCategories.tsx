import { useState } from "react";
import { CrudTable } from "../../components/CrudTable";
import { useOptions } from "../../lib/useOptions";
import { api } from "../../lib/apiClient";

/**
 * Menu Master's own classification tree - a restaurant serving/POS
 * hierarchy (Soups, Drinks > Hot > Coffee/Tea, Drinks > Cold > Juices).
 * Deliberately separate from Item Categories (which carries GL mapping -
 * irrelevant to how a menu is organized) and from Group/Subgroup/Family
 * (Raw Material/Item Master's own purchasing-side grouping, a different
 * audience) - reusing either would mix unrelated pick-lists together.
 */
export default function MenuCategories() {
  const parentOptions = useOptions("/api/inventory/menu-categories", (c) => `${c.code} - ${c.name}`);
  const [loadingStarter, setLoadingStarter] = useState(false);
  const [starterMessage, setStarterMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  async function loadStarterSet() {
    setLoadingStarter(true);
    setStarterMessage(null);
    try {
      await api.post("/api/inventory/menu-categories/load-starter-set", {});
      setStarterMessage("Starter menu categories loaded. Existing ones were left untouched.");
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      setStarterMessage(err?.message ?? "Couldn't load starter menu categories.");
    } finally {
      setLoadingStarter(false);
    }
  }

  return (
    <CrudTable
      key={refreshKey}
      title="Menu Categories"
      description="How the menu is organized for POS/serving - e.g. Soups, or Drinks > Hot > Coffee/Tea. Used only by Menu Master, not Raw Material or Item Master."
      basePath="/api/inventory/menu-categories"
      headerExtra={
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadStarterSet}
            disabled={loadingStarter}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {loadingStarter ? "Loading..." : "Load starter menu categories"}
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
      ]}
    />
  );
}
