import { CrudTable } from "../../components/CrudTable";
import { useOptions } from "../../lib/useOptions";

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

  return (
    <CrudTable
      title="Item Categories"
      description="Parent/child category tree with default GL accounts for costing - an item's category can auto-suggest its inventory and COGS accounts."
      basePath="/api/inventory/item-categories"
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
