**@amqp-contract/client-nestjs**

---

# @amqp-contract/client-nestjs

## Classes

### AmqpClientModule

Defined in: [packages/client-nestjs/src/client.module.ts:93](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/client-nestjs/src/client.module.ts#L93)

NestJS module for AMQP client integration
This module provides type-safe AMQP client functionality using @amqp-contract/client
without relying on NestJS decorators (except for dependency injection)

#### Type Param

The contract definition type for type-safe publishing

#### Example

```typescript
// Synchronous configuration
@Module({
  imports: [
    AmqpClientModule.forRoot({
      contract: myContract,
      urls: ['amqp://localhost']
    })
  ]
})
export class AppModule {}

// Asynchronous configuration
@Module({
  imports: [
    AmqpClientModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        contract: myContract,
        urls: configService.get('AMQP_URLS')
      }),
      inject: [ConfigService]
    })
  ]
})
export class AppModule {}

// Using the client in a service
@Injectable()
export class OrderService {
  constructor(
    private readonly amqpClient: AmqpClientService<typeof myContract>
  ) {}

  async createOrder(order: Order) {
    // publish is fully typed based on the contract
    await this.amqpClient.publish('orderCreated', {
      orderId: order.id,
      amount: order.total
    }).resultToPromise();
  }
}
```

#### Constructors

##### Constructor

```ts
new AmqpClientModule(): AmqpClientModule;
```

###### Returns

[`AmqpClientModule`](#amqpclientmodule)

#### Methods

##### forRoot()

```ts
static forRoot<TContract>(options): DynamicModule;
```

Defined in: [packages/client-nestjs/src/client.module.ts:100](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/client-nestjs/src/client.module.ts#L100)

Register the AMQP client module with synchronous configuration

###### Type Parameters

| Type Parameter                             |
| ------------------------------------------ |
| `TContract` _extends_ `ContractDefinition` |

###### Parameters

| Parameter | Type                                                                 | Description                                    |
| --------- | -------------------------------------------------------------------- | ---------------------------------------------- |
| `options` | [`AmqpClientModuleOptions`](#amqpclientmoduleoptions)\<`TContract`\> | The client configuration options with contract |

###### Returns

`DynamicModule`

A dynamic module for NestJS

##### forRootAsync()

```ts
static forRootAsync<TContract>(options): DynamicModule;
```

Defined in: [packages/client-nestjs/src/client.module.ts:122](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/client-nestjs/src/client.module.ts#L122)

Register the AMQP client module with asynchronous configuration

###### Type Parameters

| Type Parameter                             |
| ------------------------------------------ |
| `TContract` _extends_ `ContractDefinition` |

###### Parameters

| Parameter | Type                                                                           | Description                                       |
| --------- | ------------------------------------------------------------------------------ | ------------------------------------------------- |
| `options` | [`AmqpClientModuleAsyncOptions`](#amqpclientmoduleasyncoptions)\<`TContract`\> | Async configuration options with factory function |

###### Returns

`DynamicModule`

A dynamic module for NestJS

---

### AmqpClientService

Defined in: [packages/client-nestjs/src/client.service.ts:86](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/client-nestjs/src/client.service.ts#L86)

Type-safe AMQP client service for NestJS applications.

This service wraps TypedAmqpClient and integrates it with the NestJS
lifecycle, automatically initializing the connection on module init and
cleaning up resources on module destroy.

#### Example

```typescript
// In your module
import { AmqpClientModule } from '@amqp-contract/client-nestjs';

@Module({
  imports: [
    AmqpClientModule.forRoot({
      contract: myContract,
      urls: ['amqp://localhost']
    })
  ]
})
export class AppModule {}

// In your service
import { AmqpClientService } from '@amqp-contract/client-nestjs';

@Injectable()
export class OrderService {
  constructor(
    private readonly amqpClient: AmqpClientService<typeof myContract>
  ) {}

  async createOrder(order: Order) {
    const result = await this.amqpClient.publish('orderCreated', {
      orderId: order.id,
      amount: order.total
    }).resultToPromise();

    if (result.isError()) {
      throw new Error('Failed to publish order event');
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

Defined in: [packages/client-nestjs/src/client.service.ts:91](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/client-nestjs/src/client.service.ts#L91)

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

Defined in: [packages/client-nestjs/src/client.service.ts:118](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/client-nestjs/src/client.service.ts#L118)

Close the AMQP client when the NestJS module is destroyed.

This lifecycle hook ensures proper cleanup of resources when the
NestJS application shuts down, gracefully closing the connection
and cleaning up all consumers.

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

Defined in: [packages/client-nestjs/src/client.service.ts:103](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/client-nestjs/src/client.service.ts#L103)

Initialize the AMQP client when the NestJS module starts.

This lifecycle hook automatically creates and initializes the client
when the NestJS application starts up. The connection will be established
in the background with automatic reconnection handling.

###### Returns

`Promise`\<`void`\>

###### Implementation of

```ts
OnModuleInit.onModuleInit
```

##### publish()

```ts
publish<TName>(
   publisherName,
   message,
   options?): Future<Result<void,
  | TechnicalError
| MessageValidationError>>;
```

Defined in: [packages/client-nestjs/src/client.service.ts:148](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/client-nestjs/src/client.service.ts#L148)

Publish a message using a contract-defined publisher.

This method provides type-safe message publishing with automatic validation
and explicit error handling through the Result type.

###### Type Parameters

| Type Parameter                                     |
| -------------------------------------------------- |
| `TName` _extends_ `string` \| `number` \| `symbol` |

###### Parameters

| Parameter       | Type                                                                              | Description                                                |
| --------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `publisherName` | `TName`                                                                           | The name of the publisher from the contract                |
| `message`       | [`ClientInferPublisherInput`](#clientinferpublisherinput)\<`TContract`, `TName`\> | The message payload (type-checked against the contract)    |
| `options?`      | `Publish`                                                                         | Optional AMQP publish options (e.g., persistence, headers) |

###### Returns

`Future`\<`Result`\<`void`,
\| [`TechnicalError`](#technicalerror)
\| [`MessageValidationError`](#messagevalidationerror)\>\>

A Future that resolves to a Result indicating success or failure

###### Example

```typescript
const result = await this.amqpClient.publish('orderCreated', {
  orderId: '123',
  amount: 99.99
}).resultToPromise();

if (result.isError()) {
  console.error('Publish failed:', result.error);
}
```

## Interfaces

### MessageValidationError

Defined in: packages/client/dist/index.d.mts:26

Error thrown when message validation fails

#### Extends

- `ClientError`

#### Properties

| Property                                   | Modifier   | Type      | Inherited from        | Defined in                                                                               |
| ------------------------------------------ | ---------- | --------- | --------------------- | ---------------------------------------------------------------------------------------- |
| <a id="cause"></a> `cause?`                | `public`   | `unknown` | `ClientError.cause`   | node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/lib.es2022.error.d.ts:26 |
| <a id="issues"></a> `issues`               | `readonly` | `unknown` | -                     | packages/client/dist/index.d.mts:28                                                      |
| <a id="message"></a> `message`             | `public`   | `string`  | `ClientError.message` | node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/lib.es5.d.ts:1077        |
| <a id="name"></a> `name`                   | `public`   | `string`  | `ClientError.name`    | node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/lib.es5.d.ts:1076        |
| <a id="publishername"></a> `publisherName` | `readonly` | `string`  | -                     | packages/client/dist/index.d.mts:27                                                      |
| <a id="stack"></a> `stack?`                | `public`   | `string`  | `ClientError.stack`   | node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/lib.es5.d.ts:1078        |

---

### TechnicalError

Defined in: packages/client/dist/index.d.mts:19

Error for technical/runtime failures that cannot be prevented by TypeScript
This includes validation failures and AMQP channel issues

#### Extends

- `ClientError`

#### Properties

| Property                         | Modifier   | Type      | Overrides           | Inherited from        | Defined in                                                                        |
| -------------------------------- | ---------- | --------- | ------------------- | --------------------- | --------------------------------------------------------------------------------- |
| <a id="cause-1"></a> `cause?`    | `readonly` | `unknown` | `ClientError.cause` | -                     | packages/client/dist/index.d.mts:20                                               |
| <a id="message-1"></a> `message` | `public`   | `string`  | -                   | `ClientError.message` | node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/lib.es5.d.ts:1077 |
| <a id="name-1"></a> `name`       | `public`   | `string`  | -                   | `ClientError.name`    | node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/lib.es5.d.ts:1076 |
| <a id="stack-1"></a> `stack?`    | `public`   | `string`  | -                   | `ClientError.stack`   | node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/lib.es5.d.ts:1078 |

## Type Aliases

### AmqpClientModuleAsyncOptions

```ts
type AmqpClientModuleAsyncOptions<TContract> = object;
```

Defined in: [packages/client-nestjs/src/client.module.ts:22](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/client-nestjs/src/client.module.ts#L22)

Options for async module configuration using factory pattern

#### Type Parameters

| Type Parameter                             |
| ------------------------------------------ |
| `TContract` _extends_ `ContractDefinition` |

#### Properties

| Property                             | Type                                                           | Description                                                                                                                   | Defined in                                                                                                                                                                                |
| ------------------------------------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="imports"></a> `imports?`      | `ModuleMetadata`\[`"imports"`\]                                | Optional list of imported modules that export providers needed by the factory                                                 | [packages/client-nestjs/src/client.module.ts:37](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/client-nestjs/src/client.module.ts#L37) |
| <a id="inject"></a> `inject?`        | (`string` \| `symbol` \| `Type`\<`unknown`\>)[]                | Optional dependencies to inject into the factory function. Can be a token (string/symbol) or a class reference to a provider. | [packages/client-nestjs/src/client.module.ts:33](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/client-nestjs/src/client.module.ts#L33) |
| <a id="usefactory"></a> `useFactory` | (...`args`) => `AmqpClientModuleOptionsFactory`\<`TContract`\> | Factory function that returns the module options. Can use injected dependencies to create configuration.                      | [packages/client-nestjs/src/client.module.ts:28](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/client-nestjs/src/client.module.ts#L28) |

---

### AmqpClientModuleOptions

```ts
type AmqpClientModuleOptions<TContract> = object;
```

Defined in: [packages/client-nestjs/src/client.service.ts:30](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/client-nestjs/src/client.service.ts#L30)

Configuration options for the AMQP client NestJS module.

#### Example

```typescript
const options: AmqpClientModuleOptions<typeof contract> = {
  contract: myContract,
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

| Property                                            | Type                           | Description                                                                  | Defined in                                                                                                                                                                                  |
| --------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="connectionoptions"></a> `connectionOptions?` | `AmqpConnectionManagerOptions` | Optional connection configuration (heartbeat, reconnect settings, etc.)      | [packages/client-nestjs/src/client.service.ts:36](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/client-nestjs/src/client.service.ts#L36) |
| <a id="contract"></a> `contract`                    | `TContract`                    | The AMQP contract definition specifying publishers and their message schemas | [packages/client-nestjs/src/client.service.ts:32](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/client-nestjs/src/client.service.ts#L32) |
| <a id="urls"></a> `urls`                            | `ConnectionUrl`[]              | AMQP broker URL(s). Multiple URLs provide failover support                   | [packages/client-nestjs/src/client.service.ts:34](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/client-nestjs/src/client.service.ts#L34) |

---

### ClientInferPublisherInput

```ts
type ClientInferPublisherInput<TContract, TName> = PublisherInferInput<InferPublisher<TContract, TName>>;
```

Defined in: packages/client/dist/index.d.mts:52

Infer publisher input type (message payload) for a specific publisher in a contract

#### Type Parameters

| Type Parameter                                         |
| ------------------------------------------------------ |
| `TContract` _extends_ `ContractDefinition`             |
| `TName` _extends_ `InferPublisherNames`\<`TContract`\> |

## Variables

### MODULE_OPTIONS_TOKEN

```ts
const MODULE_OPTIONS_TOKEN: typeof MODULE_OPTIONS_TOKEN;
```

Defined in: [packages/client-nestjs/src/client.module-definition.ts:5](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/client-nestjs/src/client.module-definition.ts#L5)

Injection token for AMQP client module options
Used by NestJS DI system to inject configuration into AmqpClientService
