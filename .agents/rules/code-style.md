# Code Style

## TypeScript Rules

- **No `any` types** — enforced by oxlint. Use `unknown` for dynamic data, then narrow.
- **Type aliases over interfaces** — use `type Foo = {}` not `interface Foo {}`
- **`.js` extensions required** — all imports must include `.js` extension (ESM requirement)
- **Standard Schema v1** — for runtime validation (Zod, Valibot, ArkType supported)
- **Catalog dependencies** — use `pnpm-workspace.yaml` catalog, not hardcoded versions
- **Future/Result handlers** — always use `Future<Result<void, HandlerError>>`, not `async`
- **Conventional commits** — required (feat, fix, docs, chore, test, refactor)
- **Strict mode** — enabled in tsconfig.json
- Prefer `readonly` arrays and properties where appropriate
- Prefer `const` over `let`
- Use nullish coalescing (`?? {}`) for optional object parameters, not `||`

## Composition Pattern

Define resources first, then reference them. Never define resources inline:

```typescript
// Bad — defining resources inline
const contract = defineContract({
  publishers: {
    orderCreated: definePublisher(
      defineExchange("orders", "topic", { durable: true }),
      defineMessage(z.object({ orderId: z.string() })),
      { routingKey: "order.created" },
    ),
  },
});

// Good — define resources first, then reference
const ordersExchange = defineExchange("orders", "topic", { durable: true });
const orderProcessingQueue = defineQueue("order-processing", { durable: true });
const orderMessage = defineMessage(z.object({ orderId: z.string() }));

const orderCreatedEvent = defineEventPublisher(ordersExchange, orderMessage, {
  routingKey: "order.created",
});

const contract = defineContract({
  publishers: { orderCreated: orderCreatedEvent },
  consumers: { processOrder: defineEventConsumer(orderCreatedEvent, orderProcessingQueue) },
});
```

## Anti-Patterns

```typescript
// Bad — using async handlers
processOrder: async ({ payload }) => {
  await process(payload);
};

// Good — use Future/Result pattern
processOrder: ({ payload }) =>
  Future.fromPromise(process(payload))
    .mapOk(() => undefined)
    .mapError((e) => new RetryableError("Failed", e));

// Bad — accessing message directly
processOrder: (message) => {
  console.log(message.orderId);
};

// Good — destructure payload
processOrder: ({ payload }) => {
  console.log(payload.orderId);
};

// Bad — using classic queues without retry config
defineQueue("orders", { type: "classic" });

// Good — use quorum queues with retry config
defineQueue("orders", {
  deadLetter: { exchange: dlx },
  retry: { mode: "quorum-native" },
  deliveryLimit: 3,
});

// Bad — accessing .name directly on TTL-backoff queue
const queue = defineQueue("orders", {
  deadLetter: { exchange: dlx },
  retry: { mode: "ttl-backoff" },
});
console.log(queue.name); // Error: queue may be a wrapper object

// Good — use extractQueue() to access queue properties
import { extractQueue } from "@amqp-contract/contract";
console.log(extractQueue(queue).name);

// Bad — hardcoded version in package.json
"devDependencies": {
  "vitest": "^4.0.0"
}

// Good — using catalog
"devDependencies": {
  "vitest": "catalog:"
}

// Bad — missing .js extension
import { helper } from "./utils";

// Good
import { helper } from "./utils.js";

// Bad — using any
function process(data: any): any {}

// Good
function process(data: unknown): string {
  if (typeof data === "string") {
    return data.toUpperCase();
  }
  throw new Error("Invalid data");
}

// Bad — using interface
export interface PublishOptions extends Options.Publish {
  compression?: string;
}

// Good — using type alias
export type PublishOptions = Options.Publish & {
  compression?: CompressionAlgorithm;
};

// Bad — using || for optional objects
function process(options) {
  const { field, ...rest } = options || {};
}

// Good — using ?? for optional objects
function process(options) {
  const { field, ...rest } = options ?? {};
}
```

## Additional Rules

- Never use `@ts-ignore` or `@ts-expect-error` without explanation — fix the root cause
- Public APIs should have JSDoc comments
- Explain "why" not "what" in inline comments
- Use Standard Schema v1 for validation — don't create custom validation logic
- Choose the right exchange type for the use case — don't use topic when direct suffices
- Quorum queues are the default — only use classic queues with good reason
