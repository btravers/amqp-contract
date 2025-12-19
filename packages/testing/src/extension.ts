import { inject, it as vitestIt } from "vitest";
import { type ChannelModel, connect } from "amqplib";

export const it = vitestIt.extend<{
  workerConnection: ChannelModel;
  clientConnection: ChannelModel;
}>({
  // oxlint-disable-next-line no-empty-pattern
  workerConnection: async ({}, use) => {
    const connection = await createAmqpConnection();
    await use(connection);
    try {
      await connection.close();
    } catch {
      // Connection may already be closed
    }
  },
  // oxlint-disable-next-line no-empty-pattern
  clientConnection: async ({}, use) => {
    const connection = await createAmqpConnection();
    await use(connection);
    try {
      await connection.close();
    } catch {
      // Connection may already be closed
    }
  },
});

function createAmqpConnection(): Promise<ChannelModel> {
  return connect(
    `amqp://guest:guest@${inject("__TESTCONTAINERS_RABBITMQ_IP__")}:${inject("__TESTCONTAINERS_RABBITMQ_PORT_5672__")}`,
  );
}
