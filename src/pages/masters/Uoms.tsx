import { CrudTable } from "../../components/CrudTable";

export default function Uoms() {
  return (
    <CrudTable
      title="Units of Measure"
      description="Base units for items and recipes (KG, PC, LTR, etc.)."
      basePath="/api/masters/uoms"
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "decimalPrecision", label: "Decimals" },
      ]}
      formFields={[
        { key: "code", label: "Code", type: "text", required: true },
        { key: "name", label: "Name", type: "text", required: true },
        { key: "decimalPrecision", label: "Decimal precision", type: "number", placeholder: "3" },
      ]}
    />
  );
}
