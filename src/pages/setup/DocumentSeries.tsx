import { CrudTable } from "../../components/CrudTable";
import { useOptions } from "../../lib/useOptions";

// The exact moduleCode values the backend's transaction screens call
// nextDocumentNumber() with - see src/utils/documentNumber.ts and its
// call sites across procurement/sales/inventory/accounting/recipe routes.
const MODULE_CODES = [
  "MaterialRequest",
  "MrConsolidation",
  "Rfq",
  "PurchaseOrder",
  "GRN",
  "GoodsReturn",
  "VendorDebitNote",
  "VendorPayment",
  "StockTransfer",
  "StockAdjustment",
  "ProductionPosting",
  "SalesQuote",
  "SalesInvoice",
  "DeliveryOrder",
  "SalesReturn",
  "CustomerReceipt",
  "CustomerCreditNote",
  "ContraVoucher",
];

export default function DocumentSeries() {
  const companyOptions = useOptions("/api/admin/companies", (c) => `${c.code} - ${c.name}`);
  const branchOptions = useOptions("/api/admin/branches", (b) => b.name);

  return (
    <CrudTable
      title="Document Series"
      description="How each transaction type gets numbered - prefix, digit padding, separator, and optional year/month segments. Leave branch blank for a series shared across the whole company."
      basePath="/api/admin/document-series"
      columns={[
        { key: "moduleCode", label: "Document type" },
        { key: "prefix", label: "Prefix" },
        { key: "nextNo", label: "Next number" },
        { key: "digitLength", label: "Digits" },
      ]}
      formFields={[
        { key: "companyId", label: "Company", type: "select", required: true, options: companyOptions },
        { key: "branchId", label: "Branch (optional - blank = company-wide)", type: "select", options: branchOptions },
        {
          key: "moduleCode",
          label: "Document type",
          type: "select",
          required: true,
          options: MODULE_CODES.map((m) => ({ value: m, label: m })),
        },
        { key: "prefix", label: "Prefix", type: "text", required: true, placeholder: "PO, GRN, INV..." },
        { key: "nextNo", label: "Next number", type: "number", placeholder: "1" },
        { key: "digitLength", label: "Digits to pad to", type: "number", placeholder: "6" },
        { key: "padChar", label: "Pad character", type: "text", placeholder: "0" },
        { key: "separator", label: "Separator", type: "text", placeholder: "-" },
        { key: "includeYear", label: "Include year", type: "checkbox" },
        {
          key: "yearFormat",
          label: "Year format",
          type: "select",
          options: [
            { value: "YYYY", label: "YYYY (2026)" },
            { value: "YY", label: "YY (26)" },
          ],
        },
        { key: "includeMonth", label: "Include month", type: "checkbox" },
        {
          key: "resetPolicy",
          label: "Reset numbering",
          type: "select",
          options: [
            { value: "Never", label: "Never" },
            { value: "Yearly", label: "Every year" },
            { value: "Monthly", label: "Every month" },
          ],
        },
      ]}
    />
  );
}
