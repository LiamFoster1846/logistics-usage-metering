import { z } from "zod";
import { InfraiAccount } from "./infrai-account.ts";

export const shipmentEvent = z.object({
  customerId: z.string().min(1),
  shipmentId: z.string().min(1),
  event: z.enum(["shipment.created", "proof.received", "exception.opened", "exception.closed"]),
  occurredAt: z.string().datetime(),
  proofBytes: z.number().int().nonnegative().default(0)
});
export type ShipmentEvent = z.infer<typeof shipmentEvent>;

export function billableUnits(event: ShipmentEvent): number {
  return event.event === "proof.received" ? Math.max(1, Math.ceil(event.proofBytes / 1_000_000)) : 1;
}

export async function run(event: unknown): Promise<{ customerId: string; billableUnits: number }> {
  const parsed = shipmentEvent.parse(event);
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const account = new InfraiAccount(key);
  await account.usageTimeseries({ customer_id: parsed.customerId });
  return { customerId: parsed.customerId, billableUnits: billableUnits(parsed) };
}

if (process.argv[1]?.endsWith("shipment-meter.ts")) {
  const input = process.env.SHIPMENT_EVENT_JSON ?? JSON.stringify({
    customerId: "acme-logistics", shipmentId: "shp-100", event: "proof.received",
    occurredAt: "2026-01-15T10:00:00.000Z", proofBytes: 2_100_000
  });
  run(JSON.parse(input)).then((result) => console.log(JSON.stringify(result))).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
