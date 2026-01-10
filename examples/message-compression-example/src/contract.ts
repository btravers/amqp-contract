import {
  defineConsumer,
  defineContract,
  defineExchange,
  defineMessage,
  definePublisher,
  defineQueue,
  defineQueueBinding,
} from "@amqp-contract/contract";
import { z } from "zod";

// Define exchange
const dataExchange = defineExchange("data-exchange", "topic", { durable: true });

// Define queue
const dataQueue = defineQueue("data-processing-queue", { durable: true });

// Define message schema - using a unified schema that works for all message types
// In this example, we use the large schema as it's a superset, with optional fields
const dataMessage = defineMessage(
  z.object({
    id: z.string(),
    timestamp: z.string(),
    // Optional field only in small messages
    value: z.number().optional(),
    // Optional fields only in large messages
    metadata: z.record(z.string(), z.string()).optional(),
    items: z.array(
      z.object({
        name: z.string(),
        description: z.string(),
        properties: z.record(z.string(), z.unknown()),
      }),
    ),
  }),
  {
    summary: "Data event",
    description: "A message that can be small or large, with optional compression",
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
    smallData: definePublisher(dataExchange, dataMessage, {
      routingKey: "data.small",
    }),
    largeData: definePublisher(dataExchange, dataMessage, {
      routingKey: "data.large",
    }),
  },
  consumers: {
    processData: defineConsumer(dataQueue, dataMessage),
  },
});
