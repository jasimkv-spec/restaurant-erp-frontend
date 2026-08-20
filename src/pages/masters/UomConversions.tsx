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
      description="Set up how a larger or purchase-style unit converts into a smaller one - e.g. 1 Carton = 12 Piece. Click Save with 'from' and 'to' picked and the factor filled in; leave Item blank to apply it to every item that uses those two units."
      basePath="/api/masters/uom-conversions"
      editable
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
        { key: "fromUomId", label: "Convert from this unit", type: "select", required: true, options: uomOptions },
        { key: "toUomId", label: "...into this unit", type: "select", required: true, options: uomOptions },
        {
          key: "factor",
          label: "How many 'into' units equal one 'from' unit?",
          type: "number",
          required: true,
          placeholder: "e.g. 12, if 1 Carton = 12 Piece",
        },
        { key: "itemId", label: "Only for this item (optional - leave blank for every item)", type: "select", options: itemOptions },
        { key: "effectiveFrom", label: "Effective from", type: "date" },
      ]}
      previewText={(form) => {
        if (!form.fromUomId || !form.toUomId || !form.factor) return null;
        const from = uomCodeById[form.fromUomId] ?? "?";
        const to = uomCodeById[form.toUomId] ?? "?";
        return `1 ${from} = ${form.factor} ${to}`;
      }}
    />
  );
}
