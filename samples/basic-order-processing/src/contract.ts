import {
  defineBinding,
  defineConsumer,
  defineContract,
  defineExchange,
  definePublisher,
  defineQueue,
} from "@amqp-contract/contract";
import { z } from "zod";

/**
 * Message schema for order events
 */
const orderSchema = z.object({
  orderId: z.string(),
  customerId: z.string(),
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().int().positive(),
      price: z.number().positive(),
    }),
  ),
  totalAmount: z.number().positive(),
  createdAt: z.string().datetime(),
});

/**
 * Order processing contract
 */
export const orderContract = defineContract({
  exchanges: {
    orders: defineExchange("orders", "topic", { durable: true }),
  },
  queues: {
    orderProcessing: defineQueue("order-processing", { durable: true }),
    orderNotifications: defineQueue("order-notifications", { durable: true }),
  },
  bindings: {
    orderProcessingBinding: defineBinding("order-processing", "orders", {
      routingKey: "order.created",
    }),
    orderNotificationsBinding: defineBinding("order-notifications", "orders", {
      routingKey: "order.created",
    }),
  },
  publishers: {
    orderCreated: definePublisher("orders", orderSchema, {
      routingKey: "order.created",
    }),
  },
  consumers: {
    processOrder: defineConsumer("order-processing", orderSchema, {
      prefetch: 10,
    }),
    notifyOrder: defineConsumer("order-notifications", orderSchema, {
      prefetch: 5,
    }),
  },
});
