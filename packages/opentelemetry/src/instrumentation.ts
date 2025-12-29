import { AMQP_ATTRIBUTES, AMQP_OPERATIONS, MESSAGING_SYSTEM_AMQP } from "./constants.js";
import {
  type Context,
  type Span,
  SpanKind,
  SpanStatusCode,
  type Tracer,
  context,
  propagation,
  trace,
} from "@opentelemetry/api";

/**
 * Configuration options for OpenTelemetry instrumentation
 */
export type InstrumentationConfig = {
  /**
   * Custom tracer instance. If not provided, the global tracer will be used.
   */
  tracer?: Tracer;

  /**
   * Enable or disable tracing. Default: true
   */
  enableTracing?: boolean;
};

/**
 * Interface for client instrumentation operations
 */
export interface IClientInstrumentation {
  startPublishSpan(
    publisherName: string,
    exchangeName: string,
    routingKey: string,
    exchangeType?: string,
  ): Span | undefined;
  injectTraceContext<T extends Record<string, unknown>>(options?: T): T;
  recordValidationError(span: Span | undefined, error: unknown): void;
  recordTechnicalError(span: Span | undefined, error: unknown): void;
  recordSuccess(span: Span | undefined): void;
  endSpan(span: Span | undefined): void;
}

/**
 * Interface for worker instrumentation operations
 */
export interface IWorkerInstrumentation {
  extractTraceContext(headers?: Record<string, unknown>): Context;
  startConsumeSpan(
    consumerName: string,
    queueName: string,
    parentContext?: Context,
  ): Span | undefined;
  startBatchProcessSpan(
    consumerName: string,
    queueName: string,
    batchSize: number,
  ): Span | undefined;
  recordValidationError(span: Span | undefined, error: unknown): void;
  recordProcessingError(span: Span | undefined, error: unknown): void;
  recordSuccess(span: Span | undefined): void;
  endSpan(span: Span | undefined): void;
}

/**
 * Instrumentation utilities for AMQP client operations
 */
export class ClientInstrumentation implements IClientInstrumentation {
  private readonly tracer: Tracer;
  private readonly enableTracing: boolean;

  constructor(config: InstrumentationConfig = {}) {
    this.tracer = config.tracer ?? trace.getTracer("@amqp-contract/client");
    this.enableTracing = config.enableTracing ?? true;
  }

  /**
   * Create a span for message publishing operation
   */
  startPublishSpan(
    publisherName: string,
    exchangeName: string,
    routingKey: string,
    exchangeType?: string,
  ): Span | undefined {
    if (!this.enableTracing) {
      return undefined;
    }

    const span = this.tracer.startSpan(`${exchangeName} ${AMQP_OPERATIONS.PUBLISH}`, {
      kind: SpanKind.PRODUCER,
      attributes: {
        [AMQP_ATTRIBUTES.MESSAGING_SYSTEM]: MESSAGING_SYSTEM_AMQP,
        [AMQP_ATTRIBUTES.MESSAGING_OPERATION]: AMQP_OPERATIONS.PUBLISH,
        [AMQP_ATTRIBUTES.MESSAGING_DESTINATION_NAME]: exchangeName,
        [AMQP_ATTRIBUTES.MESSAGING_RABBITMQ_ROUTING_KEY]: routingKey,
        [AMQP_ATTRIBUTES.AMQP_CONTRACT_PUBLISHER_NAME]: publisherName,
        ...(exchangeType && {
          [AMQP_ATTRIBUTES.MESSAGING_RABBITMQ_EXCHANGE_TYPE]: exchangeType,
        }),
      },
    });

    return span;
  }

  /**
   * Inject trace context into AMQP message headers
   */
  injectTraceContext<T extends Record<string, unknown>>(options?: T): T {
    if (!this.enableTracing) {
      return (options ?? {}) as T;
    }

    const existingHeaders = options?.["headers"];
    const headers: Record<string, unknown> =
      existingHeaders && typeof existingHeaders === "object" ? { ...existingHeaders } : {};

    // Inject trace context into headers
    propagation.inject(context.active(), headers);

    return {
      ...options,
      headers,
    } as unknown as T;
  }

  /**
   * Record validation error on span
   */
  recordValidationError(span: Span | undefined, error: unknown): void {
    if (!span) return;

    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: "Message validation failed",
    });
    span.setAttribute(AMQP_ATTRIBUTES.AMQP_CONTRACT_VALIDATION_SUCCESS, false);
    span.recordException(error as Error);
  }

  /**
   * Record technical error on span
   */
  recordTechnicalError(span: Span | undefined, error: unknown): void {
    if (!span) return;

    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: "Technical error during publish",
    });
    span.recordException(error as Error);
  }

  /**
   * Mark span as successful
   */
  recordSuccess(span: Span | undefined): void {
    if (!span) return;

    span.setStatus({ code: SpanStatusCode.OK });
    span.setAttribute(AMQP_ATTRIBUTES.AMQP_CONTRACT_VALIDATION_SUCCESS, true);
  }

  /**
   * End the span
   */
  endSpan(span: Span | undefined): void {
    if (!span) return;
    span.end();
  }

  /**
   * Execute a callback within a span context
   */
  withSpan<T>(span: Span | undefined, callback: () => T): T {
    if (!span) return callback();

    return context.with(trace.setSpan(context.active(), span), callback);
  }
}

/**
 * Instrumentation utilities for AMQP worker operations
 */
export class WorkerInstrumentation implements IWorkerInstrumentation {
  private readonly tracer: Tracer;
  private readonly enableTracing: boolean;

  constructor(config: InstrumentationConfig = {}) {
    this.tracer = config.tracer ?? trace.getTracer("@amqp-contract/worker");
    this.enableTracing = config.enableTracing ?? true;
  }

  /**
   * Extract trace context from AMQP message headers
   */
  extractTraceContext(headers?: Record<string, unknown>): Context {
    if (!this.enableTracing || !headers) {
      return context.active();
    }

    return propagation.extract(context.active(), headers);
  }

  /**
   * Create a span for message consumption operation
   */
  startConsumeSpan(
    consumerName: string,
    queueName: string,
    parentContext?: Context,
  ): Span | undefined {
    if (!this.enableTracing) {
      return undefined;
    }

    const span = this.tracer.startSpan(
      `${queueName} ${AMQP_OPERATIONS.RECEIVE}`,
      {
        kind: SpanKind.CONSUMER,
        attributes: {
          [AMQP_ATTRIBUTES.MESSAGING_SYSTEM]: MESSAGING_SYSTEM_AMQP,
          [AMQP_ATTRIBUTES.MESSAGING_OPERATION]: AMQP_OPERATIONS.RECEIVE,
          [AMQP_ATTRIBUTES.MESSAGING_DESTINATION_NAME]: queueName,
          [AMQP_ATTRIBUTES.MESSAGING_RABBITMQ_QUEUE_NAME]: queueName,
          [AMQP_ATTRIBUTES.AMQP_CONTRACT_CONSUMER_NAME]: consumerName,
        },
      },
      parentContext,
    );

    return span;
  }

  /**
   * Create a span for batch processing operation
   */
  startBatchProcessSpan(
    consumerName: string,
    queueName: string,
    batchSize: number,
  ): Span | undefined {
    if (!this.enableTracing) {
      return undefined;
    }

    const span = this.tracer.startSpan(`${queueName} ${AMQP_OPERATIONS.PROCESS} batch`, {
      kind: SpanKind.CONSUMER,
      attributes: {
        [AMQP_ATTRIBUTES.MESSAGING_SYSTEM]: MESSAGING_SYSTEM_AMQP,
        [AMQP_ATTRIBUTES.MESSAGING_OPERATION]: AMQP_OPERATIONS.PROCESS,
        [AMQP_ATTRIBUTES.MESSAGING_DESTINATION_NAME]: queueName,
        [AMQP_ATTRIBUTES.MESSAGING_RABBITMQ_QUEUE_NAME]: queueName,
        [AMQP_ATTRIBUTES.AMQP_CONTRACT_CONSUMER_NAME]: consumerName,
        [AMQP_ATTRIBUTES.AMQP_CONTRACT_BATCH_SIZE]: batchSize,
      },
    });

    return span;
  }

  /**
   * Record validation error on span
   */
  recordValidationError(span: Span | undefined, error: unknown): void {
    if (!span) return;

    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: "Message validation failed",
    });
    span.setAttribute(AMQP_ATTRIBUTES.AMQP_CONTRACT_VALIDATION_SUCCESS, false);
    span.recordException(error as Error);
  }

  /**
   * Record processing error on span
   */
  recordProcessingError(span: Span | undefined, error: unknown): void {
    if (!span) return;

    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: "Error processing message",
    });
    span.recordException(error as Error);
  }

  /**
   * Mark span as successful
   */
  recordSuccess(span: Span | undefined): void {
    if (!span) return;

    span.setStatus({ code: SpanStatusCode.OK });
    span.setAttribute(AMQP_ATTRIBUTES.AMQP_CONTRACT_VALIDATION_SUCCESS, true);
  }

  /**
   * End the span
   */
  endSpan(span: Span | undefined): void {
    if (!span) return;
    span.end();
  }

  /**
   * Execute a callback within a span context
   */
  withSpan<T>(span: Span | undefined, callback: () => T): T {
    if (!span) return callback();

    return context.with(trace.setSpan(context.active(), span), callback);
  }
}
