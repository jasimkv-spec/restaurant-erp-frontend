import { CrudTable } from "../../components/CrudTable";
import { useOptions } from "../../lib/useOptions";

/**
 * Which vendors supply which item, at what vendor-side code/price/lead
 * time - lets a PO default to a known vendor cost instead of typing it in
 * fresh every time. An item can have several vendors mapped to it.
 */
export default function ItemVendorMappings() {
  const itemOptions = useOptions("/api/inventory/items", (i) => `${i.code} - ${i.name}`);
  const vendorOptions = useOptions("/api/procurement/vendors", (v) => `${v.code} - ${v.name}`);

  return (
    <CrudTable
      title="Item-Vendor Mapping"
      description="Which vendors supply which item, their vendor-side item code, lead time, and last purchase price - used to default PO lines."
      basePath="/api/inventory/item-vendor-mappings"
      columns={[
        { key: "vendorItemCode", label: "Vendor item code" },
        { key: "item", label: "Item", render: (row: any) => (row.item ? `${row.item.code} - ${row.item.name}` : "-") },
        { key: "vendor", label: "Vendor", render: (row: any) => (row.vendor ? `${row.vendor.code} - ${row.vendor.name}` : "-") },
        { key: "lastPrice", label: "Last price" },
      ]}
      formFields={[
        { key: "itemId", label: "Item", type: "select", required: true, options: itemOptions },
        { key: "vendorId", label: "Vendor", type: "select", required: true, options: vendorOptions },
        { key: "vendorItemCode", label: "Vendor item code", type: "text" },
        { key: "leadTimeDays", label: "Lead time (days)", type: "number" },
        { key: "lastPrice", label: "Last price", type: "number" },
      ]}
    />
  );
}
