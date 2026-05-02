---
"@amqp-contract/core": minor
"@amqp-contract/client": minor
"@amqp-contract/worker": minor
---

Add `connectTimeoutMs` option to `TypedAmqpClient.create()`, `TypedAmqpWorker.create()`, and `AmqpClient`, and fix a connection leak on the failure path.

`amqp-connection-manager` retries connections indefinitely and never rejects `waitForConnect` on its own. Without a timeout, a misconfigured URL or unreachable broker pinned the call forever. The new `connectTimeoutMs` option races `waitForConnect` against a timer so `create()` can fail fast.

The same code path also fixes a connection leak: when `create()` failed (timeout, or `consumeAll` erroring after some consumers had registered), the connection's reference count in `ConnectionManagerSingleton` stayed incremented and any registered consumers stayed running. Both factories now invoke `close()` before propagating the error.
