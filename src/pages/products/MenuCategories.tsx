import { useOptions } from "../../lib/useOptions";
import { CrudTable } from "../../components/CrudTable";

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

  return (
    <CrudTable
      title="Menu Categories"
      description="How the menu is organized for POS/serving - e.g. Soups, or Drinks > Hot > Coffee/Tea. Used only by Menu Master, not Raw Material or Item Master."
      basePath="/api/inventory/menu-categories"
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
