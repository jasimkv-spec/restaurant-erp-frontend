import { CrudTable } from "../../components/CrudTable";
import { useOptions } from "../../lib/useOptions";

export default function Areas() {
  const cityOptions = useOptions("/api/masters/cities", (c) => `${c.code} - ${c.name}`);

  return (
    <CrudTable
      title="Areas"
      description="Delivery or address zones within a city - used for customer/branch addresses."
      basePath="/api/masters/areas"
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "status", label: "Status" },
      ]}
      formFields={[
        { key: "cityId", label: "City", type: "select", required: true, options: cityOptions },
        { key: "code", label: "Code", type: "text", required: true },
        { key: "name", label: "Name", type: "text", required: true },
      ]}
    />
  );
}
