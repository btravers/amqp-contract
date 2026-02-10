---
"@amqp-contract/contract": minor
---

Unify dead letter configuration to use nested `deadLetter` shape

`defineQuorumQueue()` and `defineTtlBackoffQueue()` now accept `deadLetter: { exchange, routingKey? }` (the `DeadLetterConfig` type) instead of flat `deadLetterExchange` and `deadLetterRoutingKey` properties. This aligns them with `defineQueue()`, giving all queue builders a single consistent pattern for declaring dead lettering.

**Migration:**

```typescript
// Before
defineQuorumQueue("orders", {
  deadLetterExchange: dlx,
  deadLetterRoutingKey: "failed",
  deliveryLimit: 3,
});

// After
defineQuorumQueue("orders", {
  deadLetter: { exchange: dlx, routingKey: "failed" },
  deliveryLimit: 3,
});
```
