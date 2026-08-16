import { CrudTable } from "../../components/CrudTable";

const TAX_GROUPS = ["Standard rate", "Zero rated", "Exempt"];

export default function Taxes() {
  return (
    <CrudTable
      title="Taxes"
      description="Tax codes used on sales and purchase documents (VAT, service tax, etc.)."
      basePath="/api/masters/taxes"
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "rate", label: "Rate %" },
        { key: "status", label: "Status" },
      ]}
      formFields={[
        { key: "code", label: "Code", type: "text", required: true },
        { key: "name", label: "Name", type: "text", required: true },
        { key: "rate", label: "Rate (%)", type: "number", required: true },
        { key: "taxType", label: "Tax type", type: "text", placeholder: "VAT" },
        {
          key: "taxGroup",
          label: "Tax group",
          type: "select",
          options: TAX_GROUPS.map((t) => ({ value: t, label: t })),
        },
      ]}
    />
  );
}
