**@amqp-contract/worker**

---

# @amqp-contract/worker

## Classes

### MessageValidationError

Defined in: [packages/worker/src/errors.ts:35](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/worker/src/errors.ts#L35)

Error thrown when message validation fails

#### Extends

- `WorkerError`

#### Constructors

##### Constructor

```ts
new MessageValidationError(consumerName, issues): MessageValidationError;
```

Defined in: [packages/worker/src/errors.ts:36](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/worker/src/errors.ts#L36)

###### Parameters

| Parameter      | Type      |
| -------------- | --------- |
| `consumerName` | `string`  |
| `issues`       | `unknown` |

###### Returns

[`MessageValidationError`](#messagevalidationerror)

###### Overrides

```ts
WorkerError.constructor;
```

#### Properties

| Property                                       | Modifier   | Type      | Description                                                                                                                                                                                                                                                                                                                                                                                                                                       | Inherited from                | Defined in                                                                                                                                                    |
| ---------------------------------------------- | ---------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="cause"></a> `cause?`                    | `public`   | `unknown` | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `WorkerError.cause`           | node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/lib.es2022.error.d.ts:26                                                                      |
| <a id="consumername"></a> `consumerName`       | `readonly` | `string`  | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | -                             | [packages/worker/src/errors.ts:37](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/worker/src/errors.ts#L37) |
| <a id="issues"></a> `issues`                   | `readonly` | `unknown` | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | -                             | [packages/worker/src/errors.ts:38](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/worker/src/errors.ts#L38) |
| <a id="message"></a> `message`                 | `public`   | `string`  | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `WorkerError.message`         | node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/lib.es5.d.ts:1077                                                                             |
| <a id="name"></a> `name`                       | `public`   | `string`  | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `WorkerError.name`            | node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/lib.es5.d.ts:1076                                                                             |
| <a id="stack"></a> `stack?`                    | `public`   | `string`  | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `WorkerError.stack`           | node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/lib.es5.d.ts:1078                                                                             |
| <a id="stacktracelimit"></a> `stackTraceLimit` | `static`   | `number`  | The `Error.stackTraceLimit` property specifies the number of stack frames collected by a stack trace (whether generated by `new Error().stack` or `Error.captureStackTrace(obj)`). The default value is `10` but may be set to any valid JavaScript number. Changes will affect any stack trace captured _after_ the value has been changed. If set to a non-number value, or set to a negative number, stack traces will not capture any frames. | `WorkerError.stackTraceLimit` | node_modules/.pnpm/@types+node@25.0.3/node_modules/@types/node/globals.d.ts:67                                                                                |

#### Methods

##### captureStackTrace()

```ts
static captureStackTrace(targetObject, constructorOpt?): void;
```

Defined in: node_modules/.pnpm/@types+node@25.0.3/node_modules/@types/node/globals.d.ts:51

Creates a `.stack` property on `targetObject`, which when accessed returns
a string representing the location in the code at which
`Error.captureStackTrace()` was called.

```js
const myObject = {};
Error.captureStackTrace(myObject);
myObject.stack; // Similar to `new Error().stack`
```

The first line of the trace will be prefixed with
`${myObject.name}: ${myObject.message}`.

The optional `constructorOpt` argument accepts a function. If given, all frames
above `constructorOpt`, including `constructorOpt`, will be omitted from the
generated stack trace.

The `constructorOpt` argument is useful for hiding implementation
details of error generation from the user. For instance:

```js
function a() {
  b();
}

function b() {
  c();
}

function c() {
  // Create an error without stack trace to avoid calculating the stack trace twice.
  const { stackTraceLimit } = Error;
  Error.stackTraceLimit = 0;
  const error = new Error();
  Error.stackTraceLimit = stackTraceLimit;

  // Capture the stack trace above function b
  Error.captureStackTrace(error, b); // Neither function c, nor b is included in the stack trace
  throw error;
}

a();
```

###### Parameters

| Parameter         | Type       |
| ----------------- | ---------- |
| `targetObject`    | `object`   |
| `constructorOpt?` | `Function` |

###### Returns

`void`

###### Inherited from

```ts
WorkerError.captureStackTrace;
```

##### prepareStackTrace()

```ts
static prepareStackTrace(err, stackTraces): any;
```

Defined in: node_modules/.pnpm/@types+node@25.0.3/node_modules/@types/node/globals.d.ts:55

###### Parameters

| Parameter     | Type         |
| ------------- | ------------ |
| `err`         | `Error`      |
| `stackTraces` | `CallSite`[] |

###### Returns

`any`

###### See

https://v8.dev/docs/stack-trace-api#customizing-stack-traces

###### Inherited from

```ts
WorkerError.prepareStackTrace;
```

---

### TechnicalError

Defined in: [packages/worker/src/errors.ts:22](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/worker/src/errors.ts#L22)

Error for technical/runtime failures in worker operations
This includes validation failures, parsing failures, and processing failures

#### Extends

- `WorkerError`

#### Constructors

##### Constructor

```ts
new TechnicalError(message, cause?): TechnicalError;
```

Defined in: [packages/worker/src/errors.ts:23](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/worker/src/errors.ts#L23)

###### Parameters

| Parameter | Type      |
| --------- | --------- |
| `message` | `string`  |
| `cause?`  | `unknown` |

###### Returns

[`TechnicalError`](#technicalerror)

###### Overrides

```ts
WorkerError.constructor;
```

#### Properties

| Property                                         | Modifier   | Type      | Description                                                                                                                                                                                                                                                                                                                                                                                                                                       | Inherited from                | Defined in                                                                                                                                                    |
| ------------------------------------------------ | ---------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="cause-1"></a> `cause?`                    | `readonly` | `unknown` | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `WorkerError.cause`           | [packages/worker/src/errors.ts:25](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/worker/src/errors.ts#L25) |
| <a id="message-1"></a> `message`                 | `public`   | `string`  | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `WorkerError.message`         | node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/lib.es5.d.ts:1077                                                                             |
| <a id="name-1"></a> `name`                       | `public`   | `string`  | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `WorkerError.name`            | node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/lib.es5.d.ts:1076                                                                             |
| <a id="stack-1"></a> `stack?`                    | `public`   | `string`  | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `WorkerError.stack`           | node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/lib.es5.d.ts:1078                                                                             |
| <a id="stacktracelimit-1"></a> `stackTraceLimit` | `static`   | `number`  | The `Error.stackTraceLimit` property specifies the number of stack frames collected by a stack trace (whether generated by `new Error().stack` or `Error.captureStackTrace(obj)`). The default value is `10` but may be set to any valid JavaScript number. Changes will affect any stack trace captured _after_ the value has been changed. If set to a non-number value, or set to a negative number, stack traces will not capture any frames. | `WorkerError.stackTraceLimit` | node_modules/.pnpm/@types+node@25.0.3/node_modules/@types/node/globals.d.ts:67                                                                                |

#### Methods

##### captureStackTrace()

```ts
static captureStackTrace(targetObject, constructorOpt?): void;
```

Defined in: node_modules/.pnpm/@types+node@25.0.3/node_modules/@types/node/globals.d.ts:51

Creates a `.stack` property on `targetObject`, which when accessed returns
a string representing the location in the code at which
`Error.captureStackTrace()` was called.

```js
const myObject = {};
Error.captureStackTrace(myObject);
myObject.stack; // Similar to `new Error().stack`
```

The first line of the trace will be prefixed with
`${myObject.name}: ${myObject.message}`.

The optional `constructorOpt` argument accepts a function. If given, all frames
above `constructorOpt`, including `constructorOpt`, will be omitted from the
generated stack trace.

The `constructorOpt` argument is useful for hiding implementation
details of error generation from the user. For instance:

```js
function a() {
  b();
}

function b() {
  c();
}

function c() {
  // Create an error without stack trace to avoid calculating the stack trace twice.
  const { stackTraceLimit } = Error;
  Error.stackTraceLimit = 0;
  const error = new Error();
  Error.stackTraceLimit = stackTraceLimit;

  // Capture the stack trace above function b
  Error.captureStackTrace(error, b); // Neither function c, nor b is included in the stack trace
  throw error;
}

a();
```

###### Parameters

| Parameter         | Type       |
| ----------------- | ---------- |
| `targetObject`    | `object`   |
| `constructorOpt?` | `Function` |

###### Returns

`void`

###### Inherited from

```ts
WorkerError.captureStackTrace;
```

##### prepareStackTrace()

```ts
static prepareStackTrace(err, stackTraces): any;
```

Defined in: node_modules/.pnpm/@types+node@25.0.3/node_modules/@types/node/globals.d.ts:55

###### Parameters

| Parameter     | Type         |
| ------------- | ------------ |
| `err`         | `Error`      |
| `stackTraces` | `CallSite`[] |

###### Returns

`any`

###### See

https://v8.dev/docs/stack-trace-api#customizing-stack-traces

###### Inherited from

```ts
WorkerError.prepareStackTrace;
```

---

### TypedAmqpWorker

Defined in: [packages/worker/src/worker.ts:80](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/worker/src/worker.ts#L80)

Type-safe AMQP worker for consuming messages from RabbitMQ.

This class provides automatic message validation, connection management,
and error handling for consuming messages based on a contract definition.

#### Example

```typescript
import { TypedAmqpWorker } from "@amqp-contract/worker";
import { z } from "zod";

const contract = defineContract({
  queues: {
    orderProcessing: defineQueue("order-processing", { durable: true }),
  },
  consumers: {
    processOrder: defineConsumer(
      "order-processing",
      z.object({
        orderId: z.string(),
        amount: z.number(),
      }),
    ),
  },
});

const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      console.log("Processing order", message.orderId);
      // Process the order...
    },
  },
  urls: ["amqp://localhost"],
}).resultToPromise();

// Close when done
await worker.close().resultToPromise();
```

#### Type Parameters

| Type Parameter                             | Description                  |
| ------------------------------------------ | ---------------------------- |
| `TContract` _extends_ `ContractDefinition` | The contract definition type |

#### Methods

##### close()

```ts
close(): Future<Result<void, TechnicalError>>;
```

Defined in: [packages/worker/src/worker.ts:150](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/worker/src/worker.ts#L150)

Close the AMQP channel and connection.

This gracefully closes the connection to the AMQP broker,
stopping all message consumption and cleaning up resources.

###### Returns

`Future`\<`Result`\<`void`, [`TechnicalError`](#technicalerror)\>\>

A Future that resolves to a Result indicating success or failure

###### Example

```typescript
const closeResult = await worker.close().resultToPromise();
if (closeResult.isOk()) {
  console.log("Worker closed successfully");
}
```

##### create()

```ts
static create<TContract>(options): Future<Result<TypedAmqpWorker<TContract>, TechnicalError>>;
```

Defined in: [packages/worker/src/worker.ts:113](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/worker/src/worker.ts#L113)

Create a type-safe AMQP worker from a contract.

Connection management (including automatic reconnection) is handled internally
by amqp-connection-manager via the AmqpClient. The worker will set up
consumers for all contract-defined handlers asynchronously in the background
once the underlying connection and channels are ready.

###### Type Parameters

| Type Parameter                             |
| ------------------------------------------ |
| `TContract` _extends_ `ContractDefinition` |

###### Parameters

| Parameter | Type                                                         | Description                          |
| --------- | ------------------------------------------------------------ | ------------------------------------ |
| `options` | [`CreateWorkerOptions`](#createworkeroptions)\<`TContract`\> | Configuration options for the worker |

###### Returns

`Future`\<`Result`\<[`TypedAmqpWorker`](#typedamqpworker)\<`TContract`\>, [`TechnicalError`](#technicalerror)\>\>

A Future that resolves to a Result containing the worker or an error

###### Example

```typescript
const workerResult = await TypedAmqpWorker.create({
  contract: myContract,
  handlers: {
    processOrder: async (msg) => console.log("Order:", msg.orderId),
  },
  urls: ["amqp://localhost"],
}).resultToPromise();

if (workerResult.isError()) {
  console.error("Failed to create worker:", workerResult.error);
}
```

## Type Aliases

### CreateWorkerOptions

```ts
type CreateWorkerOptions<TContract> = object;
```

Defined in: [packages/worker/src/worker.ts:29](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/worker/src/worker.ts#L29)

Options for creating a type-safe AMQP worker.

#### Example

```typescript
const options: CreateWorkerOptions<typeof contract> = {
  contract: myContract,
  handlers: {
    processOrder: async (message) => {
      console.log("Processing order:", message.orderId);
    },
  },
  urls: ["amqp://localhost"],
  connectionOptions: {
    heartbeatIntervalInSeconds: 30,
  },
};
```

#### Type Parameters

| Type Parameter                             | Description                  |
| ------------------------------------------ | ---------------------------- |
| `TContract` _extends_ `ContractDefinition` | The contract definition type |

#### Properties

| Property                                            | Type                                                                         | Description                                                                 | Defined in                                                                                                                                                    |
| --------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="connectionoptions"></a> `connectionOptions?` | `AmqpConnectionManagerOptions`                                               | Optional connection configuration (heartbeat, reconnect settings, etc.)     | [packages/worker/src/worker.ts:37](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/worker/src/worker.ts#L37) |
| <a id="contract"></a> `contract`                    | `TContract`                                                                  | The AMQP contract definition specifying consumers and their message schemas | [packages/worker/src/worker.ts:31](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/worker/src/worker.ts#L31) |
| <a id="handlers"></a> `handlers`                    | [`WorkerInferConsumerHandlers`](#workerinferconsumerhandlers)\<`TContract`\> | Handlers for each consumer defined in the contract                          | [packages/worker/src/worker.ts:33](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/worker/src/worker.ts#L33) |
| <a id="urls"></a> `urls`                            | `ConnectionUrl`[]                                                            | AMQP broker URL(s). Multiple URLs provide failover support                  | [packages/worker/src/worker.ts:35](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/worker/src/worker.ts#L35) |

---

### WorkerInferConsumerHandler()

```ts
type WorkerInferConsumerHandler<TContract, TName> = (message) => Promise<void>;
```

Defined in: [packages/worker/src/types.ts:45](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/worker/src/types.ts#L45)

Infer consumer handler type for a specific consumer

#### Type Parameters

| Type Parameter                                        |
| ----------------------------------------------------- |
| `TContract` _extends_ `ContractDefinition`            |
| `TName` _extends_ `InferConsumerNames`\<`TContract`\> |

#### Parameters

| Parameter | Type                                                                            |
| --------- | ------------------------------------------------------------------------------- |
| `message` | [`WorkerInferConsumerInput`](#workerinferconsumerinput)\<`TContract`, `TName`\> |

#### Returns

`Promise`\<`void`\>

---

### WorkerInferConsumerHandlers

```ts
type WorkerInferConsumerHandlers<TContract> = {
  [K in InferConsumerNames<TContract>]: WorkerInferConsumerHandler<TContract, K>;
};
```

Defined in: [packages/worker/src/types.ts:53](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/worker/src/types.ts#L53)

Infer all consumer handlers for a contract

#### Type Parameters

| Type Parameter                             |
| ------------------------------------------ |
| `TContract` _extends_ `ContractDefinition` |

---

### WorkerInferConsumerInput

```ts
type WorkerInferConsumerInput<TContract, TName> = ConsumerInferInput<
  InferConsumer<TContract, TName>
>;
```

Defined in: [packages/worker/src/types.ts:37](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/worker/src/types.ts#L37)

Worker perspective types - for consuming messages

#### Type Parameters

| Type Parameter                                        |
| ----------------------------------------------------- |
| `TContract` _extends_ `ContractDefinition`            |
| `TName` _extends_ `InferConsumerNames`\<`TContract`\> |

## Functions

### defineHandler()

```ts
function defineHandler<TContract, TName>(
  contract,
  consumerName,
  handler,
): WorkerInferConsumerHandler<TContract, TName>;
```

Defined in: [packages/worker/src/handlers.ts:73](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/worker/src/handlers.ts#L73)

Define a type-safe handler for a specific consumer in a contract.

This utility allows you to define handlers outside of the worker creation,
providing better code organization and reusability.

#### Type Parameters

| Type Parameter                                     | Description                         |
| -------------------------------------------------- | ----------------------------------- |
| `TContract` _extends_ `ContractDefinition`         | The contract definition type        |
| `TName` _extends_ `string` \| `number` \| `symbol` | The consumer name from the contract |

#### Parameters

| Parameter      | Type                                                                                | Description                                        |
| -------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------- |
| `contract`     | `TContract`                                                                         | The contract definition containing the consumer    |
| `consumerName` | `TName`                                                                             | The name of the consumer from the contract         |
| `handler`      | [`WorkerInferConsumerHandler`](#workerinferconsumerhandler)\<`TContract`, `TName`\> | The async handler function that processes messages |

#### Returns

[`WorkerInferConsumerHandler`](#workerinferconsumerhandler)\<`TContract`, `TName`\>

A type-safe handler that can be used with TypedAmqpWorker

#### Examples

```typescript
import { defineHandler } from "@amqp-contract/worker";
import { orderContract } from "./contract";

// Define handler outside of worker creation
const processOrderHandler = defineHandler(orderContract, "processOrder", async (message) => {
  // message is fully typed based on the contract
  console.log("Processing order:", message.orderId);
  await processPayment(message);
});

// Use the handler in worker
const worker = await TypedAmqpWorker.create({
  contract: orderContract,
  handlers: {
    processOrder: processOrderHandler,
  },
  connection: "amqp://localhost",
});
```

```typescript
// Define multiple handlers
const processOrderHandler = defineHandler(orderContract, "processOrder", async (message) => {
  await processOrder(message);
});

const notifyOrderHandler = defineHandler(orderContract, "notifyOrder", async (message) => {
  await sendNotification(message);
});

// Compose handlers
const worker = await TypedAmqpWorker.create({
  contract: orderContract,
  handlers: {
    processOrder: processOrderHandler,
    notifyOrder: notifyOrderHandler,
  },
  connection: "amqp://localhost",
});
```

---

### defineHandlers()

```ts
function defineHandlers<TContract>(contract, handlers): WorkerInferConsumerHandlers<TContract>;
```

Defined in: [packages/worker/src/handlers.ts:152](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/worker/src/handlers.ts#L152)

Define multiple type-safe handlers for consumers in a contract.

This utility allows you to define all handlers at once outside of the worker creation,
ensuring type safety and providing better code organization.

#### Type Parameters

| Type Parameter                             | Description                  |
| ------------------------------------------ | ---------------------------- |
| `TContract` _extends_ `ContractDefinition` | The contract definition type |

#### Parameters

| Parameter  | Type                                                                         | Description                                              |
| ---------- | ---------------------------------------------------------------------------- | -------------------------------------------------------- |
| `contract` | `TContract`                                                                  | The contract definition containing the consumers         |
| `handlers` | [`WorkerInferConsumerHandlers`](#workerinferconsumerhandlers)\<`TContract`\> | An object with async handler functions for each consumer |

#### Returns

[`WorkerInferConsumerHandlers`](#workerinferconsumerhandlers)\<`TContract`\>

A type-safe handlers object that can be used with TypedAmqpWorker

#### Examples

```typescript
import { defineHandlers } from "@amqp-contract/worker";
import { orderContract } from "./contract";

// Define all handlers at once
const handlers = defineHandlers(orderContract, {
  processOrder: async (message) => {
    // message is fully typed based on the contract
    console.log("Processing order:", message.orderId);
    await processPayment(message);
  },
  notifyOrder: async (message) => {
    await sendNotification(message);
  },
  shipOrder: async (message) => {
    await prepareShipment(message);
  },
});

// Use the handlers in worker
const worker = await TypedAmqpWorker.create({
  contract: orderContract,
  handlers,
  connection: "amqp://localhost",
});
```

```typescript
// Separate handler definitions for better organization
async function handleProcessOrder(
  message: WorkerInferConsumerInput<typeof orderContract, "processOrder">,
) {
  await processOrder(message);
}

async function handleNotifyOrder(
  message: WorkerInferConsumerInput<typeof orderContract, "notifyOrder">,
) {
  await sendNotification(message);
}

const handlers = defineHandlers(orderContract, {
  processOrder: handleProcessOrder,
  notifyOrder: handleNotifyOrder,
});
```
