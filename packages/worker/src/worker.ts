import type { Channel, Connection, ConsumeMessage } from 'amqplib';
import type {
  ContractDefinition,
  InferConsumerNames,
  WorkerInferConsumerHandlers,
} from '@amqp-contract/contract';

/**
 * Type-safe AMQP worker for consuming messages
 */
export class AmqpWorker<TContract extends ContractDefinition> {
  private channel: Channel | null = null;
  private connection: Connection | null = null;
  private consumerTags: string[] = [];

  constructor(
    private readonly contract: TContract,
    private readonly handlers: WorkerInferConsumerHandlers<TContract>
  ) {}

  /**
   * Connect to AMQP broker
   */
  async connect(connection: Connection): Promise<void> {
    this.connection = connection;
    this.channel = await connection.createChannel();

    // Setup exchanges
    if (this.contract.exchanges) {
      for (const exchange of Object.values(this.contract.exchanges)) {
        await this.channel.assertExchange(
          exchange.name,
          exchange.type,
          {
            durable: exchange.durable,
            autoDelete: exchange.autoDelete,
            internal: exchange.internal,
            arguments: exchange.arguments,
          }
        );
      }
    }

    // Setup queues
    if (this.contract.queues) {
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
    if (this.contract.bindings) {
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
   * Start consuming messages for a specific consumer
   */
  async consume<TName extends InferConsumerNames<TContract>>(
    consumerName: TName
  ): Promise<void> {
    if (!this.channel) {
      throw new Error('Worker not connected. Call connect() first.');
    }

    const consumers = this.contract.consumers as Record<string, unknown>;
    if (!consumers) {
      throw new Error('No consumers defined in contract');
    }

    const consumer = consumers[consumerName as string];
    if (!consumer || typeof consumer !== 'object') {
      throw new Error(`Consumer "${String(consumerName)}" not found in contract`);
    }

    const consumerDef = consumer as {
      queue: string;
      message: { '~standard': { validate: (value: unknown) => unknown } };
      prefetch?: number;
      noAck?: boolean;
    };

    const handler = this.handlers[consumerName];
    if (!handler) {
      throw new Error(`Handler for "${String(consumerName)}" not provided`);
    }

    // Set prefetch if specified
    if (consumerDef.prefetch !== undefined) {
      await this.channel.prefetch(consumerDef.prefetch);
    }

    // Start consuming
    const result = await this.channel.consume(
      consumerDef.queue,
      async (msg: ConsumeMessage | null) => {
        if (!msg) {
          return;
        }

        try {
          // Parse message
          const content = JSON.parse(msg.content.toString());

          // Validate message using schema
          const validation = consumerDef.message['~standard'].validate(content);
          if ('issues' in validation && validation.issues) {
            console.error('Message validation failed:', validation.issues);
            // Reject message with no requeue
            this.channel?.nack(msg, false, false);
            return;
          }

          const validatedMessage = 'value' in validation ? validation.value : content;

          // Call handler
          await handler(validatedMessage);

          // Acknowledge message if not in noAck mode
          if (!consumerDef.noAck) {
            this.channel?.ack(msg);
          }
        } catch (error) {
          console.error('Error processing message:', error);
          // Reject message and requeue
          this.channel?.nack(msg, false, true);
        }
      },
      {
        noAck: consumerDef.noAck ?? false,
      }
    );

    this.consumerTags.push(result.consumerTag);
  }

  /**
   * Start consuming messages for all consumers
   */
  async consumeAll(): Promise<void> {
    if (!this.contract.consumers) {
      throw new Error('No consumers defined in contract');
    }

    const consumerNames = Object.keys(this.contract.consumers) as InferConsumerNames<TContract>[];
    
    for (const consumerName of consumerNames) {
      await this.consume(consumerName);
    }
  }

  /**
   * Stop consuming messages
   */
  async stopConsuming(): Promise<void> {
    if (!this.channel) {
      return;
    }

    for (const tag of this.consumerTags) {
      await this.channel.cancel(tag);
    }
    
    this.consumerTags = [];
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    await this.stopConsuming();
    
    if (this.channel) {
      await this.channel.close();
      this.channel = null;
    }
    
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }
}

/**
 * Create a type-safe AMQP worker from a contract
 */
export function createWorker<TContract extends ContractDefinition>(
  contract: TContract,
  handlers: WorkerInferConsumerHandlers<TContract>
): AmqpWorker<TContract> {
  return new AmqpWorker(contract, handlers);
}
