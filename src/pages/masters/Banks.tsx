import { AddOnlyList } from "../../components/AddOnlyList";

export default function Banks() {
  return (
    <AddOnlyList
      title="Banks"
      description="Shared reference list used when adding a company bank account."
      basePath="/api/masters/banks"
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
      ]}
      formFields={[
        { key: "code", label: "Code", type: "text", required: true },
        { key: "name", label: "Name", type: "text", required: true },
      ]}
    />
  );
}
