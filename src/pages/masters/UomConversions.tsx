import { AddOnlyList } from "../../components/AddOnlyList";
import { useOptions } from "../../lib/useOptions";

export default function UomConversions() {
  const uomOptions = useOptions("/api/masters/uoms", (u) => `${u.code} - ${u.name}`);

  return (
    <AddOnlyList
      title="UOM Conversions"
      description="How one unit converts to another, e.g. 1 CASE = 24 PC - optionally specific to one item."
      basePath="/api/masters/uom-conversions"
      columns={[
        { key: "fromUomId", label: "From" },
        { key: "toUomId", label: "To" },
        { key: "factor", label: "Factor" },
      ]}
      formFields={[
        { key: "fromUomId", label: "From unit", type: "select", required: true, options: uomOptions },
        { key: "toUomId", label: "To unit", type: "select", required: true, options: uomOptions },
        { key: "factor", label: "Factor (1 From = ? To)", type: "number", required: true },
        { key: "effectiveFrom", label: "Effective from", type: "date" },
      ]}
    />
  );
}
