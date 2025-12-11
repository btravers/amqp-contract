import type { Channel, Connection as AmqpConnection, Options } from 'amqplib';
import type {
  ClientInferPublisherInput,
  ContractDefinition,
  InferPublisherNames,
} from '@amqp-contract/contract';

/**
 * Options for publishing a message
 */
export interface PublishOptions {
  routingKey?: string;
  options?: Options.Publish;
}

/**
 * Type-safe AMQP client for publishing messages
 */
export class AmqpClient<TContract extends ContractDefinition> {
  private channel: Channel | null = null;
  private connection: AmqpConnection | null = null;

  constructor(private readonly contract: TContract) {}

  /**
   * Connect to AMQP broker
   */
  async connect(connection: AmqpConnection): Promise<void> {
    this.connection = connection;
    this.channel = await (
      connection as unknown as { createChannel(): Promise<Channel> }
    ).createChannel();

    // Setup exchanges
    if (this.contract.exchanges && this.channel) {
      for (const exchange of Object.values(this.contract.exchanges)) {
        await this.channel.assertExchange(exchange.name, exchange.type, {
          durable: exchange.durable,
          autoDelete: exchange.autoDelete,
          internal: exchange.internal,
          arguments: exchange.arguments,
        });
      }
    }

    // Setup queues
    if (this.contract.queues && this.channel) {
      for (const queue of Object.values(this.contract.queues)) {
        await this.channel.assertQueue(queue.name, {
          durable: queue.durable,
          exclusive: queue.exclusive,
          autoDelete: queue.autoDelete,
          arguments: queue.arguments,
        });
      }
    }

    // Setup bindings
    if (this.contract.bindings && this.channel) {
      for (const binding of Object.values(this.contract.bindings)) {
        await this.channel.bindQueue(
          binding.queue,
          binding.exchange,
          binding.routingKey ?? '',
          binding.arguments
        );
      }
    }
  }

  /**
   * Publish a message using a defined publisher
   */
  async publish<TName extends InferPublisherNames<TContract>>(
    publisherName: TName,
    message: ClientInferPublisherInput<TContract, TName>,
    options?: PublishOptions
  ): Promise<boolean> {
    if (!this.channel) {
      throw new Error('Client not connected. Call connect() first.');
    }

    const publishers = this.contract.publishers as Record<string, unknown>;
    if (!publishers) {
      throw new Error('No publishers defined in contract');
    }

    const publisher = publishers[publisherName as string];
    if (!publisher || typeof publisher !== 'object') {
      throw new Error(`Publisher "${String(publisherName)}" not found in contract`);
    }

    const publisherDef = publisher as {
      exchange: string;
      routingKey?: string;
      message: { '~standard': { validate: (value: unknown) => unknown } };
    };

    // Validate message using schema
    const validation = publisherDef.message['~standard'].validate(message);
    if (
      typeof validation === 'object' &&
      validation !== null &&
      'issues' in validation &&
      validation.issues
    ) {
      throw new Error(`Message validation failed: ${JSON.stringify(validation.issues)}`);
    }

    const validatedMessage =
      typeof validation === 'object' && validation !== null && 'value' in validation
        ? validation.value
        : message;

    // Publish message
    const routingKey = options?.routingKey ?? publisherDef.routingKey ?? '';
    const content = Buffer.from(JSON.stringify(validatedMessage));

    return this.channel.publish(publisherDef.exchange, routingKey, content, options?.options);
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
      this.channel = null;
    }
    if (this.connection) {
      await (this.connection as unknown as { close(): Promise<void> }).close();
      this.connection = null;
    }
  }
}

/**
 * Create a type-safe AMQP client from a contract
 */
export function createClient<TContract extends ContractDefinition>(
  contract: TContract
): AmqpClient<TContract> {
  return new AmqpClient(contract);
}
