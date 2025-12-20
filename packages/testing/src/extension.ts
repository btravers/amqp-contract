import { inject, it as vitestIt } from "vitest";

export const it = vitestIt.extend<{
  amqpConnectionUrl: string;
}>({
  // oxlint-disable-next-line no-empty-pattern
  amqpConnectionUrl: async ({}, use) => {
    const url = `amqp://guest:guest@${inject("__TESTCONTAINERS_RABBITMQ_IP__")}:${inject("__TESTCONTAINERS_RABBITMQ_PORT_5672__")}`;
    await use(url);
  },
});
