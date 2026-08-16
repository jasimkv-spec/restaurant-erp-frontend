import { CrudTable } from "../../components/CrudTable";

const TYPES = ["Cash", "Card", "Online", "Aggregator", "Cheque", "Bank Transfer"];

export default function PaymentMethods() {
  return (
    <CrudTable
      title="Payment Methods"
      description="How customers pay - used on sales invoices and receipts."
      basePath="/api/masters/payment-methods"
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "type", label: "Type" },
        { key: "status", label: "Status" },
      ]}
      formFields={[
        { key: "code", label: "Code", type: "text", required: true },
        { key: "name", label: "Name", type: "text", required: true },
        {
          key: "type",
          label: "Type",
          type: "select",
          required: true,
          options: TYPES.map((t) => ({ value: t, label: t })),
        },
      ]}
    />
  );
}
