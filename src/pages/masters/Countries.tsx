import { AddOnlyList } from "../../components/AddOnlyList";

export default function Countries() {
  return (
    <AddOnlyList
      title="Countries"
      description="Shared across all tenants - cities are added under a country."
      basePath="/api/masters/countries"
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
      ]}
      formFields={[
        { key: "code", label: "Code (2 letters, e.g. AE)", type: "text", required: true },
        { key: "name", label: "Name", type: "text", required: true },
      ]}
    />
  );
}
