import { inject } from "vitest";
import { type ChannelModel, connect } from "amqplib";

export async function getAmqpConnection(): Promise<ChannelModel> {
  const connection = await connect(
    `amqp://guest:guest@${inject("__TESTCONTAINERS_RABBITMQ_IP__")}:${inject("__TESTCONTAINERS_RABBITMQ_PORT_5672__")}`,
  );
  return connection;
}
