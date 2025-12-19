import { it as vitestIt, inject } from "vitest";
import { type ChannelModel, connect } from "amqplib";

export const it = vitestIt.extend<{
  amqpConnection: ChannelModel;
}>({
  // oxlint-disable-next-line no-empty-pattern
  amqpConnection: async ({}, use) => {
    const connection = await connect(
      `amqp://guest:guest@${inject("__TESTCONTAINERS_RABBITMQ_IP__")}:${inject("__TESTCONTAINERS_RABBITMQ_PORT_5672__")}`,
    );
    await use(connection);
    await connection.close();
  },
});
