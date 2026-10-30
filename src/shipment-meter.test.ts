import { strict as assert } from "node:assert";
import { billableUnits, shipmentEvent } from "./shipment-meter.ts";

const event = shipmentEvent.parse({
  customerId: "acme-logistics", shipmentId: "shp-100", event: "proof.received",
  occurredAt: "2026-01-15T10:00:00.000Z", proofBytes: 2_100_000
});
assert.equal(billableUnits(event), 3);
assert.equal(billableUnits({ ...event, event: "exception.opened" }), 1);
console.log("shipment billing decision: passed");
