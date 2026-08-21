import { CrudTable } from "../../components/CrudTable";

/**
 * Separate axis from Raw Materials/Menu/Item Master itself (which just
 * routes a product to one of those three screens) - this is the "how is it
 * physically handled" master, selectable from all three screens equally.
 * "Stock" is what Raw Materials Master pre-selects for new records; the
 * rest are a starting point you can rename/extend freely.
 */
export default function ItemTypes() {
  return (
    <CrudTable
      title="Item Types"
      description="How a product is physically handled (Stock/Non-Stock/Service/...) - independent of whether it lives under Raw Materials, Menu, or Item Master. Stock items are tracked in the stock ledger; the rest aren't."
      basePath="/api/inventory/item-types"
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "isStock", label: "Tracked in stock", render: (row: any) => (row.isStock ? "Yes" : "No") },
        { key: "status", label: "Status" },
      ]}
      formFields={[
        { key: "code", label: "Code", type: "text", required: true, placeholder: "STOCK" },
        { key: "name", label: "Name", type: "text", required: true },
        { key: "isStock", label: "Tracked in stock (posts to the stock ledger)", type: "checkbox" },
      ]}
    />
  );
}
