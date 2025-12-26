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
  // oxlint-disable-next-line no-empty-pattern
  vhost: async ({}, use) => {
    const vhost = await createVhost();
    await use(vhost);
  },
  amqpConnectionUrl: async ({ vhost }, use) => {
    const url = `amqp://guest:guest@${inject("__TESTCONTAINERS_RABBITMQ_IP__")}:${inject("__TESTCONTAINERS_RABBITMQ_PORT_5672__")}/${vhost}`;
    await use(url);
  },
  amqpConnection: async ({ amqpConnectionUrl }, use) => {
    const connection = await amqpLib.connect(amqpConnectionUrl);
    await use(connection);
    await connection.close();
  },
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
    `http://${inject("__TESTCONTAINERS_RABBITMQ_IP__")}:${inject("__TESTCONTAINERS_RABBITMQ_PORT_15672__")}/api/vhosts/${namespace}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Basic ${btoa("guest:guest")}`,
      },
    },
  );

  if (vhostResponse.status !== 201) {
    throw new Error(`Failed to create vhost: ${vhostResponse.status}`, {
      cause: vhostResponse,
    });
  }

  return namespace;
}
