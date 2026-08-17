import { CrudTable } from "../../components/CrudTable";

/**
 * Was an AddOnlyList (create-only, like Countries/Banks) until the
 * exchange-rate field needed to be editable over time as real rates move -
 * now a normal CrudTable backed by the currencies PUT endpoint added
 * alongside the base-currency work.
 */
export default function Currencies() {
  return (
    <CrudTable
      title="Currencies"
      description="Shared across all tenants on this platform. The exchange rate is how many units of a company's base currency equal 1 unit of this currency - leave it at 1 for whichever currency is used as the base."
      basePath="/api/masters/currencies"
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "exchangeRate", label: "Exchange rate" },
        { key: "decimalPrecision", label: "Decimals" },
      ]}
      formFields={[
        { key: "code", label: "Code (3 letters, e.g. AED)", type: "text", required: true },
        { key: "name", label: "Name", type: "text", required: true },
        { key: "exchangeRate", label: "Exchange rate (to base currency)", type: "number", placeholder: "1" },
        { key: "decimalPrecision", label: "Decimal precision", type: "number", placeholder: "2" },
      ]}
    />
  );
}
