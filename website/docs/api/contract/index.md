**@amqp-contract/contract**

---

# @amqp-contract/contract

## Type Aliases

### AnySchema

```ts
type AnySchema = StandardSchemaV1;
```

Defined in: [types.ts:12](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L12)

Any schema that conforms to Standard Schema v1.

This library supports any validation library that implements the Standard Schema v1 specification,
including Zod, Valibot, and ArkType. This allows you to use your preferred validation library
while maintaining type safety.

#### See

https://github.com/standard-schema/standard-schema

---

### BaseExchangeDefinition

```ts
type BaseExchangeDefinition = object;
```

Defined in: [types.ts:20](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L20)

Base definition of an AMQP exchange.

An exchange receives messages from publishers and routes them to queues based on the exchange
type and routing rules. This type contains properties common to all exchange types.

#### Properties

| Property                              | Type                            | Description                                                                                                                                                                | Defined in                                                                                                                                |
| ------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="arguments"></a> `arguments?`   | `Record`\<`string`, `unknown`\> | Additional AMQP arguments for advanced configuration. Common arguments include alternate-exchange for handling unroutable messages.                                        | [types.ts:49](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L49) |
| <a id="autodelete"></a> `autoDelete?` | `boolean`                       | If true, the exchange is deleted when all queues have finished using it. **Default** `false`                                                                               | [types.ts:36](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L36) |
| <a id="durable"></a> `durable?`       | `boolean`                       | If true, the exchange survives broker restarts. Durable exchanges are persisted to disk. **Default** `false`                                                               | [types.ts:30](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L30) |
| <a id="internal"></a> `internal?`     | `boolean`                       | If true, the exchange cannot be directly published to by clients. It can only receive messages from other exchanges via exchange-to-exchange bindings. **Default** `false` | [types.ts:43](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L43) |
| <a id="name"></a> `name`              | `string`                        | The name of the exchange. Must be unique within the RabbitMQ virtual host.                                                                                                 | [types.ts:24](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L24) |

---

### BindingDefinition

```ts
type BindingDefinition =
  | QueueBindingDefinition
  | ExchangeBindingDefinition;
```

Defined in: [types.ts:298](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L298)

Union type of all binding definitions.

A binding can be either:

- Queue-to-exchange binding: Routes messages from an exchange to a queue
- Exchange-to-exchange binding: Forwards messages from one exchange to another

---

### ConsumerDefinition

```ts
type ConsumerDefinition<TMessage> = object;
```

Defined in: [types.ts:354](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L354)

Definition of a message consumer.

A consumer receives and processes messages from a queue with automatic schema validation.
The message payload is validated against the schema before being passed to your handler.

#### Example

```typescript
const consumer: ConsumerDefinition = {
  queue: orderProcessingQueue,
  message: orderMessage
};
```

#### Type Parameters

| Type Parameter                                                 | Default type                              | Description                                |
| -------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------ |
| `TMessage` _extends_ [`MessageDefinition`](#messagedefinition) | [`MessageDefinition`](#messagedefinition) | The message definition with payload schema |

#### Properties

| Property                       | Type                                  | Description                                         | Defined in                                                                                                                                  |
| ------------------------------ | ------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="message"></a> `message` | `TMessage`                            | The message definition including the payload schema | [types.ts:359](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L359) |
| <a id="queue"></a> `queue`     | [`QueueDefinition`](#queuedefinition) | The queue to consume messages from                  | [types.ts:356](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L356) |

---

### ConsumerFirstResult

```ts
type ConsumerFirstResult<TMessage, TConsumer, TBinding> = object;
```

Defined in: [builder.ts:1249](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/builder.ts#L1249)

Consumer-first builder result for fanout and direct exchanges.

This type represents a consumer with its binding and provides a method to create
a publisher that uses the same message schema and routing key.

#### Type Parameters

| Type Parameter                                                                  | Description                  |
| ------------------------------------------------------------------------------- | ---------------------------- |
| `TMessage` _extends_ [`MessageDefinition`](#messagedefinition)                  | The message definition       |
| `TConsumer` _extends_ [`ConsumerDefinition`](#consumerdefinition)\<`TMessage`\> | The consumer definition      |
| `TBinding` _extends_ [`QueueBindingDefinition`](#queuebindingdefinition)        | The queue binding definition |

#### Properties

| Property                                       | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Description                                                                                                                            | Defined in                                                                                                                                        |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="binding"></a> `binding`                 | `TBinding`                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | The binding definition connecting the exchange to the queue                                                                            | [builder.ts:1257](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/builder.ts#L1257) |
| <a id="consumer"></a> `consumer`               | `TConsumer`                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | The consumer definition                                                                                                                | [builder.ts:1255](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/builder.ts#L1255) |
| <a id="createpublisher"></a> `createPublisher` | () => `TBinding`\[`"exchange"`\] _extends_ [`FanoutExchangeDefinition`](#fanoutexchangedefinition) ? `Extract`\<[`PublisherDefinition`](#publisherdefinition)\<`TMessage`\>, \{ `exchange`: [`FanoutExchangeDefinition`](#fanoutexchangedefinition); \}\> : `Extract`\<[`PublisherDefinition`](#publisherdefinition)\<`TMessage`\>, \{ `exchange`: \| [`DirectExchangeDefinition`](#directexchangedefinition) \| [`TopicExchangeDefinition`](#topicexchangedefinition); \}\> | Create a publisher that sends messages to this consumer. The publisher will automatically use the same message schema and routing key. | [builder.ts:1264](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/builder.ts#L1264) |

---

### ConsumerFirstResultWithRoutingKey

```ts
type ConsumerFirstResultWithRoutingKey<TMessage, TConsumer, TBinding> = object;
```

Defined in: [builder.ts:1282](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/builder.ts#L1282)

Consumer-first builder result for topic exchanges.

This type represents a consumer with its binding (which may use a pattern) and provides
a method to create a publisher with a concrete routing key that matches the pattern.

#### Type Parameters

| Type Parameter                                                                  | Description                  |
| ------------------------------------------------------------------------------- | ---------------------------- |
| `TMessage` _extends_ [`MessageDefinition`](#messagedefinition)                  | The message definition       |
| `TConsumer` _extends_ [`ConsumerDefinition`](#consumerdefinition)\<`TMessage`\> | The consumer definition      |
| `TBinding` _extends_ [`QueueBindingDefinition`](#queuebindingdefinition)        | The queue binding definition |

#### Properties

| Property                                         | Type                                                                                                    | Description                                                                                                                                  | Defined in                                                                                                                                        |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="binding-1"></a> `binding`                 | `TBinding`                                                                                              | The binding definition connecting the exchange to the queue                                                                                  | [builder.ts:1290](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/builder.ts#L1290) |
| <a id="consumer-1"></a> `consumer`               | `TConsumer`                                                                                             | The consumer definition                                                                                                                      | [builder.ts:1288](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/builder.ts#L1288) |
| <a id="createpublisher-1"></a> `createPublisher` | \<`TPublisherRoutingKey`\>(`routingKey`) => [`PublisherDefinition`](#publisherdefinition)\<`TMessage`\> | Create a publisher that sends messages to this consumer. For topic exchanges, the routing key can be specified to match the binding pattern. | [builder.ts:1298](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/builder.ts#L1298) |

---

### ContractDefinition

```ts
type ContractDefinition = object;
```

Defined in: [types.ts:395](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L395)

Complete AMQP contract definition.

A contract brings together all AMQP resources into a single, type-safe definition.
It defines the complete messaging topology including exchanges, queues, bindings,
publishers, and consumers.

The contract is used by:

- Clients (TypedAmqpClient) for type-safe message publishing
- Workers (TypedAmqpWorker) for type-safe message consumption
- AsyncAPI generator for documentation

#### Example

```typescript
const contract: ContractDefinition = {
  exchanges: {
    orders: ordersExchange,
  },
  queues: {
    orderProcessing: orderProcessingQueue,
  },
  bindings: {
    orderBinding: orderQueueBinding,
  },
  publishers: {
    orderCreated: orderCreatedPublisher,
  },
  consumers: {
    processOrder: processOrderConsumer,
  },
};
```

#### Properties

| Property                              | Type                                                                | Description                                                                                                                                                        | Defined in                                                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="bindings"></a> `bindings?`     | `Record`\<`string`, [`BindingDefinition`](#bindingdefinition)\>     | Named binding definitions. Bindings can be queue-to-exchange or exchange-to-exchange.                                                                              | [types.ts:412](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L412) |
| <a id="consumers"></a> `consumers?`   | `Record`\<`string`, [`ConsumerDefinition`](#consumerdefinition)\>   | Named consumer definitions. Each key requires a corresponding handler in the TypedAmqpWorker. The handler will be fully typed based on the message schema.         | [types.ts:426](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L426) |
| <a id="exchanges"></a> `exchanges?`   | `Record`\<`string`, [`ExchangeDefinition`](#exchangedefinition)\>   | Named exchange definitions. Each key becomes available as a named resource in the contract.                                                                        | [types.ts:400](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L400) |
| <a id="publishers"></a> `publishers?` | `Record`\<`string`, [`PublisherDefinition`](#publisherdefinition)\> | Named publisher definitions. Each key becomes a method on the TypedAmqpClient for publishing messages. The method will be fully typed based on the message schema. | [types.ts:419](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L419) |
| <a id="queues"></a> `queues?`         | `Record`\<`string`, [`QueueDefinition`](#queuedefinition)\>         | Named queue definitions. Each key becomes available as a named resource in the contract.                                                                           | [types.ts:406](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L406) |

---

### DirectExchangeDefinition

```ts
type DirectExchangeDefinition = BaseExchangeDefinition & object;
```

Defined in: [types.ts:82](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L82)

A direct exchange definition.

Direct exchanges route messages to queues based on exact routing key matches.
This is ideal for point-to-point messaging where each message should go to specific queues.

#### Type Declaration

| Name   | Type       | Defined in                                                                                                                                |
| ------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `type` | `"direct"` | [types.ts:83](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L83) |

#### Example

```typescript
const tasksExchange: DirectExchangeDefinition = defineExchange('tasks', 'direct', {
  durable: true
});
```

---

### ExchangeBindingDefinition

```ts
type ExchangeBindingDefinition = object &
  | {
  routingKey: string;
  source:   | DirectExchangeDefinition
     | TopicExchangeDefinition;
}
  | {
  routingKey?: never;
  source: FanoutExchangeDefinition;
};
```

Defined in: [types.ts:262](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L262)

Binding between two exchanges (exchange-to-exchange routing).

Defines how messages should be forwarded from a source exchange to a destination exchange.
This allows for more complex routing topologies.

#### Type Declaration

| Name          | Type                                        | Description                                                      | Defined in                                                                                                                                  |
| ------------- | ------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `arguments?`  | `Record`\<`string`, `unknown`\>             | Additional AMQP arguments for the binding.                       | [types.ts:272](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L272) |
| `destination` | [`ExchangeDefinition`](#exchangedefinition) | The destination exchange that will receive forwarded messages    | [types.ts:267](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L267) |
| `type`        | `"exchange"`                                | Discriminator indicating this is an exchange-to-exchange binding | [types.ts:264](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L264) |

#### Example

```typescript
// Forward high-priority orders to a special processing exchange
const binding: ExchangeBindingDefinition = {
  type: 'exchange',
  source: ordersExchange,
  destination: highPriorityExchange,
  routingKey: 'order.high-priority.*'
};
```

---

### ExchangeDefinition

```ts
type ExchangeDefinition =
  | FanoutExchangeDefinition
  | DirectExchangeDefinition
  | TopicExchangeDefinition;
```

Defined in: [types.ts:112](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L112)

Union type of all exchange definitions.

Represents any type of AMQP exchange: fanout, direct, or topic.

---

### FanoutExchangeDefinition

```ts
type FanoutExchangeDefinition = BaseExchangeDefinition & object;
```

Defined in: [types.ts:65](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L65)

A fanout exchange definition.

Fanout exchanges broadcast all messages to all bound queues, ignoring routing keys.
This is the simplest exchange type for pub/sub messaging patterns.

#### Type Declaration

| Name   | Type       | Defined in                                                                                                                                |
| ------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `type` | `"fanout"` | [types.ts:66](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L66) |

#### Example

```typescript
const logsExchange: FanoutExchangeDefinition = defineExchange('logs', 'fanout', {
  durable: true
});
```

---

### InferConsumerNames

```ts
type InferConsumerNames<TContract> = TContract["consumers"] extends Record<string, unknown> ? keyof TContract["consumers"] : never;
```

Defined in: [types.ts:462](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L462)

Extract consumer names from a contract.

This utility type extracts the keys of all consumers defined in a contract.
It's used internally for type inference in the TypedAmqpWorker.

#### Type Parameters

| Type Parameter                                                    | Description             |
| ----------------------------------------------------------------- | ----------------------- |
| `TContract` _extends_ [`ContractDefinition`](#contractdefinition) | The contract definition |

#### Returns

Union of consumer names, or never if no consumers defined

#### Example

```typescript
type ConsumerNames = InferConsumerNames<typeof myContract>;
// Result: 'processOrder' | 'sendNotification' | 'updateInventory'
```

---

### InferPublisherNames

```ts
type InferPublisherNames<TContract> = TContract["publishers"] extends Record<string, unknown> ? keyof TContract["publishers"] : never;
```

Defined in: [types.ts:444](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L444)

Extract publisher names from a contract.

This utility type extracts the keys of all publishers defined in a contract.
It's used internally for type inference in the TypedAmqpClient.

#### Type Parameters

| Type Parameter                                                    | Description             |
| ----------------------------------------------------------------- | ----------------------- |
| `TContract` _extends_ [`ContractDefinition`](#contractdefinition) | The contract definition |

#### Returns

Union of publisher names, or never if no publishers defined

#### Example

```typescript
type PublisherNames = InferPublisherNames<typeof myContract>;
// Result: 'orderCreated' | 'orderUpdated' | 'orderCancelled'
```

---

### MatchingRoutingKey

```ts
type MatchingRoutingKey<Pattern, Key> = RoutingKey<Key> extends never ? never : BindingPattern<Pattern> extends never ? never : MatchesPattern<Key, Pattern> extends true ? Key : never;
```

Defined in: [builder.ts:940](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/builder.ts#L940)

Validate that a routing key matches a binding pattern.

This is a utility type provided for users who want compile-time validation
that a routing key matches a specific pattern. It's not enforced internally
in the API to avoid TypeScript recursion depth issues with complex routing keys.

Returns the routing key if it's valid and matches the pattern, `never` otherwise.

#### Type Parameters

| Type Parameter               | Description                                          |
| ---------------------------- | ---------------------------------------------------- |
| `Pattern` _extends_ `string` | The binding pattern (can contain \* and # wildcards) |
| `Key` _extends_ `string`     | The routing key to validate                          |

#### Example

```typescript
type ValidKey = MatchingRoutingKey<"order.*", "order.created">; // "order.created"
type InvalidKey = MatchingRoutingKey<"order.*", "user.created">; // never
```

---

### MessageDefinition

```ts
type MessageDefinition<TPayload, THeaders> = object;
```

Defined in: [types.ts:178](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L178)

Definition of a message with typed payload and optional headers.

#### Type Parameters

| Type Parameter                                                                            | Default type              | Description                                                                 |
| ----------------------------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------- |
| `TPayload` _extends_ [`AnySchema`](#anyschema)                                            | [`AnySchema`](#anyschema) | The Standard Schema v1 compatible schema for the message payload            |
| `THeaders` _extends_ `StandardSchemaV1`\<`Record`\<`string`, `unknown`\>\> \| `undefined` | `undefined`               | The Standard Schema v1 compatible schema for the message headers (optional) |

#### Properties

| Property                                | Type       | Description                                                                                                                      | Defined in                                                                                                                                  |
| --------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="description"></a> `description?` | `string`   | Detailed description of the message for documentation purposes. Used in AsyncAPI specification generation.                       | [types.ts:204](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L204) |
| <a id="headers"></a> `headers?`         | `THeaders` | Optional headers schema for validating message metadata. Must be a Standard Schema v1 compatible schema.                         | [types.ts:192](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L192) |
| <a id="payload"></a> `payload`          | `TPayload` | The payload schema for validating message content. Must be a Standard Schema v1 compatible schema (Zod, Valibot, ArkType, etc.). | [types.ts:186](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L186) |
| <a id="summary"></a> `summary?`         | `string`   | Brief description of the message for documentation purposes. Used in AsyncAPI specification generation.                          | [types.ts:198](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L198) |

---

### PublisherDefinition

```ts
type PublisherDefinition<TMessage> = object &
  | {
  exchange:   | DirectExchangeDefinition
     | TopicExchangeDefinition;
  routingKey: string;
}
  | {
  exchange: FanoutExchangeDefinition;
  routingKey?: never;
};
```

Defined in: [types.ts:317](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L317)

Definition of a message publisher.

A publisher sends messages to an exchange with automatic schema validation.
The message payload is validated against the schema before being sent to RabbitMQ.

#### Type Declaration

| Name      | Type       | Description                                         | Defined in                                                                                                                                  |
| --------- | ---------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `message` | `TMessage` | The message definition including the payload schema | [types.ts:319](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L319) |

#### Type Parameters

| Type Parameter                                                 | Default type                              | Description                                |
| -------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------ |
| `TMessage` _extends_ [`MessageDefinition`](#messagedefinition) | [`MessageDefinition`](#messagedefinition) | The message definition with payload schema |

#### Example

```typescript
const publisher: PublisherDefinition = {
  exchange: ordersExchange,
  message: orderMessage,
  routingKey: 'order.created'
};
```

---

### PublisherFirstResult

```ts
type PublisherFirstResult<TMessage, TPublisher> = object;
```

Defined in: [builder.ts:734](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/builder.ts#L734)

Publisher-first builder result for fanout and direct exchanges.

This type represents a publisher and provides a method to create
a consumer that uses the same message schema with a binding to the exchange.

This pattern is suitable for event-oriented messaging where publishers
emit events without knowing which queues will consume them.

#### Type Parameters

| Type Parameter                                                                     | Description              |
| ---------------------------------------------------------------------------------- | ------------------------ |
| `TMessage` _extends_ [`MessageDefinition`](#messagedefinition)                     | The message definition   |
| `TPublisher` _extends_ [`PublisherDefinition`](#publisherdefinition)\<`TMessage`\> | The publisher definition |

#### Properties

| Property                                     | Type                  | Description                                                                                                                                                                        | Defined in                                                                                                                                      |
| -------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="createconsumer"></a> `createConsumer` | (`queue`) => `object` | Create a consumer that receives messages from this publisher. The consumer will automatically use the same message schema and a binding will be created with the same routing key. | [builder.ts:748](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/builder.ts#L748) |
| <a id="publisher"></a> `publisher`           | `TPublisher`          | The publisher definition                                                                                                                                                           | [builder.ts:739](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/builder.ts#L739) |

---

### PublisherFirstResultWithRoutingKey

```ts
type PublisherFirstResultWithRoutingKey<TMessage, TPublisher, TRoutingKey> = object;
```

Defined in: [builder.ts:959](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/builder.ts#L959)

Publisher-first builder result for topic exchanges.

This type represents a publisher with a concrete routing key and provides a method
to create consumers that can use routing key patterns matching the publisher's key.

#### Type Parameters

| Type Parameter                                                                     | Description                                                                  |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `TMessage` _extends_ [`MessageDefinition`](#messagedefinition)                     | The message definition                                                       |
| `TPublisher` _extends_ [`PublisherDefinition`](#publisherdefinition)\<`TMessage`\> | The publisher definition                                                     |
| `TRoutingKey` _extends_ `string`                                                   | The literal routing key type from the publisher (for documentation purposes) |

#### Properties

| Property                                       | Type                                                          | Description                                                                                                                                  | Defined in                                                                                                                                      |
| ---------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="createconsumer-1"></a> `createConsumer` | \<`TConsumerRoutingKey`\>(`queue`, `routingKey?`) => `object` | Create a consumer that receives messages from this publisher. For topic exchanges, the routing key pattern can be specified for the binding. | [builder.ts:974](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/builder.ts#L974) |
| <a id="publisher-1"></a> `publisher`           | `TPublisher`                                                  | The publisher definition                                                                                                                     | [builder.ts:965](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/builder.ts#L965) |

---

### QueueBindingDefinition

```ts
type QueueBindingDefinition = object &
  | {
  exchange:   | DirectExchangeDefinition
     | TopicExchangeDefinition;
  routingKey: string;
}
  | {
  exchange: FanoutExchangeDefinition;
  routingKey?: never;
};
```

Defined in: [types.ts:214](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L214)

Binding between a queue and an exchange.

Defines how messages from an exchange should be routed to a queue.
For direct and topic exchanges, a routing key is required.
For fanout exchanges, no routing key is needed as all messages are broadcast.

#### Type Declaration

| Name         | Type                                  | Description                                                                                                           | Defined in                                                                                                                                  |
| ------------ | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `arguments?` | `Record`\<`string`, `unknown`\>       | Additional AMQP arguments for the binding. Can be used for advanced routing scenarios with the headers exchange type. | [types.ts:225](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L225) |
| `queue`      | [`QueueDefinition`](#queuedefinition) | The queue that will receive messages                                                                                  | [types.ts:219](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L219) |
| `type`       | `"queue"`                             | Discriminator indicating this is a queue-to-exchange binding                                                          | [types.ts:216](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L216) |

---

### QueueDefinition

```ts
type QueueDefinition = object;
```

Defined in: [types.ts:123](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L123)

Definition of an AMQP queue.

A queue stores messages until they are consumed by workers. Queues are bound to exchanges
to receive messages based on routing rules.

#### Properties

| Property                                | Type                            | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Defined in                                                                                                                                  |
| --------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="arguments-1"></a> `arguments?`   | `Record`\<`string`, `unknown`\> | Additional AMQP arguments for advanced configuration. Common arguments include: - `x-message-ttl`: Message time-to-live in milliseconds - `x-expires`: Queue expiration time in milliseconds - `x-max-length`: Maximum number of messages in the queue - `x-max-length-bytes`: Maximum size of the queue in bytes - `x-dead-letter-exchange`: Exchange for dead-lettered messages - `x-dead-letter-routing-key`: Routing key for dead-lettered messages - `x-max-priority`: Maximum priority level for priority queues **Example** `{ 'x-message-ttl': 86400000, // 24 hours 'x-dead-letter-exchange': 'dlx', 'x-max-priority': 10 }` | [types.ts:169](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L169) |
| <a id="autodelete-1"></a> `autoDelete?` | `boolean`                       | If true, the queue is deleted when the last consumer unsubscribes. **Default** `false`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | [types.ts:146](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L146) |
| <a id="durable-1"></a> `durable?`       | `boolean`                       | If true, the queue survives broker restarts. Durable queues are persisted to disk. **Default** `false`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | [types.ts:133](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L133) |
| <a id="exclusive"></a> `exclusive?`     | `boolean`                       | If true, the queue can only be used by the declaring connection and is deleted when that connection closes. Exclusive queues are private to the connection. **Default** `false`                                                                                                                                                                                                                                                                                                                                                                                                                                                       | [types.ts:140](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L140) |
| <a id="name-1"></a> `name`              | `string`                        | The name of the queue. Must be unique within the RabbitMQ virtual host.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | [types.ts:127](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L127) |

---

### TopicExchangeDefinition

```ts
type TopicExchangeDefinition = BaseExchangeDefinition & object;
```

Defined in: [types.ts:103](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L103)

A topic exchange definition.

Topic exchanges route messages to queues based on routing key patterns with wildcards:

- `*` (star) matches exactly one word
- `#` (hash) matches zero or more words

Words are separated by dots (e.g., `order.created.high-value`).

#### Type Declaration

| Name   | Type      | Defined in                                                                                                                                  |
| ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `type` | `"topic"` | [types.ts:104](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/types.ts#L104) |

#### Example

```typescript
const ordersExchange: TopicExchangeDefinition = defineExchange('orders', 'topic', {
  durable: true
});
// Can be bound with patterns like 'order.*' or 'order.#'
```

## Functions

### defineConsumer()

```ts
function defineConsumer<TMessage>(
   queue,
   message,
options?): ConsumerDefinition<TMessage>;
```

Defined in: [builder.ts:595](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/builder.ts#L595)

Define a message consumer.

A consumer receives and processes messages from a queue. The message schema is validated
automatically when messages are consumed, ensuring type safety for your handlers.

Consumers are associated with a specific queue and message type. When you create a worker
with this consumer, it will process messages from the queue according to the schema.

#### Type Parameters

| Type Parameter                                                 |
| -------------------------------------------------------------- |
| `TMessage` _extends_ [`MessageDefinition`](#messagedefinition) |

#### Parameters

| Parameter  | Type                                                                                          | Description                                |
| ---------- | --------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `queue`    | [`QueueDefinition`](#queuedefinition)                                                         | The queue definition to consume from       |
| `message`  | `TMessage`                                                                                    | The message definition with payload schema |
| `options?` | `Omit`\<[`ConsumerDefinition`](#consumerdefinition)\<`TMessage`\>, `"queue"` \| `"message"`\> | Optional consumer configuration            |

#### Returns

[`ConsumerDefinition`](#consumerdefinition)\<`TMessage`\>

A consumer definition with inferred message types

#### Example

```typescript
import { z } from 'zod';

const orderQueue = defineQueue('order-processing', { durable: true });
const orderMessage = defineMessage(
  z.object({
    orderId: z.string().uuid(),
    customerId: z.string().uuid(),
    amount: z.number().positive(),
  })
);

const processOrderConsumer = defineConsumer(orderQueue, orderMessage);

// Later, when creating a worker, you'll provide a handler for this consumer:
// const worker = await TypedAmqpWorker.create({
//   contract,
//   handlers: {
//     processOrder: async (message) => {
//       // message is automatically typed based on the schema
//       console.log(message.orderId); // string
//     }
//   },
//   connection
// });
```

---

### defineContract()

```ts
function defineContract<TContract>(definition): TContract;
```

Defined in: [builder.ts:676](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/builder.ts#L676)

Define an AMQP contract.

A contract is the central definition of your AMQP messaging topology. It brings together
all exchanges, queues, bindings, publishers, and consumers in a single, type-safe definition.

The contract is used by both clients (for publishing) and workers (for consuming) to ensure
type safety throughout your messaging infrastructure. TypeScript will infer all message types
and publisher/consumer names from the contract.

#### Type Parameters

| Type Parameter                                                    |
| ----------------------------------------------------------------- |
| `TContract` _extends_ [`ContractDefinition`](#contractdefinition) |

#### Parameters

| Parameter    | Type        | Description                                           |
| ------------ | ----------- | ----------------------------------------------------- |
| `definition` | `TContract` | The contract definition containing all AMQP resources |

#### Returns

`TContract`

The same contract definition with full type inference

#### Example

```typescript
import {
  defineContract,
  defineExchange,
  defineQueue,
  defineQueueBinding,
  definePublisher,
  defineConsumer,
  defineMessage,
} from '@amqp-contract/contract';
import { z } from 'zod';

// Define resources
const ordersExchange = defineExchange('orders', 'topic', { durable: true });
const orderQueue = defineQueue('order-processing', { durable: true });
const orderMessage = defineMessage(
  z.object({
    orderId: z.string(),
    amount: z.number(),
  })
);

// Compose contract
export const contract = defineContract({
  exchanges: {
    orders: ordersExchange,
  },
  queues: {
    orderProcessing: orderQueue,
  },
  bindings: {
    orderBinding: defineQueueBinding(orderQueue, ordersExchange, {
      routingKey: 'order.created',
    }),
  },
  publishers: {
    orderCreated: definePublisher(ordersExchange, orderMessage, {
      routingKey: 'order.created',
    }),
  },
  consumers: {
    processOrder: defineConsumer(orderQueue, orderMessage),
  },
});

// TypeScript now knows:
// - client.publish('orderCreated', { orderId: string, amount: number })
// - handler: async (message: { orderId: string, amount: number }) => void
```

---

### defineMessage()

```ts
function defineMessage<TPayload, THeaders>(payload, options?): MessageDefinition<TPayload, THeaders>;
```

Defined in: [builder.ts:197](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/builder.ts#L197)

Define a message definition with payload and optional headers/metadata.

A message definition specifies the schema for message payloads and headers using
Standard Schema v1 compatible libraries (Zod, Valibot, ArkType, etc.).
The schemas are used for automatic validation when publishing or consuming messages.

#### Type Parameters

| Type Parameter                                                                                                                | Default type |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `TPayload` _extends_ [`AnySchema`](#anyschema)                                                                                | -            |
| `THeaders` _extends_ \| `StandardSchemaV1`\<`Record`\<`string`, `unknown`\>, `Record`\<`string`, `unknown`\>\> \| `undefined` | `undefined`  |

#### Parameters

| Parameter              | Type                                                                          | Description                                                          |
| ---------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `payload`              | `TPayload`                                                                    | The payload schema (must be Standard Schema v1 compatible)           |
| `options?`             | \{ `description?`: `string`; `headers?`: `THeaders`; `summary?`: `string`; \} | Optional message metadata                                            |
| `options.description?` | `string`                                                                      | Detailed description for documentation (used in AsyncAPI generation) |
| `options.headers?`     | `THeaders`                                                                    | Optional header schema for message headers                           |
| `options.summary?`     | `string`                                                                      | Brief description for documentation (used in AsyncAPI generation)    |

#### Returns

[`MessageDefinition`](#messagedefinition)\<`TPayload`, `THeaders`\>

A message definition with inferred types

#### Example

```typescript
import { z } from 'zod';

const orderMessage = defineMessage(
  z.object({
    orderId: z.string().uuid(),
    customerId: z.string().uuid(),
    amount: z.number().positive(),
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.number().int().positive(),
    })),
  }),
  {
    summary: 'Order created event',
    description: 'Emitted when a new order is created in the system'
  }
);
```

---

### defineQueue()

```ts
function defineQueue(name, options?): QueueDefinition;
```

Defined in: [builder.ts:152](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/contract/src/builder.ts#L152)

Define an AMQP queue.

A queue stores messages until they are consumed by workers. Queues can be bound to exchanges
to receive messages based on routing rules.

#### Parameters

| Parameter  | Type                                                      | Description                  |
| ---------- | --------------------------------------------------------- | ---------------------------- |
| `name`     | `string`                                                  | The name of the queue        |
| `options?` | `Omit`\<[`QueueDefinition`](#queuedefinition), `"name"`\> | Optional queue configuration |

#### Returns

[`QueueDefinition`](#queuedefinition)

A queue definition

#### Example

```typescript
const orderProcessingQueue = defineQueue('order-processing', {
  durable: true,
  arguments: {
    'x-message-ttl': 86400000, // 24 hours
    'x-dead-letter-exchange': 'orders-dlx'
  }
});
```
