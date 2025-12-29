import { AMQP_ATTRIBUTES, MESSAGING_SYSTEM_AMQP } from "./constants.js";
import { type Counter, type Histogram, type Meter, metrics } from "@opentelemetry/api";

/**
 * Configuration for metrics collection
 */
export type MetricsConfig = {
  /**
   * Custom meter instance. If not provided, the global meter will be used.
   */
  meter?: Meter;

  /**
   * Prefix for all metric names. Default: "amqp_contract"
   */
  prefix?: string;
};

/**
 * Metrics collector for AMQP client operations
 */
export class ClientMetrics {
  private readonly publishCounter: Counter;
  private readonly publishDuration: Histogram;
  private readonly publishErrorCounter: Counter;
  private readonly validationErrorCounter: Counter;

  constructor(config: MetricsConfig = {}) {
    const meter = config.meter ?? metrics.getMeter("@amqp-contract/client");
    const prefix = config.prefix ?? "amqp_contract";

    this.publishCounter = meter.createCounter(`${prefix}.client.publish`, {
      description: "Number of messages published",
      unit: "messages",
    });

    this.publishDuration = meter.createHistogram(`${prefix}.client.publish.duration`, {
      description: "Duration of message publishing operations",
      unit: "ms",
    });

    this.publishErrorCounter = meter.createCounter(`${prefix}.client.publish.errors`, {
      description: "Number of publishing errors",
      unit: "errors",
    });

    this.validationErrorCounter = meter.createCounter(`${prefix}.client.validation.errors`, {
      description: "Number of message validation errors",
      unit: "errors",
    });
  }

  /**
   * Record a successful message publish
   */
  recordPublish(publisherName: string, exchangeName: string, durationMs: number): void {
    this.publishCounter.add(1, {
      [AMQP_ATTRIBUTES.AMQP_CONTRACT_PUBLISHER_NAME]: publisherName,
      [AMQP_ATTRIBUTES.MESSAGING_DESTINATION_NAME]: exchangeName,
      [AMQP_ATTRIBUTES.MESSAGING_SYSTEM]: MESSAGING_SYSTEM_AMQP,
    });

    this.publishDuration.record(durationMs, {
      [AMQP_ATTRIBUTES.AMQP_CONTRACT_PUBLISHER_NAME]: publisherName,
      [AMQP_ATTRIBUTES.MESSAGING_DESTINATION_NAME]: exchangeName,
    });
  }

  /**
   * Record a validation error
   */
  recordValidationError(publisherName: string, exchangeName: string): void {
    this.validationErrorCounter.add(1, {
      [AMQP_ATTRIBUTES.AMQP_CONTRACT_PUBLISHER_NAME]: publisherName,
      [AMQP_ATTRIBUTES.MESSAGING_DESTINATION_NAME]: exchangeName,
      [AMQP_ATTRIBUTES.MESSAGING_SYSTEM]: MESSAGING_SYSTEM_AMQP,
    });
  }

  /**
   * Record a technical error during publish
   */
  recordPublishError(publisherName: string, exchangeName: string): void {
    this.publishErrorCounter.add(1, {
      [AMQP_ATTRIBUTES.AMQP_CONTRACT_PUBLISHER_NAME]: publisherName,
      [AMQP_ATTRIBUTES.MESSAGING_DESTINATION_NAME]: exchangeName,
      [AMQP_ATTRIBUTES.MESSAGING_SYSTEM]: MESSAGING_SYSTEM_AMQP,
    });
  }
}

/**
 * Metrics collector for AMQP worker operations
 */
export class WorkerMetrics {
  private readonly consumeCounter: Counter;
  private readonly consumeDuration: Histogram;
  private readonly consumeErrorCounter: Counter;
  private readonly validationErrorCounter: Counter;
  private readonly batchSizeHistogram: Histogram;

  constructor(config: MetricsConfig = {}) {
    const meter = config.meter ?? metrics.getMeter("@amqp-contract/worker");
    const prefix = config.prefix ?? "amqp_contract";

    this.consumeCounter = meter.createCounter(`${prefix}.worker.consume`, {
      description: "Number of messages consumed",
      unit: "messages",
    });

    this.consumeDuration = meter.createHistogram(`${prefix}.worker.consume.duration`, {
      description: "Duration of message processing operations",
      unit: "ms",
    });

    this.consumeErrorCounter = meter.createCounter(`${prefix}.worker.consume.errors`, {
      description: "Number of message processing errors",
      unit: "errors",
    });

    this.validationErrorCounter = meter.createCounter(`${prefix}.worker.validation.errors`, {
      description: "Number of message validation errors",
      unit: "errors",
    });

    this.batchSizeHistogram = meter.createHistogram(`${prefix}.worker.batch.size`, {
      description: "Size of message batches processed",
      unit: "messages",
    });
  }

  /**
   * Record a successful message consumption
   */
  recordConsume(consumerName: string, queueName: string, durationMs: number): void {
    this.consumeCounter.add(1, {
      [AMQP_ATTRIBUTES.AMQP_CONTRACT_CONSUMER_NAME]: consumerName,
      [AMQP_ATTRIBUTES.MESSAGING_RABBITMQ_QUEUE_NAME]: queueName,
      [AMQP_ATTRIBUTES.MESSAGING_SYSTEM]: MESSAGING_SYSTEM_AMQP,
    });

    this.consumeDuration.record(durationMs, {
      [AMQP_ATTRIBUTES.AMQP_CONTRACT_CONSUMER_NAME]: consumerName,
      [AMQP_ATTRIBUTES.MESSAGING_RABBITMQ_QUEUE_NAME]: queueName,
    });
  }

  /**
   * Record batch processing
   */
  recordBatch(
    consumerName: string,
    queueName: string,
    batchSize: number,
    durationMs: number,
  ): void {
    this.batchSizeHistogram.record(batchSize, {
      [AMQP_ATTRIBUTES.AMQP_CONTRACT_CONSUMER_NAME]: consumerName,
      [AMQP_ATTRIBUTES.MESSAGING_RABBITMQ_QUEUE_NAME]: queueName,
    });

    this.consumeDuration.record(durationMs, {
      [AMQP_ATTRIBUTES.AMQP_CONTRACT_CONSUMER_NAME]: consumerName,
      [AMQP_ATTRIBUTES.MESSAGING_RABBITMQ_QUEUE_NAME]: queueName,
    });
  }

  /**
   * Record a validation error
   */
  recordValidationError(consumerName: string, queueName: string): void {
    this.validationErrorCounter.add(1, {
      [AMQP_ATTRIBUTES.AMQP_CONTRACT_CONSUMER_NAME]: consumerName,
      [AMQP_ATTRIBUTES.MESSAGING_RABBITMQ_QUEUE_NAME]: queueName,
      [AMQP_ATTRIBUTES.MESSAGING_SYSTEM]: MESSAGING_SYSTEM_AMQP,
    });
  }

  /**
   * Record a processing error
   */
  recordProcessingError(consumerName: string, queueName: string): void {
    this.consumeErrorCounter.add(1, {
      [AMQP_ATTRIBUTES.AMQP_CONTRACT_CONSUMER_NAME]: consumerName,
      [AMQP_ATTRIBUTES.MESSAGING_RABBITMQ_QUEUE_NAME]: queueName,
      [AMQP_ATTRIBUTES.MESSAGING_SYSTEM]: MESSAGING_SYSTEM_AMQP,
    });
  }
}
