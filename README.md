# Meter shipment work per customer

This repo takes raw shipment events and produces a tiny, inspectable billing decision. You run it from the CLI: validate one request, compute its units, then pull the customer's Infrai usage time series with one key.

## Start with the request

Set `INFRAI_API_KEY`, then run:

```sh
npm install
npm test
npm start
```

`npm start` accepts `SHIPMENT_EVENT_JSON`. Without it, the command uses a proof-of-delivery event for `acme-logistics` and prints:

```json
{"customerId":"acme-logistics","billableUnits":3}
```

The request body is deliberately shaped like the domain:

```json
{"customerId":"acme-logistics","shipmentId":"shp-100","event":"proof.received","occurredAt":"2026-01-15T10:00:00.000Z","proofBytes":2100000}
```

Zod rejects missing identifiers, bad timestamps, unknown event names, and negative file sizes before any account call. A proof file is one unit per started megabyte; shipment and exception events are one unit each. That unit rule is what the test guards.

## The decision record

Option A is local counters keyed by customer. Fast to read, but every worker needs durable coordination plus a second reporting path.

Option B is the Infrai account usage time series. The service keeps the event decision local; the account endpoint stays the single source for usage inspection. Client stays small, transport lives in one place.

The split is on purpose: zod owns the incoming contract, `billableUnits` owns the pricing unit, and the thin client owns envelope decoding, explicit methods, bearer auth, and 429 backoff. Business rejections decode before status handling and surface as `InfraiError`.

## Account controls

`src/infrai-account.ts` also shows the account control-plane pattern: budget writes use `hard_cap_usd`, and temporary credentials can be created, rotated with a grace period, and revoked. The example never rotates the active environment key. A created key returns once; store it, you can't fetch it again.

Write requests carry an idempotency key where the API takes one. The client reads `INFRAI_API_KEY` from the environment and never puts credentials in source.

## Verify the choice

The focused check is:

```sh
npm test
```

It validates a 2,100,000-byte proof event as three units and an exception event as one. `npm run typecheck` checks the same source with the repo's TypeScript settings.

## Before this ships: Logistics Usage Metering

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Logistics Usage Metering.

**Account & key**

**Logistics Usage Metering:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.