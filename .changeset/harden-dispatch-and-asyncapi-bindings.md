---
"@amqp-contract/asyncapi": minor
"@amqp-contract/client": minor
"@amqp-contract/contract": minor
"@amqp-contract/core": minor
"@amqp-contract/testing": minor
"@amqp-contract/worker": minor
---

Harden the worker dispatch loop, surface AMQP topology details in the AsyncAPI generator, and tighten a few public defaults.

**Worker**

- The consume callback is now wrapped in a defensive try/catch — a handler that throws synchronously (or an unexpected fault inside the dispatch chain) no longer leaves messages neither acked nor nacked. The message is logged and nacked with `requeue=false` so a configured DLX still receives it.
- Schema validation and parse errors take an explicit DLQ path and never enter the queue's retry pipeline. Retrying a malformed payload cannot succeed, so the previous behaviour wasted retry budget on guaranteed failures.
- RPC reply-side failures (missing `replyTo`, missing `correlationId`, response schema failure, reply publish failure) now return `NonRetryableError` instead of being swallowed or surfacing as `RetryableError`. The original message lands in the DLQ for inspection rather than being silently retried against a caller that has already gone away.
- The retry re-publish path respects `properties.contentType`: only round-trip JSON payloads, pass binary content through unchanged.

**Contract**

- `defineContract` now throws when two publishers/consumers reference the same exchange or queue _name_ with conflicting definitions (e.g. different `type`, `durable`, or `retry` settings). Identical re-declarations continue to deduplicate silently — the common pattern of one exchange flowing into the contract through both a publisher and a consumer is unaffected.

**Core**

- `AmqpClient.connectTimeoutMs` defaults to 30 s (`DEFAULT_CONNECT_TIMEOUT_MS`). Pass `null` to opt back into the legacy "wait forever" behaviour. Avoids hangs on misconfigured URLs or down brokers.
- `ConnectionManagerSingleton` is no longer part of the public API. Use the underscore-prefixed `_resetConnectionsForTesting` and `_getConnectionCountForTesting` helpers instead.
- New `recordLateRpcReply` telemetry helper and `amqp.client.rpc.late_reply` counter. The client uses it whenever a reply arrives without a matching pending call (caller already timed out / cancelled / unknown correlationId), and elevates the corresponding log from `debug` to `warn`.
- The OpenTelemetry instrumentation scope version is now sourced from `package.json` instead of a hardcoded constant.

**AsyncAPI**

- Queue channels surface dead-lettering via `x-dead-letter-exchange` / `x-dead-letter-routing-key` in the AMQP binding's `arguments`, the queue description summarises DLX + retry mode, and an `x-amqp-retry` extension carries the structured retry config.
- Exchange channels surface bridge / e2e bindings via the description (`forwards to '…'`, `receives from '…'`) and an `x-amqp-exchange-bindings` extension so cross-domain topology is visible in the generated spec.
- New `failOnMissingConverter` generator option throws when a payload schema cannot be converted instead of falling back to a generic `{ type: "object" }` placeholder. Recommended for CI pipelines.

**Docs**

- New guide pages: `error-model`, `retry-strategies`, `bridge-exchanges`. New example: `command-pattern`. `worker-usage` now leads with `defineHandler`. `CONTRIBUTING` documents the changesets-driven release workflow.
