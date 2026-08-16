import { AddOnlyList } from "../../components/AddOnlyList";
import { useOptions } from "../../lib/useOptions";

export default function Cities() {
  const countryOptions = useOptions("/api/masters/countries", (c) => `${c.code} - ${c.name}`);

  return (
    <AddOnlyList
      title="Cities"
      description="Belongs to a country - used by Areas for delivery/address zones."
      basePath="/api/masters/cities"
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "country", label: "Country", render: (row: any) => row.country?.name },
      ]}
      formFields={[
        { key: "countryId", label: "Country", type: "select", required: true, options: countryOptions },
        { key: "code", label: "Code", type: "text", required: true },
        { key: "name", label: "Name", type: "text", required: true },
      ]}
    />
  );
}
