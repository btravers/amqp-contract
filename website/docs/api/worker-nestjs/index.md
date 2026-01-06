**@amqp-contract/worker-nestjs**

---

# @amqp-contract/worker-nestjs

## Classes

### AmqpWorkerModule

Defined in: [packages/worker-nestjs/src/worker.module.ts:14](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/worker-nestjs/src/worker.module.ts#L14)

NestJS module for AMQP worker integration
This module provides type-safe AMQP worker functionality using @amqp-contract/worker
without relying on NestJS decorators (except for dependency injection)

#### Extends

- `ConfigurableModuleClass`

#### Indexable

```ts
[key: string]: any
```

#### Constructors

##### Constructor

```ts
new AmqpWorkerModule(): AmqpWorkerModule;
```

Defined in: node_modules/.pnpm/@nestjs+common@11.1.10_reflect-metadata@0.2.2_rxjs@7.8.2/node_modules/@nestjs/common/module-utils/interfaces/configurable-module-cls.interface.d.ts:12

###### Returns

[`AmqpWorkerModule`](#amqpworkermodule)

###### Inherited from

```ts
ConfigurableModuleClass.constructor;
```

#### Properties

| Property                                 | Modifier | Type                           | Inherited from                         | Defined in |
| ---------------------------------------- | -------- | ------------------------------ | -------------------------------------- | ---------- |
| <a id="forroot"></a> `forRoot`           | `static` | (`options`) => `DynamicModule` | `ConfigurableModuleClass.forRoot`      |            |
| <a id="forrootasync"></a> `forRootAsync` | `static` | (`options`) => `DynamicModule` | `ConfigurableModuleClass.forRootAsync` |            |

---

### AmqpWorkerService

Defined in: [packages/worker-nestjs/src/worker.service.ts:74](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/worker-nestjs/src/worker.service.ts#L74)

Type-safe AMQP worker service for NestJS applications.

This service wraps TypedAmqpWorker and integrates it with the NestJS
lifecycle, automatically starting message consumption on module init and
cleaning up resources on module destroy.

#### Example

```typescript
// In your module
import { AmqpWorkerModule } from "@amqp-contract/worker-nestjs";

@Module({
  imports: [
    AmqpWorkerModule.forRoot({
      contract: myContract,
      handlers: {
        processOrder: async (message) => {
          console.log("Received order:", message.orderId);
          // Process the order...
        },
      },
      urls: ["amqp://localhost"],
    }),
  ],
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

Defined in: [packages/worker-nestjs/src/worker.service.ts:79](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/worker-nestjs/src/worker.service.ts#L79)

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

Defined in: [packages/worker-nestjs/src/worker.service.ts:105](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/worker-nestjs/src/worker.service.ts#L105)

Close the AMQP worker when the NestJS module is destroyed.

This lifecycle hook ensures proper cleanup of resources when the
NestJS application shuts down, gracefully stopping message consumption
and closing the connection.

###### Returns

`Promise`\<`void`\>

###### Implementation of

```ts
OnModuleDestroy.onModuleDestroy;
```

##### onModuleInit()

```ts
onModuleInit(): Promise<void>;
```

Defined in: [packages/worker-nestjs/src/worker.service.ts:94](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/worker-nestjs/src/worker.service.ts#L94)

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
OnModuleInit.onModuleInit;
```

## Interfaces

### AmqpWorkerModuleOptions

Defined in: [packages/worker-nestjs/src/worker.service.ts:28](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/worker-nestjs/src/worker.service.ts#L28)

Configuration options for the AMQP worker NestJS module.

#### Example

```typescript
const options: AmqpWorkerModuleOptions<typeof contract> = {
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

| Property                                            | Type                                         | Description                                                                 | Defined in                                                                                                                                                                                  |
| --------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="connectionoptions"></a> `connectionOptions?` | `AmqpConnectionManagerOptions`               | Optional connection configuration (heartbeat, reconnect settings, etc.)     | [packages/worker-nestjs/src/worker.service.ts:36](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/worker-nestjs/src/worker.service.ts#L36) |
| <a id="contract"></a> `contract`                    | `TContract`                                  | The AMQP contract definition specifying consumers and their message schemas | [packages/worker-nestjs/src/worker.service.ts:30](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/worker-nestjs/src/worker.service.ts#L30) |
| <a id="handlers"></a> `handlers`                    | `WorkerInferConsumerHandlers`\<`TContract`\> | Message handlers for each consumer defined in the contract                  | [packages/worker-nestjs/src/worker.service.ts:32](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/worker-nestjs/src/worker.service.ts#L32) |
| <a id="urls"></a> `urls`                            | `ConnectionUrl`[]                            | AMQP broker URL(s). Multiple URLs provide failover support                  | [packages/worker-nestjs/src/worker.service.ts:34](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/worker-nestjs/src/worker.service.ts#L34) |

## Variables

### MODULE_OPTIONS_TOKEN

```ts
MODULE_OPTIONS_TOKEN: string | symbol;
```

Defined in: [packages/worker-nestjs/src/worker.module-definition.ts:9](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/worker-nestjs/src/worker.module-definition.ts#L9)
