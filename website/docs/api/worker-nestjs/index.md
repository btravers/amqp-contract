**@amqp-contract/worker-nestjs**

---

# @amqp-contract/worker-nestjs

## Classes

### AmqpWorkerModule

Defined in: [worker-nestjs/src/worker.module.ts:88](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/worker-nestjs/src/worker.module.ts#L88)

NestJS module for AMQP worker integration
This module provides type-safe AMQP worker functionality using @amqp-contract/worker
without relying on NestJS decorators (except for dependency injection)

#### Type Param

The contract definition type for type-safe handlers

#### Example

```typescript
// Synchronous configuration
@Module({
  imports: [
    AmqpWorkerModule.forRoot({
      contract: myContract,
      handlers: {
        processOrder: async (message) => {
          // message is fully typed based on the contract
          console.log('Order:', message.orderId);
        }
      },
      urls: ['amqp://localhost']
    })
  ]
})
export class AppModule {}

// Asynchronous configuration
@Module({
  imports: [
    AmqpWorkerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        contract: myContract,
        handlers: {
          processOrder: async (message) => {
            console.log('Order:', message.orderId);
          }
        },
        urls: configService.get('AMQP_URLS')
      }),
      inject: [ConfigService]
    })
  ]
})
export class AppModule {}
```

#### Constructors

##### Constructor

```ts
new AmqpWorkerModule(): AmqpWorkerModule;
```

###### Returns

[`AmqpWorkerModule`](#amqpworkermodule)

#### Methods

##### forRoot()

```ts
static forRoot<TContract>(options): DynamicModule;
```

Defined in: [worker-nestjs/src/worker.module.ts:95](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/worker-nestjs/src/worker.module.ts#L95)

Register the AMQP worker module with synchronous configuration

###### Type Parameters

| Type Parameter                             |
| ------------------------------------------ |
| `TContract` _extends_ `ContractDefinition` |

###### Parameters

| Parameter | Type                                                                 | Description                                                 |
| --------- | -------------------------------------------------------------------- | ----------------------------------------------------------- |
| `options` | [`AmqpWorkerModuleOptions`](#amqpworkermoduleoptions)\<`TContract`\> | The worker configuration options with contract and handlers |

###### Returns

`DynamicModule`

A dynamic module for NestJS

##### forRootAsync()

```ts
static forRootAsync<TContract>(options): DynamicModule;
```

Defined in: [worker-nestjs/src/worker.module.ts:117](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/worker-nestjs/src/worker.module.ts#L117)

Register the AMQP worker module with asynchronous configuration

###### Type Parameters

| Type Parameter                             |
| ------------------------------------------ |
| `TContract` _extends_ `ContractDefinition` |

###### Parameters

| Parameter | Type                                                                           | Description                                       |
| --------- | ------------------------------------------------------------------------------ | ------------------------------------------------- |
| `options` | [`AmqpWorkerModuleAsyncOptions`](#amqpworkermoduleasyncoptions)\<`TContract`\> | Async configuration options with factory function |

###### Returns

`DynamicModule`

A dynamic module for NestJS

---

### AmqpWorkerService

Defined in: [worker-nestjs/src/worker.service.ts:74](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/worker-nestjs/src/worker.service.ts#L74)

Type-safe AMQP worker service for NestJS applications.

This service wraps TypedAmqpWorker and integrates it with the NestJS
lifecycle, automatically starting message consumption on module init and
cleaning up resources on module destroy.

#### Example

```typescript
// In your module
import { AmqpWorkerModule } from '@amqp-contract/worker-nestjs';

@Module({
  imports: [
    AmqpWorkerModule.forRoot({
      contract: myContract,
      handlers: {
        processOrder: async (message) => {
          console.log('Received order:', message.orderId);
          // Process the order...
        }
      },
      urls: ['amqp://localhost']
    })
  ]
})
export class AppModule {}

// The worker automatically starts consuming messages when the module initializes
// and stops gracefully when the application shuts down
```

#### Type Parameters

| Type Parameter                             | Description                  |
| ------------------------------------------ | ---------------------------- |
| `TContract` _extends_ `ContractDefinition` | The contract definition type |

#### Implements

- `OnModuleInit`
- `OnModuleDestroy`

#### Constructors

##### Constructor

```ts
new AmqpWorkerService<TContract>(options): AmqpWorkerService<TContract>;
```

Defined in: [worker-nestjs/src/worker.service.ts:79](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/worker-nestjs/src/worker.service.ts#L79)

###### Parameters

| Parameter | Type                                                                 |
| --------- | -------------------------------------------------------------------- |
| `options` | [`AmqpWorkerModuleOptions`](#amqpworkermoduleoptions)\<`TContract`\> |

###### Returns

[`AmqpWorkerService`](#amqpworkerservice)\<`TContract`\>

#### Methods

##### onModuleDestroy()

```ts
onModuleDestroy(): Promise<void>;
```

Defined in: [worker-nestjs/src/worker.service.ts:105](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/worker-nestjs/src/worker.service.ts#L105)

Close the AMQP worker when the NestJS module is destroyed.

This lifecycle hook ensures proper cleanup of resources when the
NestJS application shuts down, gracefully stopping message consumption
and closing the connection.

###### Returns

`Promise`\<`void`\>

###### Implementation of

```ts
OnModuleDestroy.onModuleDestroy
```

##### onModuleInit()

```ts
onModuleInit(): Promise<void>;
```

Defined in: [worker-nestjs/src/worker.service.ts:94](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/worker-nestjs/src/worker.service.ts#L94)

Initialize the AMQP worker when the NestJS module starts.

This lifecycle hook automatically creates and starts the worker,
beginning message consumption from all configured consumers.
The connection will be established in the background with
automatic reconnection handling.

###### Returns

`Promise`\<`void`\>

###### Throws

Error if the worker fails to start

###### Implementation of

```ts
OnModuleInit.onModuleInit
```

## Type Aliases

### AmqpWorkerModuleAsyncOptions

```ts
type AmqpWorkerModuleAsyncOptions<TContract> = object;
```

Defined in: [worker-nestjs/src/worker.module.ts:22](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/worker-nestjs/src/worker.module.ts#L22)

Options for async module configuration using factory pattern

#### Type Parameters

| Type Parameter                             |
| ------------------------------------------ |
| `TContract` _extends_ `ContractDefinition` |

#### Properties

| Property                             | Type                                                           | Description                                                                                                                     | Defined in                                                                                                                                                                       |
| ------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="imports"></a> `imports?`      | `ModuleMetadata`\[`"imports"`\]                                | Optional list of imported modules that export providers needed by the factory                                                   | [worker-nestjs/src/worker.module.ts:37](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/worker-nestjs/src/worker.module.ts#L37) |
| <a id="inject"></a> `inject?`        | (`string` \| `symbol` \| `Type`\<`unknown`\>)[]                | Optional dependencies to inject into the factory function. Can be a token (string/symbol) a class or a reference to a provider. | [worker-nestjs/src/worker.module.ts:33](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/worker-nestjs/src/worker.module.ts#L33) |
| <a id="usefactory"></a> `useFactory` | (...`args`) => `AmqpWorkerModuleOptionsFactory`\<`TContract`\> | Factory function that returns the module options. Can use injected dependencies to create configuration.                        | [worker-nestjs/src/worker.module.ts:28](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/worker-nestjs/src/worker.module.ts#L28) |

---

### AmqpWorkerModuleOptions

```ts
type AmqpWorkerModuleOptions<TContract> = object;
```

Defined in: [worker-nestjs/src/worker.service.ts:28](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/worker-nestjs/src/worker.service.ts#L28)

Configuration options for the AMQP worker NestJS module.

#### Example

```typescript
const options: AmqpWorkerModuleOptions<typeof contract> = {
  contract: myContract,
  handlers: {
    processOrder: async (message) => {
      console.log('Processing order:', message.orderId);
    }
  },
  urls: ['amqp://localhost'],
  connectionOptions: {
    heartbeatIntervalInSeconds: 30
  }
};
```

#### Type Parameters

| Type Parameter                             | Description                  |
| ------------------------------------------ | ---------------------------- |
| `TContract` _extends_ `ContractDefinition` | The contract definition type |

#### Properties

| Property                                            | Type                                                                         | Description                                                                 | Defined in                                                                                                                                                                         |
| --------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="connectionoptions"></a> `connectionOptions?` | `AmqpConnectionManagerOptions`                                               | Optional connection configuration (heartbeat, reconnect settings, etc.)     | [worker-nestjs/src/worker.service.ts:36](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/worker-nestjs/src/worker.service.ts#L36) |
| <a id="contract"></a> `contract`                    | `TContract`                                                                  | The AMQP contract definition specifying consumers and their message schemas | [worker-nestjs/src/worker.service.ts:30](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/worker-nestjs/src/worker.service.ts#L30) |
| <a id="handlers"></a> `handlers`                    | [`WorkerInferConsumerHandlers`](#workerinferconsumerhandlers)\<`TContract`\> | Message handlers for each consumer defined in the contract                  | [worker-nestjs/src/worker.service.ts:32](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/worker-nestjs/src/worker.service.ts#L32) |
| <a id="urls"></a> `urls`                            | `ConnectionUrl`[]                                                            | AMQP broker URL(s). Multiple URLs provide failover support                  | [worker-nestjs/src/worker.service.ts:34](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/worker-nestjs/src/worker.service.ts#L34) |

---

### WorkerInferConsumerHandler()

```ts
type WorkerInferConsumerHandler<TContract, TName> = (message) => Promise<void>;
```

Defined in: worker/dist/index.d.mts:55

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
type WorkerInferConsumerHandlers<TContract> = { [K in InferConsumerNames<TContract>]: WorkerInferConsumerHandler<TContract, K> };
```

Defined in: worker/dist/index.d.mts:59

Infer all consumer handlers for a contract

#### Type Parameters

| Type Parameter                             |
| ------------------------------------------ |
| `TContract` _extends_ `ContractDefinition` |

---

### WorkerInferConsumerInput

```ts
type WorkerInferConsumerInput<TContract, TName> = ConsumerInferInput<InferConsumer<TContract, TName>>;
```

Defined in: worker/dist/index.d.mts:51

Worker perspective types - for consuming messages

#### Type Parameters

| Type Parameter                                        |
| ----------------------------------------------------- |
| `TContract` _extends_ `ContractDefinition`            |
| `TName` _extends_ `InferConsumerNames`\<`TContract`\> |

## Variables

### MODULE_OPTIONS_TOKEN

```ts
const MODULE_OPTIONS_TOKEN: typeof MODULE_OPTIONS_TOKEN;
```

Defined in: [worker-nestjs/src/worker.module-definition.ts:5](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/worker-nestjs/src/worker.module-definition.ts#L5)

Injection token for AMQP worker module options
Used by NestJS DI system to inject configuration into AmqpWorkerService

## Functions

### defineHandler()

```ts
function defineHandler<TContract, TName>(
   contract,
   consumerName,
handler): WorkerInferConsumerHandler<TContract, TName>;
```

Defined in: worker/dist/index.d.mts:276

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
import { defineHandler } from '@amqp-contract/worker';
import { orderContract } from './contract';

// Define handler outside of worker creation
const processOrderHandler = defineHandler(
  orderContract,
  'processOrder',
  async (message) => {
    // message is fully typed based on the contract
    console.log('Processing order:', message.orderId);
    await processPayment(message);
  }
);

// Use the handler in worker
const worker = await TypedAmqpWorker.create({
  contract: orderContract,
  handlers: {
    processOrder: processOrderHandler,
  },
  connection: 'amqp://localhost',
});
```

```typescript
// Define multiple handlers
const processOrderHandler = defineHandler(
  orderContract,
  'processOrder',
  async (message) => {
    await processOrder(message);
  }
);

const notifyOrderHandler = defineHandler(
  orderContract,
  'notifyOrder',
  async (message) => {
    await sendNotification(message);
  }
);

// Compose handlers
const worker = await TypedAmqpWorker.create({
  contract: orderContract,
  handlers: {
    processOrder: processOrderHandler,
    notifyOrder: notifyOrderHandler,
  },
  connection: 'amqp://localhost',
});
```

---

### defineHandlers()

```ts
function defineHandlers<TContract>(contract, handlers): WorkerInferConsumerHandlers<TContract>;
```

Defined in: worker/dist/index.d.mts:333

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
import { defineHandlers } from '@amqp-contract/worker';
import { orderContract } from './contract';

// Define all handlers at once
const handlers = defineHandlers(orderContract, {
  processOrder: async (message) => {
    // message is fully typed based on the contract
    console.log('Processing order:', message.orderId);
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
  connection: 'amqp://localhost',
});
```

```typescript
// Separate handler definitions for better organization
async function handleProcessOrder(message: WorkerInferConsumerInput<typeof orderContract, 'processOrder'>) {
  await processOrder(message);
}

async function handleNotifyOrder(message: WorkerInferConsumerInput<typeof orderContract, 'notifyOrder'>) {
  await sendNotification(message);
}

const handlers = defineHandlers(orderContract, {
  processOrder: handleProcessOrder,
  notifyOrder: handleNotifyOrder,
});
```
