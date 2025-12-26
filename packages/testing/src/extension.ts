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
    try {
      await use(vhost);
    } finally {
      await deleteVhost(vhost);
    }
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
  publishMessage: async ({ amqpChannel }, use) => {
    function publishMessage(exchange: string, routingKey: string, content: unknown): void {
      amqpChannel.publish(exchange, routingKey, Buffer.from(JSON.stringify(content)));
    }
    await use(publishMessage);
  },
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
