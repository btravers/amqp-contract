import { AmqpClient, type Logger } from "@amqp-contract/core";
import type { AmqpConnectionManagerOptions, ConnectionUrl } from "amqp-connection-manager";
import type { ContractDefinition, InferPublisherNames } from "@amqp-contract/contract";
import { Future, Result } from "@swan-io/boxed";
import { MessageValidationError, TechnicalError } from "./errors.js";
import type { ClientInferPublisherInput } from "./types.js";
import type { Options } from "amqplib";
import type { Span } from "@opentelemetry/api";

// Import OpenTelemetry types conditionally
type ClientInstrumentation = {
  startPublishSpan: (
    publisherName: string,
    exchangeName: string,
    routingKey: string,
    exchangeType?: string,
  ) => Span | undefined;
  injectTraceContext: (options?: Record<string, unknown>) => Record<string, unknown>;
  recordValidationError: (span: Span | undefined, error: unknown) => void;
  recordTechnicalError: (span: Span | undefined, error: unknown) => void;
  recordSuccess: (span: Span | undefined) => void;
  endSpan: (span: Span | undefined) => void;
};

type ClientMetrics = {
  recordPublish: (publisherName: string, exchangeName: string, durationMs: number) => void;
  recordValidationError: (publisherName: string, exchangeName: string) => void;
  recordPublishError: (publisherName: string, exchangeName: string) => void;
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
   * Optional OpenTelemetry instrumentation for tracing
   * Requires @amqp-contract/opentelemetry package
   */
  instrumentation?: ClientInstrumentation | undefined;
  /**
   * Optional OpenTelemetry metrics for monitoring
   * Requires @amqp-contract/opentelemetry package
   */
  metrics?: ClientMetrics | undefined;
};

/**
 * Type-safe AMQP client for publishing messages
 */
export class TypedAmqpClient<TContract extends ContractDefinition> {
  private constructor(
    private readonly contract: TContract,
    private readonly amqpClient: AmqpClient,
    private readonly logger?: Logger,
    private readonly instrumentation?: ClientInstrumentation,
    private readonly metrics?: ClientMetrics,
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
    logger,
    instrumentation,
    metrics,
  }: CreateClientOptions<TContract>): Future<Result<TypedAmqpClient<TContract>, TechnicalError>> {
    const client = new TypedAmqpClient(
      contract,
      new AmqpClient(contract, { urls, connectionOptions }),
      logger,
      instrumentation,
      metrics,
    );

    return client.waitForConnectionReady().mapOk(() => client);
  }

  /**
   * Publish a message using a defined publisher
   * Returns Result.Ok(true) on success, or Result.Error with specific error on failure
   */
  publish<TName extends InferPublisherNames<TContract>>(
    publisherName: TName,
    message: ClientInferPublisherInput<TContract, TName>,
    options?: Options.Publish,
  ): Future<Result<void, TechnicalError | MessageValidationError>> {
    const publishers = this.contract.publishers;
    if (!publishers) {
      return Future.value(Result.Error(new TechnicalError("No publishers defined in contract")));
    }

    const publisher = publishers[publisherName as string];
    if (!publisher) {
      return Future.value(
        Result.Error(
          new TechnicalError(`Publisher "${String(publisherName)}" not found in contract`),
        ),
      );
    }

    // Start span if instrumentation is enabled
    const startTime = Date.now();
    const span = this.instrumentation?.startPublishSpan(
      String(publisherName),
      publisher.exchange.name,
      publisher.routingKey ?? "",
      publisher.exchange.type,
    );

    const validateMessage = () => {
      const validationResult = publisher.message.payload["~standard"].validate(message);
      return Future.fromPromise(
        validationResult instanceof Promise ? validationResult : Promise.resolve(validationResult),
      )
        .mapError((error) => new TechnicalError(`Validation failed`, error))
        .mapOkToResult((validation) => {
          if (validation.issues) {
            const validationError = new MessageValidationError(
              String(publisherName),
              validation.issues,
            );
            // Record validation error in instrumentation
            this.instrumentation?.recordValidationError(span, validationError);
            this.metrics?.recordValidationError(String(publisherName), publisher.exchange.name);
            return Result.Error(validationError);
          }

          return Result.Ok(validation.value);
        });
    };

    const publishMessage = (validatedMessage: unknown): Future<Result<void, TechnicalError>> => {
      // Inject trace context into publish options
      const publishOptions: Options.Publish = this.instrumentation
        ? (this.instrumentation.injectTraceContext(
            options as Record<string, unknown> | undefined,
          ) as Options.Publish)
        : (options ?? {});

      return Future.fromPromise(
        this.amqpClient.channel.publish(
          publisher.exchange.name,
          publisher.routingKey ?? "",
          validatedMessage,
          publishOptions,
        ),
      )
        .mapError((error) => {
          const technicalError = new TechnicalError(`Failed to publish message`, error);
          // Record technical error in instrumentation
          this.instrumentation?.recordTechnicalError(span, technicalError);
          this.metrics?.recordPublishError(String(publisherName), publisher.exchange.name);
          return technicalError;
        })
        .mapOkToResult((published) => {
          if (!published) {
            const technicalError = new TechnicalError(
              `Failed to publish message for publisher "${String(publisherName)}": Channel rejected the message (buffer full or other channel issue)`,
            );
            // Record technical error in instrumentation
            this.instrumentation?.recordTechnicalError(span, technicalError);
            this.metrics?.recordPublishError(String(publisherName), publisher.exchange.name);
            return Result.Error(technicalError);
          }

          this.logger?.info("Message published successfully", {
            publisherName: String(publisherName),
            exchange: publisher.exchange.name,
            routingKey: publisher.routingKey,
          });

          // Record success in instrumentation
          const duration = Date.now() - startTime;
          this.instrumentation?.recordSuccess(span);
          this.metrics?.recordPublish(String(publisherName), publisher.exchange.name, duration);

          return Result.Ok(undefined);
        });
    };

    // Validate message using schema, then publish, then end span
    return validateMessage()
      .flatMapOk((validatedMessage) => publishMessage(validatedMessage))
      .tap((result) => {
        // Set span status based on result
        if (result.isError()) {
          // Span is already marked as error in validation/technical error handlers
          // Just end it here
          this.instrumentation?.endSpan(span);
        } else {
          this.instrumentation?.endSpan(span);
        }
      });
  }

  /**
   * Close the channel and connection
   */
  close(): Future<Result<void, TechnicalError>> {
    return Future.fromPromise(this.amqpClient.close())
      .mapError((error) => new TechnicalError("Failed to close AMQP connection", error))
      .mapOk(() => undefined);
  }

  private waitForConnectionReady(): Future<Result<void, TechnicalError>> {
    return Future.fromPromise(this.amqpClient.channel.waitForConnect()).mapError(
      (error) => new TechnicalError("Failed to wait for connection ready", error),
    );
  }
}
