import type {
  ConsumerDefinition,
  DirectExchangeDefinition,
  MessageDefinition,
  PublisherDefinition,
  QueueDefinition,
  QueueEntry,
  RpcClientConfigBase,
  RpcServerConfigBase,
} from "../types.js";
import { definePublisherInternal } from "./publisher.js";
import { extractQueue } from "./queue-utils.js";

/**
 * The AMQP default direct exchange. Every queue is implicitly bound to it with
 * a routing key equal to the queue name, so RPC servers do not need to declare
 * an exchange or binding — sending to `""` with `routingKey = queueName` reaches
 * the queue. Topology setup skips this exchange (RabbitMQ does not allow
 * asserting it).
 */
const DEFAULT_DIRECT_EXCHANGE: DirectExchangeDefinition<""> = {
  name: "",
  type: "direct",
};

/**
 * Configuration for an RPC server.
 *
 * An RPC server owns a request queue and declares both a request and a response
 * schema. The worker's handler must return `Future<Result<TResponseMessage["payload"], HandlerError>>`;
 * the worker validates the response against the schema and publishes it back to
 * `msg.properties.replyTo` with the same `correlationId`.
 *
 * @template TRequestMessage - The request message definition
 * @template TResponseMessage - The response message definition
 * @template TQueue - The queue entry that receives requests
 */
export type RpcServerConfig<
  TRequestMessage extends MessageDefinition,
  TResponseMessage extends MessageDefinition,
  TQueue extends QueueEntry = QueueEntry,
> = {
  __brand: "RpcServerConfig";
  // Intersect with a non-optional `responseMessage` so type-level inference
  // can recognise this as an RPC consumer. The base `ConsumerDefinition`
  // declares it as optional, which under `exactOptionalPropertyTypes` does not
  // satisfy `extends { responseMessage: MessageDefinition }`.
  consumer: ConsumerDefinition<TRequestMessage, TResponseMessage> & {
    responseMessage: TResponseMessage;
  };
  queue: TQueue;
  requestMessage: TRequestMessage;
  responseMessage: TResponseMessage;
};

/**
 * Configuration for an RPC client targeting an RPC server.
 *
 * An RPC client publishes requests to the server's queue via the AMQP default
 * direct exchange (`""`) using the queue name as routing key, and listens for
 * responses on a reply queue managed by `TypedAmqpClient`. Carries both schemas
 * so `client.call(name, request, { timeoutMs })` is fully typed on both
 * directions.
 */
export type RpcClientConfig<
  TRequestMessage extends MessageDefinition,
  TResponseMessage extends MessageDefinition,
> = {
  __brand: "RpcClientConfig";
  publisher: PublisherDefinition<TRequestMessage, TResponseMessage> & {
    responseMessage: TResponseMessage;
  };
  requestMessage: TRequestMessage;
  responseMessage: TResponseMessage;
};

/**
 * Define an RPC server: a consumer that receives typed requests on a queue and
 * publishes typed responses back to the caller via `msg.properties.replyTo`.
 *
 * The server is exposed in `defineContract({ consumers: { name: ... } })` and
 * the worker handler for `name` must return
 * `Future<Result<TResponseMessage["payload"], HandlerError>>`.
 *
 * @param queue - The queue that receives RPC requests. The queue name is also
 *   used as the routing key on the default direct exchange.
 * @param messages - Both schemas for this RPC operation
 * @param messages.request - Schema validated against incoming request payloads
 * @param messages.response - Schema validated against handler return values
 * @returns An RPC server config consumable by `defineContract`
 *
 * @example
 * ```typescript
 * import { defineQueue, defineMessage, defineRpcServer } from '@amqp-contract/contract';
 * import { z } from 'zod';
 *
 * const calculateRpc = defineRpcServer(defineQueue('rpc.calculate'), {
 *   request: defineMessage(z.object({ a: z.number(), b: z.number() })),
 *   response: defineMessage(z.object({ sum: z.number() })),
 * });
 * ```
 */
export function defineRpcServer<
  TRequestMessage extends MessageDefinition,
  TResponseMessage extends MessageDefinition,
  TQueue extends QueueEntry,
>(
  queue: TQueue,
  messages: { request: TRequestMessage; response: TResponseMessage },
): RpcServerConfig<TRequestMessage, TResponseMessage, TQueue> {
  const consumer = {
    queue,
    message: messages.request,
    responseMessage: messages.response,
  } satisfies ConsumerDefinition<TRequestMessage, TResponseMessage> & {
    responseMessage: TResponseMessage;
  };

  return {
    __brand: "RpcServerConfig",
    consumer,
    queue,
    requestMessage: messages.request,
    responseMessage: messages.response,
  };
}

/**
 * Define an RPC client targeting a previously-defined RPC server.
 *
 * The client publishes to the AMQP default direct exchange with the server's
 * queue name as routing key. Schemas are inherited from the server config so
 * the client and server cannot drift.
 *
 * @param rpcServer - The RPC server to call
 * @returns An RPC client config consumable by `defineContract`
 *
 * @example
 * ```typescript
 * const callCalculate = defineRpcClient(calculateRpc);
 *
 * const contract = defineContract({
 *   consumers: { calculate: calculateRpc },
 *   publishers: { calculate: callCalculate },
 * });
 *
 * // Server side (worker)
 * handlers: {
 *   calculate: ({ payload }) =>
 *     Future.value(Result.Ok({ sum: payload.a + payload.b })),
 * }
 *
 * // Client side
 * const result = await client.call('calculate', { a: 1, b: 2 }, { timeoutMs: 5_000 }).toPromise();
 * ```
 */
export function defineRpcClient<
  TRequestMessage extends MessageDefinition,
  TResponseMessage extends MessageDefinition,
  TQueue extends QueueEntry,
>(
  rpcServer: RpcServerConfig<TRequestMessage, TResponseMessage, TQueue>,
): RpcClientConfig<TRequestMessage, TResponseMessage> {
  const queueDef: QueueDefinition = extractQueue(rpcServer.queue);
  const basePublisher = definePublisherInternal(DEFAULT_DIRECT_EXCHANGE, rpcServer.requestMessage, {
    routingKey: queueDef.name,
  });
  const publisher = {
    ...basePublisher,
    responseMessage: rpcServer.responseMessage,
  } as PublisherDefinition<TRequestMessage, TResponseMessage> & {
    responseMessage: TResponseMessage;
  };

  return {
    __brand: "RpcClientConfig",
    publisher,
    requestMessage: rpcServer.requestMessage,
    responseMessage: rpcServer.responseMessage,
  };
}

/**
 * Type guard to check if a value is an `RpcServerConfig`.
 */
export function isRpcServerConfig(value: unknown): value is RpcServerConfigBase {
  return (
    typeof value === "object" &&
    value !== null &&
    "__brand" in value &&
    value.__brand === "RpcServerConfig"
  );
}

/**
 * Type guard to check if a value is an `RpcClientConfig`.
 */
export function isRpcClientConfig(value: unknown): value is RpcClientConfigBase {
  return (
    typeof value === "object" &&
    value !== null &&
    "__brand" in value &&
    value.__brand === "RpcClientConfig"
  );
}
