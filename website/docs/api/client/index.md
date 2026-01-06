**@amqp-contract/client**

---

# @amqp-contract/client

## Classes

### MessageValidationError

Defined in: [packages/client/src/errors.ts:35](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/client/src/errors.ts#L35)

Error thrown when message validation fails

#### Extends

- `ClientError`

#### Constructors

##### Constructor

```ts
new MessageValidationError(publisherName, issues): MessageValidationError;
```

Defined in: [packages/client/src/errors.ts:36](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/client/src/errors.ts#L36)

###### Parameters

| Parameter       | Type      |
| --------------- | --------- |
| `publisherName` | `string`  |
| `issues`        | `unknown` |

###### Returns

[`MessageValidationError`](#messagevalidationerror)

###### Overrides

```ts
ClientError.constructor;
```

#### Properties

| Property                                       | Modifier   | Type      | Description                                                                                                                                                                                                                                                                                                                                                                                                                                       | Inherited from                | Defined in                                                                                                                                                    |
| ---------------------------------------------- | ---------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="cause"></a> `cause?`                    | `public`   | `unknown` | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `ClientError.cause`           | node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/lib.es2022.error.d.ts:26                                                                      |
| <a id="issues"></a> `issues`                   | `readonly` | `unknown` | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | -                             | [packages/client/src/errors.ts:38](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/client/src/errors.ts#L38) |
| <a id="message"></a> `message`                 | `public`   | `string`  | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `ClientError.message`         | node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/lib.es5.d.ts:1077                                                                             |
| <a id="name"></a> `name`                       | `public`   | `string`  | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `ClientError.name`            | node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/lib.es5.d.ts:1076                                                                             |
| <a id="publishername"></a> `publisherName`     | `readonly` | `string`  | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | -                             | [packages/client/src/errors.ts:37](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/client/src/errors.ts#L37) |
| <a id="stack"></a> `stack?`                    | `public`   | `string`  | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `ClientError.stack`           | node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/lib.es5.d.ts:1078                                                                             |
| <a id="stacktracelimit"></a> `stackTraceLimit` | `static`   | `number`  | The `Error.stackTraceLimit` property specifies the number of stack frames collected by a stack trace (whether generated by `new Error().stack` or `Error.captureStackTrace(obj)`). The default value is `10` but may be set to any valid JavaScript number. Changes will affect any stack trace captured _after_ the value has been changed. If set to a non-number value, or set to a negative number, stack traces will not capture any frames. | `ClientError.stackTraceLimit` | node_modules/.pnpm/@types+node@25.0.3/node_modules/@types/node/globals.d.ts:67                                                                                |

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
ClientError.captureStackTrace;
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
ClientError.prepareStackTrace;
```

---

### TechnicalError

Defined in: [packages/client/src/errors.ts:22](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/client/src/errors.ts#L22)

Error for technical/runtime failures that cannot be prevented by TypeScript
This includes validation failures and AMQP channel issues

#### Extends

- `ClientError`

#### Constructors

##### Constructor

```ts
new TechnicalError(message, cause?): TechnicalError;
```

Defined in: [packages/client/src/errors.ts:23](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/client/src/errors.ts#L23)

###### Parameters

| Parameter | Type      |
| --------- | --------- |
| `message` | `string`  |
| `cause?`  | `unknown` |

###### Returns

[`TechnicalError`](#technicalerror)

###### Overrides

```ts
ClientError.constructor;
```

#### Properties

| Property                                         | Modifier   | Type      | Description                                                                                                                                                                                                                                                                                                                                                                                                                                       | Inherited from                | Defined in                                                                                                                                                    |
| ------------------------------------------------ | ---------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="cause-1"></a> `cause?`                    | `readonly` | `unknown` | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `ClientError.cause`           | [packages/client/src/errors.ts:25](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/client/src/errors.ts#L25) |
| <a id="message-1"></a> `message`                 | `public`   | `string`  | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `ClientError.message`         | node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/lib.es5.d.ts:1077                                                                             |
| <a id="name-1"></a> `name`                       | `public`   | `string`  | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `ClientError.name`            | node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/lib.es5.d.ts:1076                                                                             |
| <a id="stack-1"></a> `stack?`                    | `public`   | `string`  | -                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `ClientError.stack`           | node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/lib.es5.d.ts:1078                                                                             |
| <a id="stacktracelimit-1"></a> `stackTraceLimit` | `static`   | `number`  | The `Error.stackTraceLimit` property specifies the number of stack frames collected by a stack trace (whether generated by `new Error().stack` or `Error.captureStackTrace(obj)`). The default value is `10` but may be set to any valid JavaScript number. Changes will affect any stack trace captured _after_ the value has been changed. If set to a non-number value, or set to a negative number, stack traces will not capture any frames. | `ClientError.stackTraceLimit` | node_modules/.pnpm/@types+node@25.0.3/node_modules/@types/node/globals.d.ts:67                                                                                |

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
ClientError.captureStackTrace;
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
ClientError.prepareStackTrace;
```

---

### TypedAmqpClient

Defined in: [packages/client/src/client.ts:21](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/client/src/client.ts#L21)

Type-safe AMQP client for publishing messages

#### Type Parameters

| Type Parameter                             |
| ------------------------------------------ |
| `TContract` _extends_ `ContractDefinition` |

#### Methods

##### close()

```ts
close(): Future<Result<void, TechnicalError>>;
```

Defined in: [packages/client/src/client.ts:117](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/client/src/client.ts#L117)

Close the channel and connection

###### Returns

`Future`\<`Result`\<`void`, [`TechnicalError`](#technicalerror)\>\>

##### publish()

```ts
publish<TName>(
   publisherName,
   message,
   options?): Future<Result<boolean,
  | TechnicalError
| MessageValidationError>>;
```

Defined in: [packages/client/src/client.ts:51](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/client/src/client.ts#L51)

Publish a message using a defined publisher
Returns Result.Ok(true) on success, or Result.Error with specific error on failure

###### Type Parameters

| Type Parameter                                     |
| -------------------------------------------------- |
| `TName` _extends_ `string` \| `number` \| `symbol` |

###### Parameters

| Parameter       | Type                                                                              |
| --------------- | --------------------------------------------------------------------------------- |
| `publisherName` | `TName`                                                                           |
| `message`       | [`ClientInferPublisherInput`](#clientinferpublisherinput)\<`TContract`, `TName`\> |
| `options?`      | `Publish`                                                                         |

###### Returns

`Future`\<`Result`\<`boolean`,
\| [`TechnicalError`](#technicalerror)
\| [`MessageValidationError`](#messagevalidationerror)\>\>

##### create()

```ts
static create<TContract>(__namedParameters): Future<Result<TypedAmqpClient<TContract>, TechnicalError>>;
```

Defined in: [packages/client/src/client.ts:34](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/client/src/client.ts#L34)

Create a type-safe AMQP client from a contract.

Connection management (including automatic reconnection) is handled internally
by amqp-connection-manager via the AmqpClient. The client establishes
infrastructure asynchronously in the background once the connection is ready.

###### Type Parameters

| Type Parameter                             |
| ------------------------------------------ |
| `TContract` _extends_ `ContractDefinition` |

###### Parameters

| Parameter           | Type                                                         |
| ------------------- | ------------------------------------------------------------ |
| `__namedParameters` | [`CreateClientOptions`](#createclientoptions)\<`TContract`\> |

###### Returns

`Future`\<`Result`\<[`TypedAmqpClient`](#typedamqpclient)\<`TContract`\>, [`TechnicalError`](#technicalerror)\>\>

## Type Aliases

### ClientInferPublisherInput

```ts
type ClientInferPublisherInput<TContract, TName> = PublisherInferInput<
  InferPublisher<TContract, TName>
>;
```

Defined in: [packages/client/src/types.ts:37](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/client/src/types.ts#L37)

Infer publisher input type (message payload) for a specific publisher in a contract

#### Type Parameters

| Type Parameter                                         |
| ------------------------------------------------------ |
| `TContract` _extends_ `ContractDefinition`             |
| `TName` _extends_ `InferPublisherNames`\<`TContract`\> |

---

### CreateClientOptions

```ts
type CreateClientOptions<TContract> = object;
```

Defined in: [packages/client/src/client.ts:12](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/client/src/client.ts#L12)

Options for creating a client

#### Type Parameters

| Type Parameter                             |
| ------------------------------------------ |
| `TContract` _extends_ `ContractDefinition` |

#### Properties

| Property                                            | Type                           | Defined in                                                                                                                                                    |
| --------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="connectionoptions"></a> `connectionOptions?` | `AmqpConnectionManagerOptions` | [packages/client/src/client.ts:15](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/client/src/client.ts#L15) |
| <a id="contract"></a> `contract`                    | `TContract`                    | [packages/client/src/client.ts:13](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/client/src/client.ts#L13) |
| <a id="urls"></a> `urls`                            | `ConnectionUrl`[]              | [packages/client/src/client.ts:14](https://github.com/btravers/amqp-contract/blob/ec7fedc554d09ac9312194971e6228aa420991f2/packages/client/src/client.ts#L14) |
