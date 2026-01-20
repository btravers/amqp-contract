import type { ConsumerDefinition, MessageDefinition, QueueEntry } from "../types.js";
import { extractQueue } from "./queue.js";

/**
 * Define a message consumer.
 *
 * A consumer receives and processes messages from a queue. The message schema is validated
 * automatically when messages are consumed, ensuring type safety for your handlers.
 *
 * Consumers are associated with a specific queue and message type. When you create a worker
 * with this consumer, it will process messages from the queue according to the schema.
 *
 * **Which pattern to use:**
 *
 * | Pattern | Best for | Description |
 * |---------|----------|-------------|
 * | `definePublisher` + `defineConsumer` | Independent definition | Define publishers and consumers separately with manual schema consistency |
 * | `definePublisherFirst` | Event broadcasting | Define publisher first, create linked consumers that share the same message schema |
 * | `defineConsumerFirst` | Request handling | Define consumer first, create linked publishers that share the same message schema |
 *
 * Use `defineConsumerFirst` when:
 * - One consumer receives from multiple publishers
 * - You want automatic schema consistency between consumer and publishers
 * - You're building request-handling patterns
 *
 * @param queue - The queue definition to consume from
 * @param message - The message definition with payload schema
 * @param options - Optional consumer configuration
 * @returns A consumer definition with inferred message types
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 *
 * const orderQueue = defineQueue('order-processing', { durable: true });
 * const orderMessage = defineMessage(
 *   z.object({
 *     orderId: z.string().uuid(),
 *     customerId: z.string().uuid(),
 *     amount: z.number().positive(),
 *   })
 * );
 *
 * const processOrderConsumer = defineConsumer(orderQueue, orderMessage);
 *
 * // Later, when creating a worker, you'll provide a handler for this consumer:
 * // const worker = await TypedAmqpWorker.create({
 * //   contract,
 * //   handlers: {
 * //     processOrder: async (message) => {
 * //       // message is automatically typed based on the schema
 * //       console.log(message.orderId); // string
 * //     }
 * //   },
 * //   connection
 * // });
 * ```
 *
 * @see defineConsumerFirst - For request-handling patterns with automatic schema consistency
 * @see definePublisherFirst - For event-driven patterns with automatic schema consistency
 */
export function defineConsumer<TMessage extends MessageDefinition>(
  queue: QueueEntry,
  message: TMessage,
  options?: Omit<ConsumerDefinition<TMessage>, "queue" | "message">,
): ConsumerDefinition<TMessage> {
  return {
    queue: extractQueue(queue),
    message,
    ...options,
  };
}
