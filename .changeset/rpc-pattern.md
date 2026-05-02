---
"@amqp-contract/contract": minor
"@amqp-contract/client": minor
"@amqp-contract/worker": minor
"@amqp-contract/core": minor
---

Add RPC pattern: `defineRpcServer` / `defineRpcClient` for typed request/response over RabbitMQ.

Defining an RPC operation:

```typescript
import {
  defineContract,
  defineMessage,
  defineQueue,
  defineRpcClient,
  defineRpcServer,
} from "@amqp-contract/contract";
import { z } from "zod";

const calculateRpc = defineRpcServer(defineQueue("rpc.calculate"), {
  request: defineMessage(z.object({ a: z.number(), b: z.number() })),
  response: defineMessage(z.object({ sum: z.number() })),
});

const contract = defineContract({
  consumers: { calculate: calculateRpc },
  publishers: { calculate: defineRpcClient(calculateRpc) },
});
```

The worker handler returns the response payload (validated against the response schema before being published back to the caller's `replyTo`):

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

**Implementation notes:**

- Uses RabbitMQ direct reply-to (`amq.rabbitmq.reply-to`) — no reply queue declaration needed.
- Routes via the AMQP default direct exchange with the server's queue name as routing key.
- A single reply consumer demultiplexes responses by `correlationId`; the client manages an in-memory pending-call map.
- Closing the client rejects every in-flight call with `RpcCancelledError`.
- Response-schema validation failures on the server are mapped to `NonRetryableError` (handler bug → DLQ).
- AsyncAPI generation surfaces RPC publishers/consumers as ordinary publish/receive operations; richer `requestReply` operation pairs are tracked as a follow-up.
