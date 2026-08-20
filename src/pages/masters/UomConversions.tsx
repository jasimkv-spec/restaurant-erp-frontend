import { AddOnlyList } from "../../components/AddOnlyList";
import { useOptions } from "../../lib/useOptions";

export default function UomConversions() {
  const uomOptions = useOptions("/api/masters/uoms", (u) => `${u.code} - ${u.name}`);
  const itemOptions = useOptions("/api/inventory/items", (i) => `${i.code} - ${i.name}`);
  const uomCodeById = Object.fromEntries(uomOptions.map((o) => [o.value, o.label.split(" - ")[0]]));
  const itemLabelById = Object.fromEntries(itemOptions.map((o) => [o.value, o.label]));

  return (
    <AddOnlyList
      title="UOM Conversions"
      description="How one unit converts to another, e.g. 1 CASE = 24 PC - optionally specific to one item."
      basePath="/api/masters/uom-conversions"
      columns={[
        { key: "fromUomId", label: "From", render: (row) => uomCodeById[row.fromUomId] ?? "?" },
        {
          key: "conversion",
          label: "Conversion",
          render: (row) => `${uomCodeById[row.fromUomId] ?? "?"} → ${uomCodeById[row.toUomId] ?? "?"}`,
        },
        {
          key: "factor",
          label: "Factor",
          render: (row) => `1 ${uomCodeById[row.fromUomId] ?? ""} = ${row.factor} ${uomCodeById[row.toUomId] ?? ""}`,
        },
        {
          key: "itemId",
          label: "Item",
          render: (row) => (row.itemId ? itemLabelById[row.itemId] ?? "Item-specific" : "Generic (all items)"),
        },
      ]}
      formFields={[
        { key: "fromUomId", label: "From unit", type: "select", required: true, options: uomOptions },
        { key: "toUomId", label: "To unit", type: "select", required: true, options: uomOptions },
        { key: "factor", label: "Factor (1 From = ? To)", type: "number", required: true },
        { key: "itemId", label: "Specific to one item (optional)", type: "select", options: itemOptions },
        { key: "effectiveFrom", label: "Effective from", type: "date" },
      ]}
    />
  );
}
