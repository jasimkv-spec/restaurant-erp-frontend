import { CrudTable } from "../../components/CrudTable";

export default function ShipmentTypes() {
  return (
    <CrudTable
      title="Shipment Types"
      description="Mode of transport for inbound shipments (Road, Air, Sea, ...) - used on the Purchase Order header."
      basePath="/api/masters/shipment-types"
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "status", label: "Status" },
      ]}
      formFields={[
        { key: "code", label: "Code", type: "text", required: true },
        { key: "name", label: "Name", type: "text", required: true },
      ]}
    />
  );
}
