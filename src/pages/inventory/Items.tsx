import { CrudTable } from "../../components/CrudTable";
import { useOptions } from "../../lib/useOptions";

const ITEM_TYPES = [
  "Sellable",
  "Stock",
  "Non-stock",
  "Stationary",
  "Menu",
  "Semi-finished",
  "Finished",
  "Packaging",
  "Service",
  "Spare",
];

const COSTING_METHODS = ["Weighted Average", "Standard Cost", "FIFO"];

/**
 * The core product/item master - everything else in Inventory (stock
 * balances, GRNs, recipes, sales, consumption) points back to an Item.
 * New items land as "Draft" (see prisma/schema.prisma) until enabled here.
 */
export default function Items() {
  const categoryOptions = useOptions("/api/inventory/item-categories", (c) => `${c.code} - ${c.name}`);
  const groupOptions = useOptions("/api/inventory/product-groups", (g) => `${g.code} - ${g.name}`);
  const subgroupOptions = useOptions("/api/inventory/product-subgroups", (s) => `${s.code} - ${s.name}`);
  const familyOptions = useOptions("/api/inventory/product-families", (f) => `${f.code} - ${f.name}`);
  const brandOptions = useOptions("/api/inventory/brands", (b) => `${b.code} - ${b.name}`);
  const uomOptions = useOptions("/api/masters/uoms", (u) => `${u.code} - ${u.name}`);
  const taxOptions = useOptions("/api/masters/taxes", (t) => `${t.code} - ${t.name}`);

  return (
    <CrudTable
      title="Items"
      description="The product/item master - every stock movement, recipe, purchase, and sale points back to one of these. New items start as Draft until enabled below."
      basePath="/api/inventory/items"
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "itemType", label: "Type" },
        { key: "baseUom", label: "UOM", render: (row: any) => row.baseUom?.code },
        { key: "status", label: "Status" },
      ]}
      formFields={[
        { key: "code", label: "Code", type: "text", required: true },
        { key: "name", label: "Name", type: "text", required: true },
        { key: "shortName", label: "Short name (for receipts/kitchen tickets)", type: "text" },
        { key: "barcode", label: "Barcode", type: "text" },
        { key: "itemType", label: "Item type", type: "select", required: true, options: ITEM_TYPES.map((t) => ({ value: t, label: t })) },
        { key: "categoryId", label: "Category", type: "select", options: categoryOptions },
        { key: "groupId", label: "Product group", type: "select", options: groupOptions },
        { key: "subgroupId", label: "Product subgroup", type: "select", options: subgroupOptions },
        { key: "familyId", label: "Product family", type: "select", options: familyOptions },
        { key: "brandId", label: "Brand", type: "select", options: brandOptions },
        { key: "baseUomId", label: "Base UOM", type: "select", required: true, options: uomOptions },
        { key: "purchaseUomId", label: "Purchase UOM (if different from base)", type: "select", options: uomOptions },
        { key: "salesUomId", label: "Sales UOM (if different from base)", type: "select", options: uomOptions },
        { key: "defaultTaxId", label: "Default tax", type: "select", options: taxOptions },
        { key: "costingMethod", label: "Costing method", type: "select", options: COSTING_METHODS.map((c) => ({ value: c, label: c })) },
        { key: "standardCost", label: "Standard cost", type: "number" },
        { key: "batchRequired", label: "Batch tracking required", type: "checkbox" },
        { key: "expiryRequired", label: "Expiry tracking required", type: "checkbox" },
        { key: "shelfLifeDays", label: "Shelf life (days)", type: "number" },
        { key: "reorderLevel", label: "Reorder level", type: "number" },
        { key: "minStock", label: "Minimum stock", type: "number" },
        { key: "maxStock", label: "Maximum stock", type: "number" },
        { key: "preparationTimeMinutes", label: "Prep time (minutes)", type: "number" },
        { key: "allergens", label: "Allergens", type: "text", placeholder: "e.g. Gluten, Nuts, Dairy" },
        { key: "imageUrl", label: "Image URL", type: "text" },
        { key: "notes", label: "Notes", type: "text" },
      ]}
    />
  );
}
