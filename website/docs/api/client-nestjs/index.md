**@amqp-contract/client-nestjs**

---

# @amqp-contract/client-nestjs

## Classes

### AmqpClientModule

Defined in: [packages/client-nestjs/src/client.module.ts:14](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/client-nestjs/src/client.module.ts#L14)

NestJS module for AMQP client integration
This module provides type-safe AMQP client functionality using @amqp-contract/client
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
new AmqpClientModule(): AmqpClientModule;
```

Defined in: node_modules/.pnpm/@nestjs+common@11.1.10_reflect-metadata@0.2.2_rxjs@7.8.2/node_modules/@nestjs/common/module-utils/interfaces/configurable-module-cls.interface.d.ts:12

###### Returns

[`AmqpClientModule`](#amqpclientmodule)

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

### AmqpClientService

Defined in: [packages/client-nestjs/src/client.service.ts:86](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/client-nestjs/src/client.service.ts#L86)

Type-safe AMQP client service for NestJS applications.

This service wraps TypedAmqpClient and integrates it with the NestJS
lifecycle, automatically initializing the connection on module init and
cleaning up resources on module destroy.

#### Example

```typescript
// In your module
import { AmqpClientModule } from "@amqp-contract/client-nestjs";

@Module({
  imports: [
    AmqpClientModule.forRoot({
      contract: myContract,
      urls: ["amqp://localhost"],
    }),
  ],
})
export class AppModule {}

// In your service
import { AmqpClientService } from "@amqp-contract/client-nestjs";

@Injectable()
export class OrderService {
  constructor(private readonly amqpClient: AmqpClientService<typeof myContract>) {}

  async createOrder(order: Order) {
    const result = await this.amqpClient
      .publish("orderCreated", {
        orderId: order.id,
        amount: order.total,
      })
      .resultToPromise();

    if (result.isError()) {
      throw new Error("Failed to publish order event");
    }
  }
}
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
new AmqpClientService<TContract>(options): AmqpClientService<TContract>;
```

Defined in: [packages/client-nestjs/src/client.service.ts:91](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/client-nestjs/src/client.service.ts#L91)

###### Parameters

| Parameter | Type                                                                 |
| --------- | -------------------------------------------------------------------- |
| `options` | [`AmqpClientModuleOptions`](#amqpclientmoduleoptions)\<`TContract`\> |

###### Returns

[`AmqpClientService`](#amqpclientservice)\<`TContract`\>

#### Methods

##### onModuleDestroy()

```ts
onModuleDestroy(): Promise<void>;
```

Defined in: [packages/client-nestjs/src/client.service.ts:118](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/client-nestjs/src/client.service.ts#L118)

Close the AMQP client when the NestJS module is destroyed.

This lifecycle hook ensures proper cleanup of resources when the
NestJS application shuts down, gracefully closing the connection
and cleaning up all consumers.

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

Defined in: [packages/client-nestjs/src/client.service.ts:103](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/client-nestjs/src/client.service.ts#L103)

Initialize the AMQP client when the NestJS module starts.

This lifecycle hook automatically creates and initializes the client
when the NestJS application starts up. The connection will be established
in the background with automatic reconnection handling.

###### Returns

`Promise`\<`void`\>

###### Implementation of

```ts
OnModuleInit.onModuleInit;
```

##### publish()

```ts
publish<TName>(
   publisherName,
   message,
options?): Future<Result<boolean, TechnicalError | MessageValidationError>>;
```

Defined in: [packages/client-nestjs/src/client.service.ts:148](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/client-nestjs/src/client.service.ts#L148)

Publish a message using a contract-defined publisher.

This method provides type-safe message publishing with automatic validation
and explicit error handling through the Result type.

###### Type Parameters

| Type Parameter                                     |
| -------------------------------------------------- |
| `TName` _extends_ `string` \| `number` \| `symbol` |

###### Parameters

| Parameter       | Type                                                | Description                                                |
| --------------- | --------------------------------------------------- | ---------------------------------------------------------- |
| `publisherName` | `TName`                                             | The name of the publisher from the contract                |
| `message`       | `ClientInferPublisherInput`\<`TContract`, `TName`\> | The message payload (type-checked against the contract)    |
| `options?`      | `Publish`                                           | Optional AMQP publish options (e.g., persistence, headers) |

###### Returns

`Future`\<`Result`\<`boolean`, `TechnicalError` \| `MessageValidationError`\>\>

A Future that resolves to a Result indicating success or failure

###### Example

```typescript
const result = await this.amqpClient
  .publish("orderCreated", {
    orderId: "123",
    amount: 99.99,
  })
  .resultToPromise();

if (result.isError()) {
  console.error("Publish failed:", result.error);
}
```

## Interfaces

### AmqpClientModuleOptions

Defined in: [packages/client-nestjs/src/client.service.ts:30](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/client-nestjs/src/client.service.ts#L30)

Configuration options for the AMQP client NestJS module.

#### Example

```typescript
const options: AmqpClientModuleOptions<typeof contract> = {
  contract: myContract,
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

| Property                                            | Type                           | Description                                                                  | Defined in                                                                                                                                                                                  |
| --------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="connectionoptions"></a> `connectionOptions?` | `AmqpConnectionManagerOptions` | Optional connection configuration (heartbeat, reconnect settings, etc.)      | [packages/client-nestjs/src/client.service.ts:36](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/client-nestjs/src/client.service.ts#L36) |
| <a id="contract"></a> `contract`                    | `TContract`                    | The AMQP contract definition specifying publishers and their message schemas | [packages/client-nestjs/src/client.service.ts:32](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/client-nestjs/src/client.service.ts#L32) |
| <a id="urls"></a> `urls`                            | `ConnectionUrl`[]              | AMQP broker URL(s). Multiple URLs provide failover support                   | [packages/client-nestjs/src/client.service.ts:34](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/client-nestjs/src/client.service.ts#L34) |

## Variables

### MODULE_OPTIONS_TOKEN

```ts
MODULE_OPTIONS_TOKEN: string | symbol;
```

Defined in: [packages/client-nestjs/src/client.module-definition.ts:9](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/client-nestjs/src/client.module-definition.ts#L9)
