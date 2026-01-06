import {
  defineContract,
  defineExchange,
  defineMessage,
  definePublisher,
  defineQueue,
  defineQueueBinding,
  defineConsumer,
} from "@amqp-contract/contract";
import { z } from "zod";

// Define exchange
const dataExchange = defineExchange("data-exchange", "topic", { durable: true });

// Define queue
const dataQueue = defineQueue("data-processing-queue", { durable: true });

// Define message schemas
const smallDataMessage = defineMessage(
  z.object({
    id: z.string(),
    timestamp: z.string(),
    value: z.number(),
  }),
  {
    summary: "Small data event",
    description: "A small message that doesn't benefit from compression",
  },
);

const largeDataMessage = defineMessage(
  z.object({
    id: z.string(),
    timestamp: z.string(),
    metadata: z.record(z.string(), z.string()),
    items: z.array(
      z.object({
        name: z.string(),
        description: z.string(),
        properties: z.record(z.string(), z.unknown()),
      }),
    ),
  }),
  {
    summary: "Large data event",
    description: "A large message that benefits from compression",
  },
);

// Define contract with publishers and consumers
export const contract = defineContract({
  exchanges: {
    data: dataExchange,
  },
  queues: {
    processing: dataQueue,
  },
  bindings: {
    dataBinding: defineQueueBinding(dataQueue, dataExchange, {
      routingKey: "data.#",
    }),
  },
  publishers: {
    smallData: definePublisher(dataExchange, smallDataMessage, {
      routingKey: "data.small",
    }),
    largeData: definePublisher(dataExchange, largeDataMessage, {
      routingKey: "data.large",
    }),
  },
  consumers: {
    processData: defineConsumer(dataQueue, largeDataMessage),
  },
});
