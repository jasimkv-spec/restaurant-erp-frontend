import { AddOnlyList } from "../../components/AddOnlyList";

export default function Currencies() {
  return (
    <AddOnlyList
      title="Currencies"
      description="Shared across all tenants on this platform - not company-specific."
      basePath="/api/masters/currencies"
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "decimalPrecision", label: "Decimals" },
      ]}
      formFields={[
        { key: "code", label: "Code (3 letters, e.g. AED)", type: "text", required: true },
        { key: "name", label: "Name", type: "text", required: true },
        { key: "decimalPrecision", label: "Decimal precision", type: "number", placeholder: "2" },
      ]}
    />
  );
}
