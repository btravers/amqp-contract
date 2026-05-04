import {
  extractQueue,
  type CompressionAlgorithm,
  type ContractDefinition,
  type InferPublisherNames,
  type InferRpcNames,
} from "@amqp-contract/contract";
import {
  AmqpClient,
  PublishOptions as AmqpClientPublishOptions,
  type Logger,
  MessagingSemanticConventions,
  TechnicalError,
  type TelemetryProvider,
  defaultTelemetryProvider,
  endSpanError,
  endSpanSuccess,
  recordLateRpcReply,
  recordPublishMetric,
  safeJsonParse,
  startPublishSpan,
} from "@amqp-contract/core";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { AmqpConnectionManagerOptions, ConnectionUrl } from "amqp-connection-manager";
import { err, errAsync, ok, okAsync, Result, ResultAsync } from "neverthrow";
import { randomUUID } from "node:crypto";
import { compressBuffer } from "./compression.js";
import { MessageValidationError, RpcCancelledError, RpcTimeoutError } from "./errors.js";
import type {
  ClientInferPublisherInput,
  ClientInferRpcRequestInput,
  ClientInferRpcResponseOutput,
} from "./types.js";

/**
 * The RabbitMQ direct-reply-to pseudo-queue. Publishing with `replyTo` set to
 * this value tells the server to deliver the response back to the consumer
 * subscribed on this queue on the same channel — no real queue is created and
 * no setup is required beyond consuming from it once with `noAck: true`.
 *
 * @see https://www.rabbitmq.com/docs/direct-reply-to
 */
const DIRECT_REPLY_TO = "amq.rabbitmq.reply-to";

/**
 * In-flight RPC call tracked by `TypedAmqpClient`. The reply consumer
 * looks up entries by `correlationId` when responses arrive.
 */
type PendingCall = {
  rpcName: string;
  responseSchema: StandardSchemaV1;
  resolve: (
    result: Result<
      unknown,
      TechnicalError | MessageValidationError | RpcTimeoutError | RpcCancelledError
    >,
  ) => void;
  timer: ReturnType<typeof setTimeout>;
};

/**
 * Publish options that extend amqp-client's PublishOptions with optional compression support.
 */
export type PublishOptions = AmqpClientPublishOptions & {
  /**
   * Optional compression algorithm to use for the message payload.
   * When specified, the message will be compressed using the chosen algorithm
   * and the contentEncoding header will be set automatically.
   */
  compression?: CompressionAlgorithm | undefined;
};

/**
 * Options for creating a client
 */
export type CreateClientOptions<TContract extends ContractDefinition> = {
  contract: TContract;
  urls: ConnectionUrl[];
  connectionOptions?: AmqpConnectionManagerOptions | undefined;
  logger?: Logger | undefined;
  /**
   * Optional telemetry provider for tracing and metrics.
   * If not provided, uses the default provider which attempts to load OpenTelemetry.
   * OpenTelemetry instrumentation is automatically enabled if @opentelemetry/api is installed.
   */
  telemetry?: TelemetryProvider | undefined;
  /**
   * Default publish options that will be applied to all publish operations.
   * These can be overridden by options passed to the publish method.
   * By default, persistent is set to true for message durability.
   */
  defaultPublishOptions?: PublishOptions | undefined;
  /**
   * Maximum time in ms to wait for the AMQP connection to become ready before
   * `create()` resolves to an `err(TechnicalError)`. Defaults to 30s
   * (the {@link AmqpClient}'s `DEFAULT_CONNECT_TIMEOUT_MS`). Pass `null` to
   * disable the timeout and let amqp-connection-manager retry indefinitely.
   */
  connectTimeoutMs?: number | null | undefined;
};

/**
 * Per-call options for `client.call()`.
 */
export type CallOptions = {
  /**
   * Maximum time in ms to wait for an RPC reply. If exceeded, the call resolves
   * to `err(RpcTimeoutError)` and the in-memory correlation entry is cleared.
   * A late reply arriving after the timeout is silently dropped.
   *
   * Required: RPC without a timeout is a footgun.
   */
  timeoutMs: number;

  /**
   * Optional AMQP message properties to merge into the request. `replyTo` and
   * `correlationId` are managed by the client and cannot be overridden.
   */
  publishOptions?: Omit<AmqpClientPublishOptions, "replyTo" | "correlationId">;
};

/**
 * Type-safe AMQP client for publishing messages
 */
export class TypedAmqpClient<TContract extends ContractDefinition> {
  /**
   * In-flight RPC calls keyed by `correlationId`. Cleared when a reply is
   * received, when the call times out, or when the client is closed.
   */
  private readonly pendingCalls = new Map<string, PendingCall>();

  /**
   * Consumer tag of the reply consumer subscribed on `amq.rabbitmq.reply-to`.
   * Set when the contract has at least one entry in `rpcs`; undefined otherwise.
   */
  private replyConsumerTag?: string;

  private constructor(
    private readonly contract: TContract,
    private readonly amqpClient: AmqpClient,
    private readonly defaultPublishOptions: PublishOptions,
    private readonly logger?: Logger,
    private readonly telemetry: TelemetryProvider = defaultTelemetryProvider,
  ) {}

  /**
   * Create a type-safe AMQP client from a contract.
   *
   * Connection management (including automatic reconnection) is handled internally
   * by amqp-connection-manager via the {@link AmqpClient}. The client establishes
   * infrastructure asynchronously in the background once the connection is ready.
   *
   * Connections are automatically shared across clients with the same URLs and
   * connection options, following RabbitMQ best practices.
   */
  static create<TContract extends ContractDefinition>({
    contract,
    urls,
    connectionOptions,
    defaultPublishOptions,
    logger,
    telemetry,
    connectTimeoutMs,
  }: CreateClientOptions<TContract>): ResultAsync<TypedAmqpClient<TContract>, TechnicalError> {
    const client = new TypedAmqpClient(
      contract,
      new AmqpClient(contract, { urls, connectionOptions, connectTimeoutMs }),
      { persistent: true, ...defaultPublishOptions },
      logger,
      telemetry ?? defaultTelemetryProvider,
    );

    const setup = client
      .waitForConnectionReady()
      .andThen(() => client.setupReplyConsumerIfNeeded());

    return new ResultAsync<TypedAmqpClient<TContract>, TechnicalError>(
      (async () => {
        const setupResult = await setup;
        if (setupResult.isOk()) {
          return ok(client);
        }
        const closeResult = await client.close();
        if (closeResult.isErr()) {
          logger?.warn("Failed to close client after connection failure", {
            error: closeResult.error,
          });
        }
        return err(setupResult.error);
      })(),
    );
  }

  /**
   * If the contract has any RPC entry, subscribe to `amq.rabbitmq.reply-to`
   * once. Replies for every in-flight call arrive on this single consumer and
   * are demultiplexed by `correlationId`.
   */
  private setupReplyConsumerIfNeeded(): ResultAsync<void, TechnicalError> {
    const rpcs = this.contract.rpcs ?? {};
    if (Object.keys(rpcs).length === 0) {
      return okAsync(undefined);
    }

    return this.amqpClient
      .consume(DIRECT_REPLY_TO, (msg) => this.handleRpcReply(msg), { noAck: true })
      .andTee((tag) => {
        this.replyConsumerTag = tag;
      })
      .map(() => undefined);
  }

  /**
   * Demultiplex an RPC reply by `correlationId`, validate the body against the
   * call's response schema, and resolve the awaiting caller. Replies with no
   * matching pending call (the call already timed out, was cancelled, or the
   * correlationId is unknown) are logged at warn — a non-zero rate of these
   * usually indicates a tuning problem (handler latency exceeds caller
   * timeout). The `messaging.rpc.late_reply` counter lets dashboards alert on
   * sustained drift without parsing logs.
   */
  private handleRpcReply(msg: Parameters<Parameters<AmqpClient["consume"]>[1]>[0]): void {
    if (!msg) return;
    const correlationId = msg.properties.correlationId;
    if (typeof correlationId !== "string") {
      this.logger?.warn("Received RPC reply without correlationId; dropping", {
        deliveryTag: msg.fields.deliveryTag,
      });
      recordLateRpcReply(this.telemetry, "missing-correlation-id");
      return;
    }
    const pending = this.pendingCalls.get(correlationId);
    if (!pending) {
      this.logger?.warn(
        "Received RPC reply for unknown correlationId (caller already timed out or cancelled)",
        { correlationId },
      );
      recordLateRpcReply(this.telemetry, "unknown-correlation-id");
      return;
    }
    this.pendingCalls.delete(correlationId);
    clearTimeout(pending.timer);

    const parseResult = safeJsonParse(
      msg.content,
      (error) =>
        new TechnicalError(`Failed to parse RPC reply JSON for "${pending.rpcName}"`, error),
    );
    if (parseResult.isErr()) {
      pending.resolve(err(parseResult.error));
      return;
    }
    const parsed = parseResult.value;

    // Wrap the validate call itself — a Standard Schema implementation may
    // throw synchronously, and the throw would otherwise escape the consume
    // callback and could crash the reply consumer.
    let rawValidation: ReturnType<StandardSchemaV1["~standard"]["validate"]>;
    try {
      rawValidation = pending.responseSchema["~standard"].validate(parsed);
    } catch (error: unknown) {
      pending.resolve(
        err(new TechnicalError(`RPC reply validation threw for "${pending.rpcName}"`, error)),
      );
      return;
    }
    const validationPromise =
      rawValidation instanceof Promise ? rawValidation : Promise.resolve(rawValidation);

    validationPromise.then(
      (validation) => {
        if (validation.issues) {
          pending.resolve(err(new MessageValidationError(pending.rpcName, validation.issues)));
          return;
        }
        pending.resolve(ok(validation.value));
      },
      (error: unknown) => {
        pending.resolve(
          err(new TechnicalError(`RPC reply validation threw for "${pending.rpcName}"`, error)),
        );
      },
    );
  }

  /**
   * Publish a message using a defined publisher.
   *
   * @param publisherName - The name of the publisher to use
   * @param message - The message to publish
   * @param options - Optional publish options including compression, headers, priority, etc.
   *
   * @remarks
   * If `options.compression` is specified, the message will be compressed before publishing
   * and the `contentEncoding` property will be set automatically. Any `contentEncoding`
   * value already in options will be overwritten by the compression algorithm.
   */
  publish<TName extends InferPublisherNames<TContract>>(
    publisherName: TName,
    message: ClientInferPublisherInput<TContract, TName>,
    options?: PublishOptions,
  ): ResultAsync<void, TechnicalError | MessageValidationError> {
    const startTime = Date.now();
    // Non-null assertions safe: TypeScript guarantees these exist for valid TName
    const publisher = this.contract.publishers![publisherName as string]!;
    const { exchange, routingKey } = publisher;

    // Start telemetry span
    const span = startPublishSpan(this.telemetry, exchange.name, routingKey, {
      [MessagingSemanticConventions.AMQP_PUBLISHER_NAME]: String(publisherName),
    });

    const validateMessage = (): ResultAsync<unknown, TechnicalError | MessageValidationError> => {
      const validationResult = publisher.message.payload["~standard"].validate(message);
      const promise =
        validationResult instanceof Promise ? validationResult : Promise.resolve(validationResult);
      return ResultAsync.fromPromise(
        promise,
        (error): TechnicalError | MessageValidationError =>
          new TechnicalError("Validation failed", error),
      ).andThen((validation) => {
        if (validation.issues) {
          return err<unknown, TechnicalError | MessageValidationError>(
            new MessageValidationError(String(publisherName), validation.issues),
          );
        }
        return ok<unknown, TechnicalError | MessageValidationError>(validation.value);
      });
    };

    const publishMessage = (validatedMessage: unknown): ResultAsync<void, TechnicalError> => {
      // Merge default options with provided options
      const mergedOptions = { ...this.defaultPublishOptions, ...options };

      // Extract compression from merged options and create publish options without it
      const { compression, ...restOptions } = mergedOptions;
      const publishOptions: AmqpClientPublishOptions = { ...restOptions };

      // Prepare payload and options based on compression configuration
      const preparePayload = (): ResultAsync<Buffer | unknown, TechnicalError> => {
        if (compression) {
          // Compress the message payload
          const messageBuffer = Buffer.from(JSON.stringify(validatedMessage));
          publishOptions.contentEncoding = compression;
          return compressBuffer(messageBuffer, compression);
        }

        // No compression: use the channel's built-in JSON serialization
        return okAsync(validatedMessage);
      };

      return preparePayload().andThen((payload) =>
        this.amqpClient
          .publish(publisher.exchange.name, publisher.routingKey ?? "", payload, publishOptions)
          .andThen((published) => {
            if (!published) {
              return err<void, TechnicalError>(
                new TechnicalError(
                  `Failed to publish message for publisher "${String(publisherName)}": Channel rejected the message (buffer full or other channel issue)`,
                ),
              );
            }

            this.logger?.info("Message published successfully", {
              publisherName: String(publisherName),
              exchange: publisher.exchange.name,
              routingKey: publisher.routingKey,
              compressed: !!compression,
            });

            return ok<void, TechnicalError>(undefined);
          }),
      );
    };

    return validateMessage()
      .andThen((validatedMessage) => publishMessage(validatedMessage))
      .andTee(() => {
        const durationMs = Date.now() - startTime;
        endSpanSuccess(span);
        recordPublishMetric(this.telemetry, exchange.name, routingKey, true, durationMs);
      })
      .orTee((error) => {
        const durationMs = Date.now() - startTime;
        endSpanError(span, error);
        recordPublishMetric(this.telemetry, exchange.name, routingKey, false, durationMs);
      });
  }

  /**
   * Invoke an RPC defined via `defineRpc` and await the typed response.
   *
   * The request payload is validated against the RPC's request schema, then
   * published to the AMQP default exchange with the server's queue name as
   * routing key, `replyTo` set to `amq.rabbitmq.reply-to`, and a fresh UUID
   * `correlationId`. The returned ResultAsync resolves once a matching reply
   * arrives and validates against the response schema, or once `timeoutMs`
   * elapses (whichever comes first).
   *
   * @example
   * ```typescript
   * const result = await client.call('calculate', { a: 1, b: 2 }, { timeoutMs: 5_000 });
   * if (result.isOk()) console.log(result.value.sum); // 3
   * ```
   */
  call<TName extends InferRpcNames<TContract>>(
    rpcName: TName,
    request: ClientInferRpcRequestInput<TContract, TName>,
    options: CallOptions,
  ): ResultAsync<
    ClientInferRpcResponseOutput<TContract, TName>,
    TechnicalError | MessageValidationError | RpcTimeoutError | RpcCancelledError
  > {
    type ResponseType = ClientInferRpcResponseOutput<TContract, TName>;
    type CallError = TechnicalError | MessageValidationError | RpcTimeoutError | RpcCancelledError;
    type CallResult = Result<ResponseType, CallError>;

    // setTimeout truncates fractional ms and clamps anything outside the
    // 32-bit signed integer range (~24.8 days) to 1ms, so reject those up
    // front as user errors rather than producing surprising behavior.
    const TIMEOUT_MAX_MS = 2_147_483_647;
    if (
      typeof options.timeoutMs !== "number" ||
      !Number.isFinite(options.timeoutMs) ||
      options.timeoutMs <= 0 ||
      options.timeoutMs > TIMEOUT_MAX_MS
    ) {
      return errAsync<ResponseType, CallError>(
        new TechnicalError(
          `Invalid timeoutMs for RPC call to "${String(rpcName)}": expected a finite positive number ≤ ${TIMEOUT_MAX_MS}, got ${String(options.timeoutMs)}`,
        ),
      );
    }

    const startTime = Date.now();
    // Non-null assertion safe: TName is constrained to RPC names in the contract.
    const rpc = this.contract.rpcs![rpcName as string]!;
    const requestSchema = rpc.request.payload;
    const responseSchema = rpc.response.payload;
    const queueName = extractQueue(rpc.queue).name;

    // RPC publishes to the default exchange with the queue name as routing key.
    const span = startPublishSpan(this.telemetry, "", queueName, {
      [MessagingSemanticConventions.AMQP_PUBLISHER_NAME]: String(rpcName),
    });

    const correlationId = randomUUID();

    // Set up the reply future + pending entry up front so a reply that arrives
    // racing the publish round-trip can find a slot. Cleanup on preflight
    // failure happens in the `.orElse` below.
    let resolveCall!: (result: CallResult) => void;
    const callPromise = new Promise<CallResult>((res) => {
      resolveCall = res;
    });
    const callResultAsync = new ResultAsync<ResponseType, CallError>(callPromise);

    const timer = setTimeout(() => {
      if (!this.pendingCalls.has(correlationId)) return;
      this.pendingCalls.delete(correlationId);
      resolveCall(err(new RpcTimeoutError(String(rpcName), options.timeoutMs)));
    }, options.timeoutMs);

    this.pendingCalls.set(correlationId, {
      rpcName: String(rpcName),
      responseSchema,
      resolve: resolveCall as PendingCall["resolve"],
      timer,
    });

    const validateRequest = (): ResultAsync<unknown, TechnicalError | MessageValidationError> => {
      // Wrap the validate call — a Standard Schema implementation may throw
      // synchronously, and that throw would otherwise escape the chain and
      // leave the pending-call entry/timer dangling until timeout.
      let rawValidation: ReturnType<StandardSchemaV1["~standard"]["validate"]>;
      try {
        rawValidation = requestSchema["~standard"].validate(request);
      } catch (error: unknown) {
        return errAsync<unknown, TechnicalError | MessageValidationError>(
          new TechnicalError("RPC request validation threw", error),
        );
      }
      const validationPromise =
        rawValidation instanceof Promise ? rawValidation : Promise.resolve(rawValidation);
      return ResultAsync.fromPromise(
        validationPromise,
        (error): TechnicalError | MessageValidationError =>
          new TechnicalError("RPC request validation threw", error),
      ).andThen((validation) =>
        validation.issues
          ? err<unknown, TechnicalError | MessageValidationError>(
              new MessageValidationError(String(rpcName), validation.issues),
            )
          : ok<unknown, TechnicalError | MessageValidationError>(validation.value),
      );
    };

    const publishRequest = (validatedRequest: unknown): ResultAsync<void, TechnicalError> => {
      // Merge `defaultPublishOptions` (persistent, priority, headers, …) with
      // the per-call options, then layer the RPC-managed fields on top so they
      // cannot be overridden. `compression` is intentionally dropped: RPC v1
      // does not implement reply-side decompression, so request-side
      // compression would break the round-trip.
      const { compression: _ignoredCompression, ...defaultsWithoutCompression } =
        this.defaultPublishOptions;
      const publishOptions: AmqpClientPublishOptions = {
        ...defaultsWithoutCompression,
        ...options.publishOptions,
        replyTo: DIRECT_REPLY_TO,
        correlationId,
        contentType: "application/json",
      };
      return this.amqpClient
        .publish("", queueName, validatedRequest, publishOptions)
        .andThen((published) =>
          published
            ? ok<void, TechnicalError>(undefined)
            : err<void, TechnicalError>(
                new TechnicalError(
                  `Failed to publish RPC request for "${String(rpcName)}": channel buffer full`,
                ),
              ),
        );
    };

    return validateRequest()
      .andThen((validated) => publishRequest(validated))
      .andThen(() => callResultAsync)
      .orElse((error: CallError) => {
        // If preflight failed (validate or publish), the pending entry still
        // exists and the timer is alive. Clean both up so the call doesn't
        // leak. Timer-fired errors and reply-resolved errors have already
        // cleaned the entry, so the .has() check guards against double cleanup.
        if (this.pendingCalls.has(correlationId)) {
          clearTimeout(timer);
          this.pendingCalls.delete(correlationId);
        }
        return errAsync<ResponseType, CallError>(error);
      })
      .andTee(() => {
        const durationMs = Date.now() - startTime;
        endSpanSuccess(span);
        recordPublishMetric(this.telemetry, "", queueName, true, durationMs);
      })
      .orTee((error) => {
        const durationMs = Date.now() - startTime;
        endSpanError(span, error);
        recordPublishMetric(this.telemetry, "", queueName, false, durationMs);
      });
  }

  /**
   * Close the channel and connection. Cancels the reply consumer (if any) and
   * rejects every in-flight RPC call with `RpcCancelledError`.
   */
  close(): ResultAsync<void, TechnicalError> {
    // Reject pending calls first — once close() runs, no reply will arrive.
    for (const [, pending] of this.pendingCalls) {
      clearTimeout(pending.timer);
      pending.resolve(err(new RpcCancelledError(pending.rpcName)));
    }
    this.pendingCalls.clear();

    const cancelReply: ResultAsync<void, TechnicalError> = this.replyConsumerTag
      ? this.amqpClient.cancel(this.replyConsumerTag).orElse((error) => {
          this.logger?.warn("Failed to cancel RPC reply consumer during close", { error });
          return ok<void, TechnicalError>(undefined);
        })
      : okAsync<void, TechnicalError>(undefined);

    return cancelReply.andThen(() => this.amqpClient.close());
  }

  private waitForConnectionReady(): ResultAsync<void, TechnicalError> {
    return this.amqpClient.waitForConnect();
  }
}
