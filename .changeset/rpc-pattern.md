---
"@amqp-contract/contract": minor
"@amqp-contract/client": minor
"@amqp-contract/worker": minor
"@amqp-contract/core": minor
---

Add RPC pattern: typed request/response over RabbitMQ via a single
`defineRpc` builder and a dedicated `rpcs` slot on the contract.

```typescript
import { defineContract, defineMessage, defineQueue, defineRpc } from "@amqp-contract/contract";
import { z } from "zod";

const calculate = defineRpc(defineQueue("rpc.calculate"), {
  request: defineMessage(z.object({ a: z.number(), b: z.number() })),
  response: defineMessage(z.object({ sum: z.number() })),
});

const contract = defineContract({
  rpcs: { calculate },
});
```

The worker handler returns the response payload (validated against the
response schema before being published back to the caller's `replyTo`):

```typescript
TypedAmqpWorker.create({
  contract,
  handlers: {
    calculate: ({ payload }) => Future.value(Result.Ok({ sum: payload.a + payload.b })),
  },
  urls: ["amqp://localhost"],
});
```

The client calls with a required timeout and receives a typed `Result`:

```typescript
const result = await client.call("calculate", { a: 1, b: 2 }, { timeoutMs: 5_000 }).toPromise();
// Result<{ sum: number }, TechnicalError | MessageValidationError | RpcTimeoutError | RpcCancelledError>
```

**Design notes:**

- RPC is bidirectional on both ends (server consumes requests + publishes
  responses; client publishes requests + consumes responses), so it has
  its own `rpcs` slot rather than being shoehorned into `publishers` or
  `consumers`.
- A single `defineRpc(queue, { request, response })` produces one
  definition shared by both ends — no client/server split, no risk of
  schema drift.
- Worker handler keys live in the same object as `consumers` handlers;
  RPC handlers return the typed response payload, regular consumers
  return `void`.
- Uses RabbitMQ direct reply-to (`amq.rabbitmq.reply-to`) — no reply
  queue declaration needed.
- A single reply consumer demultiplexes responses by `correlationId`;
  the client manages an in-memory pending-call map.
- Closing the client rejects every in-flight call with `RpcCancelledError`.
- Response-schema validation failures on the server map to
  `NonRetryableError` (handler bug → DLQ).
- AsyncAPI generation does not yet emit dedicated requestReply pairs for
  RPCs — tracked as a follow-up.
