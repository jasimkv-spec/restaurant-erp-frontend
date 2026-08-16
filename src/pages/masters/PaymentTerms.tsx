import { CrudTable } from "../../components/CrudTable";

export default function PaymentTerms() {
  return (
    <CrudTable
      title="Payment Terms"
      description="Credit terms offered to or by a vendor/customer, e.g. NET30."
      basePath="/api/masters/terms"
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "days", label: "Days" },
        { key: "status", label: "Status" },
      ]}
      formFields={[
        { key: "code", label: "Code", type: "text", required: true },
        { key: "name", label: "Name", type: "text", required: true },
        { key: "days", label: "Days", type: "number", required: true },
      ]}
    />
  );
}
