import type {
  CompressionAlgorithm,
  ContractDefinition,
  InferPublisherNames,
  PublisherDefinition,
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
  recordPublishMetric,
  startPublishSpan,
} from "@amqp-contract/core";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { Future, Result } from "@swan-io/boxed";
import type { AmqpConnectionManagerOptions, ConnectionUrl } from "amqp-connection-manager";
import { randomUUID } from "node:crypto";
import { compressBuffer } from "./compression.js";
import { MessageValidationError, RpcCancelledError, RpcTimeoutError } from "./errors.js";
import type {
  ClientInferPublisherInput,
  ClientInferRpcPublisherNames,
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
  publisherName: string;
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
   * `create()` resolves to `Result.Error<TechnicalError>`. Without this option,
   * `create()` waits forever — the underlying amqp-connection-manager retries
   * indefinitely.
   */
  connectTimeoutMs?: number | undefined;
};

/**
 * Per-call options for `client.call()`.
 */
export type CallOptions = {
  /**
   * Maximum time in ms to wait for an RPC reply. If exceeded, the call resolves
   * to `Result.Error<RpcTimeoutError>` and the in-memory correlation entry is
   * cleared. A late reply arriving after the timeout is silently dropped.
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
   * Set when the contract has at least one RPC publisher; undefined otherwise.
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
  }: CreateClientOptions<TContract>): Future<Result<TypedAmqpClient<TContract>, TechnicalError>> {
    const client = new TypedAmqpClient(
      contract,
      new AmqpClient(contract, { urls, connectionOptions, connectTimeoutMs }),
      { persistent: true, ...defaultPublishOptions },
      logger,
      telemetry ?? defaultTelemetryProvider,
    );

    return client
      .waitForConnectionReady()
      .flatMapOk(() => client.setupReplyConsumerIfNeeded())
      .flatMap((result) =>
        result.match({
          Ok: () => Future.value(Result.Ok<TypedAmqpClient<TContract>, TechnicalError>(client)),
          // Release the AmqpClient's connection ref-count so a failed create() does not leak.
          Error: (error) =>
            client
              .close()
              .tapError((closeError) => {
                logger?.warn("Failed to close client after connection failure", {
                  error: closeError,
                });
              })
              .map(() => Result.Error<TypedAmqpClient<TContract>, TechnicalError>(error)),
        }),
      );
  }

  /**
   * If the contract has any RPC publisher (one with `responseMessage`), subscribe
   * to `amq.rabbitmq.reply-to` once. Replies for every in-flight call arrive on
   * this single consumer and are demultiplexed by `correlationId`.
   *
   * @returns `Result.Ok` on success or no-op (no RPC publishers); `Result.Error`
   *   if the consume call fails.
   */
  private setupReplyConsumerIfNeeded(): Future<Result<void, TechnicalError>> {
    const publishers = this.contract.publishers ?? {};
    const hasRpcPublisher = Object.values(publishers).some(
      (p): p is PublisherDefinition => "responseMessage" in p && p.responseMessage !== undefined,
    );
    if (!hasRpcPublisher) {
      return Future.value(Result.Ok(undefined));
    }

    return this.amqpClient
      .consume(DIRECT_REPLY_TO, (msg) => this.handleRpcReply(msg), { noAck: true })
      .tapOk((tag) => {
        this.replyConsumerTag = tag;
      })
      .mapOk(() => undefined);
  }

  /**
   * Demultiplex an RPC reply by `correlationId`, validate the body against the
   * call's response schema, and resolve the awaiting caller. Replies with no
   * matching pending call (e.g. arriving after the call timed out) are dropped
   * with a debug log.
   */
  private handleRpcReply(msg: Parameters<Parameters<AmqpClient["consume"]>[1]>[0]): void {
    if (!msg) return;
    const correlationId = msg.properties.correlationId;
    if (typeof correlationId !== "string") {
      this.logger?.warn("Received RPC reply without correlationId; dropping", {
        deliveryTag: msg.fields.deliveryTag,
      });
      return;
    }
    const pending = this.pendingCalls.get(correlationId);
    if (!pending) {
      this.logger?.debug("Received RPC reply for unknown correlationId", { correlationId });
      return;
    }
    this.pendingCalls.delete(correlationId);
    clearTimeout(pending.timer);

    let parsed: unknown;
    try {
      parsed = JSON.parse(msg.content.toString());
    } catch (error: unknown) {
      pending.resolve(
        Result.Error(
          new TechnicalError(
            `Failed to parse RPC reply JSON for "${pending.publisherName}"`,
            error,
          ),
        ),
      );
      return;
    }

    const rawValidation = pending.responseSchema["~standard"].validate(parsed);
    const validationPromise =
      rawValidation instanceof Promise ? rawValidation : Promise.resolve(rawValidation);

    validationPromise.then(
      (validation) => {
        if (validation.issues) {
          pending.resolve(
            Result.Error(new MessageValidationError(pending.publisherName, validation.issues)),
          );
          return;
        }
        pending.resolve(Result.Ok(validation.value));
      },
      (error: unknown) => {
        pending.resolve(
          Result.Error(
            new TechnicalError(`RPC reply validation threw for "${pending.publisherName}"`, error),
          ),
        );
      },
    );
  }

  /**
   * Publish a message using a defined publisher
   *
   * @param publisherName - The name of the publisher to use
   * @param message - The message to publish
   * @param options - Optional publish options including compression, headers, priority, etc.
   *
   * @remarks
   * If `options.compression` is specified, the message will be compressed before publishing
   * and the `contentEncoding` property will be set automatically. Any `contentEncoding`
   * value already in options will be overwritten by the compression algorithm.
   *
   * @returns Result.Ok(void) on success, or Result.Error with specific error on failure
   */
  /**
   * Publish a message using a defined publisher.
   * TypeScript guarantees publisher exists for valid publisher names.
   */
  publish<TName extends InferPublisherNames<TContract>>(
    publisherName: TName,
    message: ClientInferPublisherInput<TContract, TName>,
    options?: PublishOptions,
  ): Future<Result<void, TechnicalError | MessageValidationError>> {
    const startTime = Date.now();
    // Non-null assertions safe: TypeScript guarantees these exist for valid TName
    const publisher = this.contract.publishers![publisherName as string]!;
    const { exchange, routingKey } = publisher;

    // Start telemetry span
    const span = startPublishSpan(this.telemetry, exchange.name, routingKey, {
      [MessagingSemanticConventions.AMQP_PUBLISHER_NAME]: String(publisherName),
    });

    const validateMessage = () => {
      const validationResult = publisher.message.payload["~standard"].validate(message);
      return Future.fromPromise(
        validationResult instanceof Promise ? validationResult : Promise.resolve(validationResult),
      )
        .mapError((error) => new TechnicalError(`Validation failed`, error))
        .mapOkToResult((validation) => {
          if (validation.issues) {
            return Result.Error(
              new MessageValidationError(String(publisherName), validation.issues),
            );
          }

          return Result.Ok(validation.value);
        });
    };

    const publishMessage = (validatedMessage: unknown): Future<Result<void, TechnicalError>> => {
      // Merge default options with provided options
      const mergedOptions = { ...this.defaultPublishOptions, ...options };

      // Extract compression from merged options and create publish options without it
      const { compression, ...restOptions } = mergedOptions;
      const publishOptions: AmqpClientPublishOptions = { ...restOptions };

      // Prepare payload and options based on compression configuration
      const preparePayload = (): Future<Result<Buffer | unknown, TechnicalError>> => {
        if (compression) {
          // Compress the message payload
          const messageBuffer = Buffer.from(JSON.stringify(validatedMessage));
          publishOptions.contentEncoding = compression;

          return compressBuffer(messageBuffer, compression);
        }

        // No compression: use the channel's built-in JSON serialization
        return Future.value(Result.Ok(validatedMessage));
      };

      // Publish the prepared payload
      return preparePayload().flatMapOk((payload) =>
        this.amqpClient
          .publish(publisher.exchange.name, publisher.routingKey ?? "", payload, publishOptions)
          .mapOkToResult((published) => {
            if (!published) {
              return Result.Error(
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

            return Result.Ok(undefined);
          }),
      );
    };

    // Validate message using schema
    return validateMessage()
      .flatMapOk((validatedMessage) => publishMessage(validatedMessage))
      .tapOk(() => {
        const durationMs = Date.now() - startTime;
        endSpanSuccess(span);
        recordPublishMetric(this.telemetry, exchange.name, routingKey, true, durationMs);
      })
      .tapError((error) => {
        const durationMs = Date.now() - startTime;
        endSpanError(span, error);
        recordPublishMetric(this.telemetry, exchange.name, routingKey, false, durationMs);
      });
  }

  /**
   * Invoke an RPC server defined via `defineRpcClient` / `defineRpcServer` and
   * await the typed response.
   *
   * The request payload is validated against the publisher's request schema,
   * then published to the AMQP default exchange with the server's queue name as
   * routing key, `replyTo` set to `amq.rabbitmq.reply-to`, and a fresh UUID
   * `correlationId`. The returned Future resolves once a matching reply arrives
   * and validates against the response schema, or once `timeoutMs` elapses
   * (whichever comes first).
   *
   * @typeParam TName - Names of publishers that are RPC clients (those whose
   *   definition carries a `responseMessage`).
   * @param publisherName - The RPC publisher name from the contract.
   * @param request - The request payload, validated against the request schema.
   * @param options - Per-call options. `timeoutMs` is required.
   *
   * @returns `Result.Ok(response)` on a successful round-trip; `Result.Error`
   *   on validation, transport, timeout, or cancel.
   *
   * @example
   * ```typescript
   * const result = await client
   *   .call('calculate', { a: 1, b: 2 }, { timeoutMs: 5_000 })
   *   .toPromise();
   * if (result.isOk()) console.log(result.value.sum); // 3
   * ```
   */
  call<TName extends ClientInferRpcPublisherNames<TContract>>(
    publisherName: TName,
    request: ClientInferPublisherInput<TContract, TName>,
    options: CallOptions,
  ): Future<
    Result<
      ClientInferRpcResponseOutput<TContract, TName>,
      TechnicalError | MessageValidationError | RpcTimeoutError | RpcCancelledError
    >
  > {
    type CallResult = Result<
      ClientInferRpcResponseOutput<TContract, TName>,
      TechnicalError | MessageValidationError | RpcTimeoutError | RpcCancelledError
    >;

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
      return Future.value(
        Result.Error(
          new TechnicalError(
            `Invalid timeoutMs for RPC call to "${String(publisherName)}": expected a finite positive number ≤ ${TIMEOUT_MAX_MS}, got ${String(options.timeoutMs)}`,
          ),
        ) as CallResult,
      );
    }

    const startTime = Date.now();
    // Non-null assertion safe: TName is constrained to RPC publishers in the contract.
    const publisher = this.contract.publishers![publisherName as string]!;
    const responseSchema = publisher.responseMessage?.payload;
    if (!responseSchema) {
      // Should be unreachable because the type guard filters non-RPC names, but
      // defend against runtime contracts mismatched at JS layer.
      return Future.value(
        Result.Error(
          new TechnicalError(
            `Publisher "${String(publisherName)}" is not an RPC publisher (no responseMessage)`,
          ),
        ) as CallResult,
      );
    }

    const span = startPublishSpan(this.telemetry, publisher.exchange.name, publisher.routingKey, {
      [MessagingSemanticConventions.AMQP_PUBLISHER_NAME]: String(publisherName),
    });

    const correlationId = randomUUID();
    const callFuture = Future.make<CallResult>((resolve) => {
      const timer = setTimeout(() => {
        const pending = this.pendingCalls.get(correlationId);
        if (!pending) return;
        this.pendingCalls.delete(correlationId);
        resolve(Result.Error(new RpcTimeoutError(String(publisherName), options.timeoutMs)));
      }, options.timeoutMs);

      this.pendingCalls.set(correlationId, {
        publisherName: String(publisherName),
        responseSchema,
        resolve: resolve as PendingCall["resolve"],
        timer,
      });
    });

    const validateRequest = (): Future<
      Result<unknown, TechnicalError | MessageValidationError>
    > => {
      const rawValidation = publisher.message.payload["~standard"].validate(request);
      const validationPromise =
        rawValidation instanceof Promise ? rawValidation : Promise.resolve(rawValidation);
      return Future.fromPromise(validationPromise)
        .mapError((error) => new TechnicalError("RPC request validation threw", error))
        .mapOkToResult((validation) =>
          validation.issues
            ? Result.Error<unknown, TechnicalError | MessageValidationError>(
                new MessageValidationError(String(publisherName), validation.issues),
              )
            : Result.Ok<unknown, TechnicalError | MessageValidationError>(validation.value),
        );
    };

    const publishRequest = (validatedRequest: unknown): Future<Result<void, TechnicalError>> => {
      // Merge `defaultPublishOptions` (e.g. persistent, priority, headers) with
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
        .publish(
          publisher.exchange.name,
          publisher.routingKey ?? "",
          validatedRequest,
          publishOptions,
        )
        .mapOkToResult((published) =>
          published
            ? Result.Ok<void, TechnicalError>(undefined)
            : Result.Error<void, TechnicalError>(
                new TechnicalError(
                  `Failed to publish RPC request for "${String(publisherName)}": channel buffer full`,
                ),
              ),
        );
    };

    // Validate the request, publish it, and await the reply (or timeout).
    return validateRequest()
      .flatMapOk((validated) => publishRequest(validated))
      .flatMap((preflight) => {
        if (preflight.isError()) {
          // Publish/validation failed before the request hit the broker — clean
          // up the pending entry so the timer never fires.
          const pending = this.pendingCalls.get(correlationId);
          if (pending) {
            clearTimeout(pending.timer);
            this.pendingCalls.delete(correlationId);
          }
          return Future.value(Result.Error(preflight.error) as CallResult);
        }
        return callFuture;
      })
      .tapOk(() => {
        const durationMs = Date.now() - startTime;
        endSpanSuccess(span);
        recordPublishMetric(
          this.telemetry,
          publisher.exchange.name,
          publisher.routingKey,
          true,
          durationMs,
        );
      })
      .tapError((error) => {
        const durationMs = Date.now() - startTime;
        endSpanError(span, error);
        recordPublishMetric(
          this.telemetry,
          publisher.exchange.name,
          publisher.routingKey,
          false,
          durationMs,
        );
      });
  }

  /**
   * Close the channel and connection. Cancels the reply consumer (if any) and
   * rejects every in-flight RPC call with `RpcCancelledError`.
   */
  close(): Future<Result<void, TechnicalError>> {
    // Reject pending calls first — once close() runs, no reply will arrive.
    for (const [, pending] of this.pendingCalls) {
      clearTimeout(pending.timer);
      pending.resolve(Result.Error(new RpcCancelledError(pending.publisherName)));
    }
    this.pendingCalls.clear();

    const cancelReply = this.replyConsumerTag
      ? this.amqpClient.cancel(this.replyConsumerTag).tapError((error) => {
          this.logger?.warn("Failed to cancel RPC reply consumer during close", { error });
        })
      : Future.value(Result.Ok<void, TechnicalError>(undefined));

    return cancelReply.flatMap(() => this.amqpClient.close()).mapOk(() => undefined);
  }

  private waitForConnectionReady(): Future<Result<void, TechnicalError>> {
    return this.amqpClient.waitForConnect();
  }
}
