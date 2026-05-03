import {
  type ConsumerDefinition,
  type ContractDefinition,
  type InferConsumerNames,
  type InferRpcNames,
  extractConsumer,
  extractQueue,
} from "@amqp-contract/contract";
import {
  AmqpClient,
  ConsumerOptions as AmqpClientConsumerOptions,
  type Logger,
  TechnicalError,
  type TelemetryProvider,
  defaultTelemetryProvider,
  endSpanError,
  endSpanSuccess,
  recordConsumeMetric,
  startConsumeSpan,
} from "@amqp-contract/core";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { Future, Result } from "@swan-io/boxed";
import type { AmqpConnectionManagerOptions, ConnectionUrl } from "amqp-connection-manager";
import type { ConsumeMessage } from "amqplib";
import { decompressBuffer } from "./decompression.js";
import type { HandlerError } from "./errors.js";
import { MessageValidationError, NonRetryableError } from "./errors.js";
import { handleError } from "./retry.js";
import type { WorkerInferHandlers } from "./types.js";

/**
 * Either a regular consumer name or an RPC name from the contract.
 */
type HandlerName<TContract extends ContractDefinition> =
  | InferConsumerNames<TContract>
  | InferRpcNames<TContract>;

/**
 * Resolved handler entry stored on the worker, regardless of whether the
 * source is a `consumers` or `rpcs` slot. The handler signature is widened
 * here because both kinds share the same dispatch loop; specific call sites
 * cast back to the correct typed handler.
 */
type StoredHandler = (
  message: { payload: unknown; headers: unknown },
  rawMessage: ConsumeMessage,
) => Future<Result<unknown, HandlerError>>;

export type ConsumerOptions = AmqpClientConsumerOptions;

/**
 * Type guard to check if a handler entry is a tuple format [handler, options].
 */
function isHandlerTuple(entry: unknown): entry is [unknown, ConsumerOptions] {
  return Array.isArray(entry) && entry.length === 2;
}

/**
 * Options for creating a type-safe AMQP worker.
 *
 * @typeParam TContract - The contract definition type
 *
 * @example
 * ```typescript
 * const options: CreateWorkerOptions<typeof contract> = {
 *   contract: myContract,
 *   handlers: {
 *     // Simple handler
 *     processOrder: ({ payload }) => {
 *       console.log('Processing order:', payload.orderId);
 *       return Future.value(Result.Ok(undefined));
 *     },
 *     // Handler with prefetch configuration
 *     processPayment: [
 *       ({ payload }) => {
 *         console.log('Processing payment:', payload.paymentId);
 *         return Future.value(Result.Ok(undefined));
 *       },
 *       { prefetch: 10 }
 *     ]
 *   },
 *   urls: ['amqp://localhost'],
 *   defaultConsumerOptions: {
 *     prefetch: 5,
 *   },
 *   connectionOptions: {
 *     heartbeatIntervalInSeconds: 30
 *   },
 *   logger: myLogger
 * };
 * ```
 *
 * Note: Retry configuration is defined at the queue level in the contract,
 * not at the handler level. See `QueueDefinition.retry` for configuration options.
 */
export type CreateWorkerOptions<TContract extends ContractDefinition> = {
  /** The AMQP contract definition specifying consumers and their message schemas */
  contract: TContract;
  /**
   * Handlers for each `consumers` and `rpcs` entry in the contract.
   *
   * - Regular consumers return `Future<Result<void, HandlerError>>`.
   * - RPC handlers return `Future<Result<TResponse, HandlerError>>` where
   *   `TResponse` is inferred from the RPC's response message schema.
   *
   * Use `defineHandler` / `defineHandlers` to create handlers with full type
   * inference.
   */
  handlers: WorkerInferHandlers<TContract>;
  /** AMQP broker URL(s). Multiple URLs provide failover support */
  urls: ConnectionUrl[];
  /** Optional connection configuration (heartbeat, reconnect settings, etc.) */
  connectionOptions?: AmqpConnectionManagerOptions | undefined;
  /** Optional logger for logging message consumption and errors */
  logger?: Logger | undefined;
  /**
   * Optional telemetry provider for tracing and metrics.
   * If not provided, uses the default provider which attempts to load OpenTelemetry.
   * OpenTelemetry instrumentation is automatically enabled if @opentelemetry/api is installed.
   */
  telemetry?: TelemetryProvider | undefined;
  /**
   * Optional default consumer options applied to all consumer handlers.
   * Handler-specific options provided in tuple form override these defaults.
   */
  defaultConsumerOptions?: ConsumerOptions | undefined;
  /**
   * Maximum time in ms to wait for the AMQP connection to become ready before
   * `create()` resolves to `Result.Error<TechnicalError>`. Defaults to 30s
   * (the {@link AmqpClient}'s `DEFAULT_CONNECT_TIMEOUT_MS`). Pass `null` to
   * disable the timeout and let amqp-connection-manager retry indefinitely.
   */
  connectTimeoutMs?: number | null | undefined;
};

/**
 * Type-safe AMQP worker for consuming messages from RabbitMQ.
 *
 * This class provides automatic message validation, connection management,
 * and error handling for consuming messages based on a contract definition.
 *
 * @typeParam TContract - The contract definition type
 *
 * @example
 * ```typescript
 * import { TypedAmqpWorker } from '@amqp-contract/worker';
 * import { defineQueue, defineMessage, defineContract, defineConsumer } from '@amqp-contract/contract';
 * import { z } from 'zod';
 *
 * const orderQueue = defineQueue('order-processing');
 * const orderMessage = defineMessage(z.object({
 *   orderId: z.string(),
 *   amount: z.number()
 * }));
 *
 * const contract = defineContract({
 *   consumers: {
 *     processOrder: defineConsumer(orderQueue, orderMessage)
 *   }
 * });
 *
 * const worker = await TypedAmqpWorker.create({
 *   contract,
 *   handlers: {
 *     processOrder: async (message) => {
 *       console.log('Processing order', message.orderId);
 *       // Process the order...
 *     }
 *   },
 *   urls: ['amqp://localhost']
 * }).resultToPromise();
 *
 * // Close when done
 * await worker.close().resultToPromise();
 * ```
 */
export class TypedAmqpWorker<TContract extends ContractDefinition> {
  /**
   * Internal handler storage. Keyed by handler name (consumer or RPC); the
   * stored function signature is widened so the dispatch loop can call it
   * uniformly. The actual handler is type-checked at the worker's public API
   * boundary via `WorkerInferHandlers<TContract>`.
   */
  private readonly actualHandlers: Partial<Record<HandlerName<TContract>, StoredHandler>>;
  private readonly consumerOptions: Partial<Record<HandlerName<TContract>, ConsumerOptions>>;
  private readonly consumerTags: Set<string> = new Set();
  private readonly telemetry: TelemetryProvider;

  private constructor(
    private readonly contract: TContract,
    private readonly amqpClient: AmqpClient,
    handlers: WorkerInferHandlers<TContract>,
    private readonly defaultConsumerOptions: ConsumerOptions,
    private readonly logger?: Logger,
    telemetry?: TelemetryProvider,
  ) {
    this.telemetry = telemetry ?? defaultTelemetryProvider;

    this.actualHandlers = {};
    this.consumerOptions = {};

    const handlersRecord = handlers as Record<string, unknown>;

    for (const handlerName of Object.keys(handlersRecord)) {
      const handlerEntry = handlersRecord[handlerName];
      const typedName = handlerName as HandlerName<TContract>;

      if (isHandlerTuple(handlerEntry)) {
        const [handler, options] = handlerEntry;
        this.actualHandlers[typedName] = handler as StoredHandler;
        this.consumerOptions[typedName] = {
          ...this.defaultConsumerOptions,
          ...options,
        };
      } else {
        this.actualHandlers[typedName] = handlerEntry as StoredHandler;
        this.consumerOptions[typedName] = this.defaultConsumerOptions;
      }
    }
  }

  /**
   * Build a `ConsumerDefinition`-shaped view for a handler name, regardless
   * of whether it came from `contract.consumers` or `contract.rpcs`. The
   * dispatch path treats both uniformly; the returned `isRpc` flag (and the
   * accompanying `responseSchema`) tells `processMessage` whether to validate
   * the handler return value and publish a reply.
   */
  private resolveConsumerView(name: HandlerName<TContract>): {
    consumer: ConsumerDefinition;
    isRpc: boolean;
    responseSchema?: StandardSchemaV1;
  } {
    // Use `Object.hasOwn` rather than `key in rpcs` so prototype properties
    // (e.g. "toString") on a plain object are not misclassified as RPC names.
    const rpcs = this.contract.rpcs;
    if (rpcs && Object.hasOwn(rpcs, name as string)) {
      const rpc = rpcs[name as string]!;
      return {
        consumer: { queue: rpc.queue, message: rpc.request },
        isRpc: true,
        responseSchema: rpc.response.payload,
      };
    }
    const consumerEntry = this.contract.consumers![name as string]!;
    return {
      consumer: extractConsumer(consumerEntry),
      isRpc: false,
    };
  }

  /**
   * Create a type-safe AMQP worker from a contract.
   *
   * Connection management (including automatic reconnection) is handled internally
   * by amqp-connection-manager via the {@link AmqpClient}. The worker will set up
   * consumers for all contract-defined handlers asynchronously in the background
   * once the underlying connection and channels are ready.
   *
   * Connections are automatically shared across clients and workers with the same
   * URLs and connection options, following RabbitMQ best practices.
   *
   * @param options - Configuration options for the worker
   * @returns A Future that resolves to a Result containing the worker or an error
   *
   * @example
   * ```typescript
   * const worker = await TypedAmqpWorker.create({
   *   contract: myContract,
   *   handlers: {
   *     processOrder: async ({ payload }) => console.log('Order:', payload.orderId)
   *   },
   *   urls: ['amqp://localhost']
   * }).resultToPromise();
   * ```
   */
  static create<TContract extends ContractDefinition>({
    contract,
    handlers,
    urls,
    connectionOptions,
    defaultConsumerOptions,
    logger,
    telemetry,
    connectTimeoutMs,
  }: CreateWorkerOptions<TContract>): Future<Result<TypedAmqpWorker<TContract>, TechnicalError>> {
    const worker = new TypedAmqpWorker(
      contract,
      new AmqpClient(contract, {
        urls,
        connectionOptions,
        connectTimeoutMs,
      }),
      handlers,
      defaultConsumerOptions ?? {},
      logger,
      telemetry,
    );

    // Note: Wait queues are now created by the core package in setupAmqpTopology
    // when the queue's retry mode is "ttl-backoff"
    return worker
      .waitForConnectionReady()
      .flatMapOk(() => worker.consumeAll())
      .flatMap((result) =>
        result.match({
          Ok: () => Future.value(Result.Ok<TypedAmqpWorker<TContract>, TechnicalError>(worker)),
          // Release the AmqpClient's connection ref-count and cancel any consumers
          // that registered before the failure, so a failed create() does not leak.
          Error: (error) =>
            worker
              .close()
              .tapError((closeError) => {
                logger?.warn("Failed to close worker after setup failure", {
                  error: closeError,
                });
              })
              .map(() => Result.Error<TypedAmqpWorker<TContract>, TechnicalError>(error)),
        }),
      );
  }

  /**
   * Close the AMQP channel and connection.
   *
   * This gracefully closes the connection to the AMQP broker,
   * stopping all message consumption and cleaning up resources.
   *
   * @returns A Future that resolves to a Result indicating success or failure
   *
   * @example
   * ```typescript
   * const closeResult = await worker.close().resultToPromise();
   * if (closeResult.isOk()) {
   *   console.log('Worker closed successfully');
   * }
   * ```
   */
  close(): Future<Result<void, TechnicalError>> {
    return Future.all(
      Array.from(this.consumerTags).map((consumerTag) =>
        this.amqpClient.cancel(consumerTag).mapErrorToResult((error) => {
          this.logger?.warn("Failed to cancel consumer during close", { consumerTag, error });
          return Result.Ok(undefined);
        }),
      ),
    )
      .map(Result.all)
      .tapOk(() => {
        // Clear consumer tags after successful cancellation
        this.consumerTags.clear();
      })
      .flatMapOk(() => this.amqpClient.close())
      .mapOk(() => undefined);
  }

  /**
   * Start consuming for every entry in `contract.consumers` and `contract.rpcs`.
   */
  private consumeAll(): Future<Result<void, TechnicalError>> {
    const consumerNames = Object.keys(
      this.contract.consumers ?? {},
    ) as InferConsumerNames<TContract>[];
    const rpcNames = Object.keys(this.contract.rpcs ?? {}) as InferRpcNames<TContract>[];
    const allNames = [...consumerNames, ...rpcNames] as HandlerName<TContract>[];

    return Future.all(allNames.map((name) => this.consume(name)))
      .map(Result.all)
      .mapOk(() => undefined);
  }

  private waitForConnectionReady(): Future<Result<void, TechnicalError>> {
    return this.amqpClient.waitForConnect();
  }

  /**
   * Start consuming messages for a specific handler — either a `consumers`
   * entry (regular event/command consumer) or an `rpcs` entry (RPC server).
   */
  private consume(name: HandlerName<TContract>): Future<Result<void, TechnicalError>> {
    const view = this.resolveConsumerView(name);
    // Non-null assertion safe: `WorkerInferHandlers<TContract>` requires every
    // consumers / rpcs key to have a handler, so by the time we reach this
    // dispatch path the entry exists in `actualHandlers`. Enforced by the type
    // system at the public API boundary, not by a runtime check.
    const handler = this.actualHandlers[name]!;

    return this.consumeSingle(name, view, handler);
  }

  /**
   * Validate data against a Standard Schema. No side effects; the caller is
   * responsible for ack/nack based on the Result.
   */
  private validateSchema(
    schema: StandardSchemaV1,
    data: unknown,
    context: { consumerName: string; field: string },
  ): Future<Result<unknown, TechnicalError>> {
    const rawValidation = schema["~standard"].validate(data);
    const validationPromise =
      rawValidation instanceof Promise ? rawValidation : Promise.resolve(rawValidation);

    return Future.fromPromise(validationPromise)
      .mapError((error) => new TechnicalError(`Error validating ${context.field}`, error))
      .mapOkToResult((result) => {
        if (result.issues) {
          return Result.Error(
            new TechnicalError(
              `${context.field} validation failed`,
              new MessageValidationError(context.consumerName, result.issues),
            ),
          );
        }
        return Result.Ok(result.value);
      });
  }

  /**
   * Parse and validate a message from AMQP. Pure: returns the validated payload
   * and headers, or an error. The dispatch path in {@link processMessage} routes
   * validation/parse errors directly to the DLQ (single nack) — they never enter
   * the retry pipeline because retrying an unparseable or schema-violating
   * payload cannot succeed.
   */
  private parseAndValidateMessage(
    msg: ConsumeMessage,
    consumer: ConsumerDefinition,
    consumerName: HandlerName<TContract>,
  ): Future<Result<{ payload: unknown; headers: unknown }, TechnicalError>> {
    const context = { consumerName: String(consumerName) };

    const parsePayload = decompressBuffer(msg.content, msg.properties.contentEncoding)
      .mapErrorToResult((error) =>
        Result.Error(new TechnicalError("Failed to decompress message", error)),
      )
      .mapOkToResult((buffer) =>
        Result.fromExecution(() => JSON.parse(buffer.toString()) as unknown).mapError(
          (error) => new TechnicalError("Failed to parse JSON", error),
        ),
      )
      .flatMapOk((parsed) =>
        this.validateSchema(consumer.message.payload as StandardSchemaV1, parsed, {
          ...context,
          field: "payload",
        }),
      );

    const parseHeaders = consumer.message.headers
      ? this.validateSchema(
          consumer.message.headers as StandardSchemaV1,
          msg.properties.headers ?? {},
          {
            ...context,
            field: "headers",
          },
        )
      : Future.value(Result.Ok<unknown, TechnicalError>(undefined));

    return Future.allFromDict({ payload: parsePayload, headers: parseHeaders }).map(
      Result.allFromDict,
    ) as Future<Result<{ payload: unknown; headers: unknown }, TechnicalError>>;
  }

  /**
   * Validate an RPC handler's response and publish it back to the caller's reply
   * queue with the same `correlationId`. Published via the AMQP default exchange
   * with `routingKey = msg.properties.replyTo`, which works for both
   * `amq.rabbitmq.reply-to` and any anonymous queue declared by the caller.
   *
   * Failure semantics:
   * - **Missing replyTo / correlationId**: NonRetryableError. The caller is
   *   already lost; retrying the original message cannot recover the reply
   *   path. The poison message lands in DLQ for inspection rather than being
   *   silently ack'd (which would mask a contract violation).
   * - **Schema validation failure**: NonRetryableError — the handler returned
   *   the wrong shape; retrying the same input will not fix it.
   * - **Publish failure**: NonRetryableError. The caller has already timed out
   *   (or will shortly), so retrying the message wastes the queue's retry
   *   budget on a reply that no one is waiting for. The message is logged and
   *   DLQ'd; the original work is treated as completed for the purpose of the
   *   inbox.
   */
  private publishRpcResponse(
    msg: ConsumeMessage,
    queueName: string,
    rpcName: HandlerName<TContract>,
    responseSchema: StandardSchemaV1,
    response: unknown,
  ): Future<Result<void, HandlerError>> {
    const replyTo = msg.properties.replyTo;
    const correlationId = msg.properties.correlationId;
    if (typeof replyTo !== "string" || replyTo.length === 0) {
      this.logger?.error(
        "RPC handler returned a response but the incoming message has no replyTo",
        { rpcName: String(rpcName), queueName },
      );
      return Future.value(
        Result.Error<void, HandlerError>(
          new NonRetryableError(
            `RPC "${String(rpcName)}" received a message without replyTo; cannot deliver response`,
          ),
        ),
      );
    }
    if (typeof correlationId !== "string" || correlationId.length === 0) {
      // Without a correlationId the client cannot match the reply to its
      // pending call — publishing anyway would guarantee a client-side timeout.
      this.logger?.error(
        "RPC handler returned a response but the incoming message has no correlationId",
        { rpcName: String(rpcName), queueName, replyTo },
      );
      return Future.value(
        Result.Error<void, HandlerError>(
          new NonRetryableError(
            `RPC "${String(rpcName)}" received a message without correlationId; cannot deliver response`,
          ),
        ),
      );
    }

    // Wrap the call to `validate` itself in try/catch — a Standard Schema
    // implementation may throw synchronously (not via a rejected Promise), and
    // we don't want that to crash the consume callback.
    let rawValidation: ReturnType<StandardSchemaV1["~standard"]["validate"]>;
    try {
      rawValidation = responseSchema["~standard"].validate(response);
    } catch (error: unknown) {
      return Future.value(
        Result.Error<void, HandlerError>(
          new NonRetryableError("RPC response schema validation threw", error),
        ),
      );
    }
    const validationPromise =
      rawValidation instanceof Promise ? rawValidation : Promise.resolve(rawValidation);

    return Future.fromPromise(validationPromise)
      .mapError(
        (error: unknown) =>
          new NonRetryableError("RPC response schema validation threw", error) as HandlerError,
      )
      .mapOkToResult((validation) => {
        if (validation.issues) {
          return Result.Error<unknown, HandlerError>(
            new NonRetryableError(
              `RPC response for "${String(rpcName)}" failed schema validation`,
              new MessageValidationError(String(rpcName), validation.issues),
            ),
          );
        }
        return Result.Ok<unknown, HandlerError>(validation.value);
      })
      .flatMapOk((validatedResponse) =>
        this.amqpClient
          .publish("", replyTo, validatedResponse, {
            correlationId,
            contentType: "application/json",
          })
          // Reply-side failures are not retryable from the inbox: by the time
          // the broker can't deliver the reply, the caller's RPC future has
          // already (or will soon) time out. Retrying the original message
          // re-runs the handler against a stale caller. Send to DLQ instead so
          // the failure is visible without churning the queue.
          .mapErrorToResult((error: TechnicalError) =>
            Result.Error<void, HandlerError>(
              new NonRetryableError("Failed to publish RPC response", error),
            ),
          )
          .mapOkToResult((published) =>
            published
              ? Result.Ok<void, HandlerError>(undefined)
              : Result.Error<void, HandlerError>(
                  new NonRetryableError("Failed to publish RPC response: channel buffer full"),
                ),
          ),
      );
  }

  /**
   * Process a single consumed message: validate, invoke handler, optionally
   * publish the RPC response, record telemetry, and handle errors.
   */
  private processMessage(
    msg: ConsumeMessage,
    view: { consumer: ConsumerDefinition; isRpc: boolean; responseSchema?: StandardSchemaV1 },
    name: HandlerName<TContract>,
    handler: StoredHandler,
  ): Future<Result<void, TechnicalError>> {
    const { consumer, isRpc, responseSchema } = view;
    const queueName = extractQueue(consumer.queue).name;
    const startTime = Date.now();
    const span = startConsumeSpan(this.telemetry, queueName, String(name), {
      "messaging.rabbitmq.message.delivery_tag": msg.fields.deliveryTag,
    });

    let messageHandled = false;
    let firstError: Error | undefined;

    return this.parseAndValidateMessage(msg, consumer, name)
      .flatMap((parseResult) =>
        parseResult.match({
          Ok: (validatedMessage) =>
            handler(validatedMessage, msg)
              .flatMapOk((handlerResponse) => {
                if (isRpc && responseSchema) {
                  return this.publishRpcResponse(
                    msg,
                    queueName,
                    name,
                    responseSchema,
                    handlerResponse,
                  ).flatMapOk(() => {
                    this.logger?.info("Message consumed successfully", {
                      consumerName: String(name),
                      queueName,
                    });
                    this.amqpClient.ack(msg);
                    messageHandled = true;
                    return Future.value(Result.Ok<void, HandlerError>(undefined));
                  });
                }

                this.logger?.info("Message consumed successfully", {
                  consumerName: String(name),
                  queueName,
                });
                this.amqpClient.ack(msg);
                messageHandled = true;

                return Future.value(Result.Ok<void, HandlerError>(undefined));
              })
              .flatMapError((handlerError: HandlerError) => {
                this.logger?.error("Error processing message", {
                  consumerName: String(name),
                  queueName,
                  errorType: handlerError.name,
                  error: handlerError.message,
                });
                firstError = handlerError;

                return handleError(
                  { amqpClient: this.amqpClient, logger: this.logger },
                  handlerError,
                  msg,
                  String(name),
                  consumer,
                );
              }),
          // Parse / validation failure path: nack once with requeue=false so the
          // queue's DLX (if configured) receives the poison message. We bypass
          // handleError() because a malformed payload is deterministic — retrying
          // it would burn the queue's retry budget on a guaranteed failure.
          Error: (parseError) => {
            firstError = parseError;
            this.logger?.error("Failed to parse/validate message; sending to DLQ", {
              consumerName: String(name),
              queueName,
              error: parseError,
            });
            this.amqpClient.nack(msg, false, false);
            return Future.value(Result.Error<void, TechnicalError>(parseError));
          },
        }),
      )
      .map((result) => {
        const durationMs = Date.now() - startTime;
        if (messageHandled) {
          endSpanSuccess(span);
          recordConsumeMetric(this.telemetry, queueName, String(name), true, durationMs);
        } else {
          const error = result.isError()
            ? result.error
            : (firstError ?? new Error("Unknown error"));
          endSpanError(span, error);
          recordConsumeMetric(this.telemetry, queueName, String(name), false, durationMs);
        }
        return result;
      });
  }

  /**
   * Consume messages one at a time.
   */
  private consumeSingle(
    name: HandlerName<TContract>,
    view: { consumer: ConsumerDefinition; isRpc: boolean; responseSchema?: StandardSchemaV1 },
    handler: StoredHandler,
  ): Future<Result<void, TechnicalError>> {
    const queueName = extractQueue(view.consumer.queue).name;

    return this.amqpClient
      .consume(
        queueName,
        async (msg) => {
          if (msg === null) {
            this.logger?.warn("Consumer cancelled by server", {
              consumerName: String(name),
              queueName,
            });
            return;
          }
          // The dispatch path is built on `Future<Result<…>>` so handler
          // failures are values, not exceptions. Defensively guard the
          // boundary anyway: a handler that violates the contract by throwing
          // synchronously (or any unexpected fault inside processMessage)
          // would otherwise leave the message neither acked nor nacked, and
          // amqp-connection-manager would not redeliver it until the channel
          // closes. nack(requeue=false) routes it via DLX if configured.
          try {
            await this.processMessage(msg, view, name, handler).toPromise();
          } catch (error: unknown) {
            this.logger?.error("Uncaught error in consume callback; nacking message", {
              consumerName: String(name),
              queueName,
              error,
            });
            this.amqpClient.nack(msg, false, false);
          }
        },
        this.consumerOptions[name],
      )
      .tapOk((consumerTag) => {
        this.consumerTags.add(consumerTag);
      })
      .mapError(
        (error) => new TechnicalError(`Failed to start consuming for "${String(name)}"`, error),
      )
      .mapOk(() => undefined);
  }
}
