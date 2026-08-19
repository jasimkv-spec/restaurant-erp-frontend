import { CrudTable } from "../../components/CrudTable";
import { useOptions } from "../../lib/useOptions";
import { useCodeLock } from "../../lib/useCodeLock";

export default function Vendors() {
  const countryOptions = useOptions("/api/masters/countries", (c) => `${c.code} - ${c.name}`);
  const cityOptions = useOptions("/api/masters/cities", (c) => `${c.code} - ${c.name}`);
  const areaOptions = useOptions("/api/masters/areas", (a) => a.name);
  const currencyOptions = useOptions("/api/masters/currencies", (c) => `${c.code} - ${c.name}`);
  const termsOptions = useOptions("/api/masters/terms", (t) => `${t.code} - ${t.name}`);
  const { locked: codeLocked, prefix: codePrefix } = useCodeLock("Vendor");

  return (
    <CrudTable
      title="Vendors"
      description="Suppliers you buy from. The currency here is what your POs and invoices default to for this vendor - amounts still get converted to the company's base currency for the books."
      basePath="/api/procurement/vendors"
      attachments={{ moduleCode: "Procurement.Vendor" }}
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "currency", label: "Currency", render: (row: any) => row.currency?.code },
        { key: "rating", label: "Rating" },
        { key: "status", label: "Status" },
      ]}
      formFields={[
        {
          key: "code",
          label: "Code",
          type: "text",
          disabled: codeLocked,
          placeholder: codeLocked
            ? `Auto-generated (${codePrefix ?? "SUP"}####)`
            : "Enter a code, or configure it under Master Series to auto-generate",
        },
        { key: "name", label: "Name", type: "text", required: true },
        { key: "contactPerson", label: "Contact person", type: "text" },
        { key: "phone", label: "Phone", type: "text" },
        { key: "whatsapp", label: "WhatsApp", type: "text" },
        { key: "email", label: "Email", type: "text" },
        { key: "address", label: "Address", type: "text" },
        { key: "countryId", label: "Country", type: "select", options: countryOptions },
        { key: "cityId", label: "City", type: "select", options: cityOptions },
        { key: "areaId", label: "Area", type: "select", options: areaOptions },
        {
          key: "currencyId",
          label: "Currency",
          type: "select",
          options: currencyOptions,
        },
        { key: "paymentTermsId", label: "Payment terms", type: "select", options: termsOptions },
        { key: "creditLimit", label: "Credit limit", type: "number" },
        { key: "taxNo", label: "Tax number", type: "text" },
        { key: "tradeLicenseNo", label: "Trade license no.", type: "text" },
        {
          key: "rating",
          label: "Rating",
          type: "select",
          options: [
            { value: "Pending", label: "Pending" },
            { value: "Approved", label: "Approved" },
            { value: "Blacklisted", label: "Blacklisted" },
          ],
        },
        { key: "bankName", label: "Bank name", type: "text" },
        { key: "bankAccountNo", label: "Bank account no.", type: "text" },
        { key: "iban", label: "IBAN", type: "text" },
        { key: "notes", label: "Notes", type: "text" },
      ]}
    />
  );
}
