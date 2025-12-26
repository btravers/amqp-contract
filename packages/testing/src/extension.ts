import amqpLib, { type Channel, type ChannelModel } from "amqplib";
import { inject, it as vitestIt } from "vitest";
import { randomUUID } from "node:crypto";

export const it = vitestIt.extend<{
  vhost: string;
  amqpConnectionUrl: string;
  amqpConnection: ChannelModel;
  amqpChannel: Channel;
  publishMessage: (exchange: string, routingKey: string, content: unknown) => void;
  initConsumer: (
    exchange: string,
    routingKey: string,
  ) => Promise<(nbEvents?: number) => Promise<amqpLib.ConsumeMessage[]>>;
}>({
  /**
   * Test fixture that provides an isolated RabbitMQ virtual host (vhost) for the test.
   *
   * Creates a new vhost with a random UUID name for test isolation. The vhost is automatically
   * created before the test runs using the RabbitMQ Management API.
   *
   * @example
   * ```typescript
   * it('should use isolated vhost', async ({ vhost }) => {
   *   console.log(`Test running in vhost: ${vhost}`);
   * });
   * ```
   */
  // oxlint-disable-next-line no-empty-pattern
  vhost: async ({}, use) => {
    const vhost = await createVhost();
    try {
      await use(vhost);
    } finally {
      await deleteVhost(vhost);
    }
  },
  /**
   * Test fixture that provides the AMQP connection URL for the test container.
   *
   * Constructs a connection URL using the test container's IP and port, along with
   * the isolated vhost. The URL follows the format: `amqp://guest:guest@host:port/vhost`.
   *
   * @example
   * ```typescript
   * it('should connect with URL', async ({ amqpConnectionUrl }) => {
   *   console.log(`Connecting to: ${amqpConnectionUrl}`);
   * });
   * ```
   */
  amqpConnectionUrl: async ({ vhost }, use) => {
    const url = `amqp://guest:guest@${inject("__TESTCONTAINERS_RABBITMQ_IP__")}:${inject("__TESTCONTAINERS_RABBITMQ_PORT_5672__")}/${vhost}`;
    await use(url);
  },
  /**
   * Test fixture that provides an active AMQP connection to RabbitMQ.
   *
   * Establishes a connection using the provided connection URL and automatically closes
   * it after the test completes. This fixture is useful for tests that need direct
   * access to the connection object (e.g., to create multiple channels).
   *
   * @example
   * ```typescript
   * it('should use connection', async ({ amqpConnection }) => {
   *   const channel = await amqpConnection.createChannel();
   *   // ... use channel
   * });
   * ```
   */
  amqpConnection: async ({ amqpConnectionUrl }, use) => {
    const connection = await amqpLib.connect(amqpConnectionUrl);
    await use(connection);
    await connection.close();
  },
  /**
   * Test fixture that provides an AMQP channel for interacting with RabbitMQ.
   *
   * Creates a channel from the active connection and automatically closes it after
   * the test completes. The channel is used for declaring exchanges, queues, bindings,
   * and publishing/consuming messages.
   *
   * @example
   * ```typescript
   * it('should use channel', async ({ amqpChannel }) => {
   *   await amqpChannel.assertExchange('test-exchange', 'topic');
   *   await amqpChannel.assertQueue('test-queue');
   * });
   * ```
   */
  amqpChannel: async ({ amqpConnection }, use) => {
    const channel = await amqpConnection.createChannel();
    await use(channel);
    await channel.close();
  },
  /**
   * Test fixture for publishing messages to an AMQP exchange.
   *
   * Provides a helper function to publish messages directly to an exchange during tests.
   * The message content is automatically serialized to JSON and converted to a Buffer.
   *
   * @param exchange - The name of the exchange to publish to
   * @param routingKey - The routing key for message routing
   * @param content - The message payload (will be JSON serialized)
   *
   * @example
   * ```typescript
   * it('should publish message', async ({ publishMessage }) => {
   *   publishMessage('my-exchange', 'routing.key', { data: 'test' });
   * });
   * ```
   */
  publishMessage: async ({ amqpChannel }, use) => {
    function publishMessage(exchange: string, routingKey: string, content: unknown): void {
      amqpChannel.publish(exchange, routingKey, Buffer.from(JSON.stringify(content)));
    }
    await use(publishMessage);
  },
  /**
   * Test fixture for initializing a message consumer on an AMQP queue.
   *
   * Creates a temporary queue, binds it to the specified exchange with the given routing key,
   * and returns a function to collect messages from that queue. The queue is automatically
   * created with a random UUID name to avoid conflicts between tests.
   *
   * @param exchange - The name of the exchange to bind the queue to
   * @param routingKey - The routing key pattern for message filtering
   * @returns A function that accepts an optional number of events (default 1) and returns a Promise that resolves to an array of ConsumeMessage objects
   *
   * @example
   * ```typescript
   * it('should consume messages', async ({ initConsumer, publishMessage }) => {
   *   const waitForMessages = await initConsumer('my-exchange', 'routing.key');
   *   publishMessage('my-exchange', 'routing.key', { data: 'test' });
   *   const messages = await waitForMessages(1);
   *   expect(messages).toHaveLength(1);
   * });
   * ```
   */
  initConsumer: async ({ amqpChannel }, use) => {
    async function initConsumer(
      exchange: string,
      routingKey: string,
    ): Promise<(nbEvents?: number) => Promise<amqpLib.ConsumeMessage[]>> {
      const queue = randomUUID();

      await amqpChannel.assertQueue(queue);
      await amqpChannel.bindQueue(queue, exchange, routingKey);

      return (nbEvents = 1) =>
        new Promise((resolve) => {
          const messages: amqpLib.ConsumeMessage[] = [];
          amqpChannel.consume(
            queue,
            (msg) => {
              if (msg) {
                messages.push(msg);
                if (messages.length >= nbEvents) {
                  resolve(messages);
                }
              }
            },
            { noAck: true },
          );
        });
    }
    await use(initConsumer);
  },
});

async function createVhost() {
  const namespace = randomUUID();

  const vhostResponse = await fetch(
    `http://${inject("__TESTCONTAINERS_RABBITMQ_IP__")}:${inject("__TESTCONTAINERS_RABBITMQ_PORT_15672__")}/api/vhosts/${encodeURIComponent(namespace)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Basic ${btoa("guest:guest")}`,
      },
    },
  );

  if (vhostResponse.status !== 201) {
    throw new Error(`Failed to create vhost '${namespace}': ${vhostResponse.status}`, {
      cause: vhostResponse,
    });
  }

  return namespace;
}

async function deleteVhost(vhost: string) {
  const vhostResponse = await fetch(
    `http://${inject("__TESTCONTAINERS_RABBITMQ_IP__")}:${inject("__TESTCONTAINERS_RABBITMQ_PORT_15672__")}/api/vhosts/${encodeURIComponent(vhost)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Basic ${btoa("guest:guest")}`,
      },
    },
  );

  // 204 = successfully deleted, 404 = already deleted or doesn't exist
  if (vhostResponse.status !== 204 && vhostResponse.status !== 404) {
    throw new Error(`Failed to delete vhost '${vhost}': ${vhostResponse.status}`, {
      cause: vhostResponse,
    });
  }
}
