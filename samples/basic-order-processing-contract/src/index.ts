import {
  defineBinding,
  defineExchangeBinding,
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
 * Message schema for order status updates
 */
const orderStatusSchema = z.object({
  orderId: z.string(),
  status: z.enum(["processing", "shipped", "delivered", "cancelled"]),
  updatedAt: z.string().datetime(),
});

/**
 * Order processing contract demonstrating RabbitMQ topic pattern
 *
 * This contract demonstrates:
 * 1. Queue-to-Exchange bindings: Direct message routing from exchanges to queues
 * 2. Exchange-to-Exchange bindings: Messages are routed through multiple exchanges
 *    before reaching queues, enabling complex routing patterns
 *
 * Topic pattern allows flexible routing based on routing key patterns:
 * - order.created: New orders
 * - order.updated: Order status updates
 * - order.shipped: Orders that have been shipped
 * - order.#: All order events (zero or more words)
 * - order.*.urgent: Urgent orders (one word between order. and .urgent)
 */
export const orderContract = defineContract({
  exchanges: {
    // Primary exchange for all orders
    orders: defineExchange("orders", "topic", { durable: true }),

    // Secondary exchange for analytics (receives filtered events from orders exchange)
    orderAnalytics: defineExchange("order-analytics", "topic", { durable: true }),
  },
  queues: {
    // Queue for processing all new orders
    orderProcessing: defineQueue("order-processing", { durable: true }),

    // Queue for all notifications (subscribes to all order events)
    orderNotifications: defineQueue("order-notifications", { durable: true }),

    // Queue for shipping department (only shipped orders)
    orderShipping: defineQueue("order-shipping", { durable: true }),

    // Queue for urgent orders (any urgent event)
    orderUrgent: defineQueue("order-urgent", { durable: true }),

    // Queue for analytics (receives events through orderAnalytics exchange)
    analyticsProcessing: defineQueue("analytics-processing", { durable: true }),
  },
  bindings: {
    // Exchange-to-Exchange binding: Route all order events to analytics exchange
    // This demonstrates how messages can flow through multiple exchanges
    orderToAnalytics: defineExchangeBinding("order-analytics", "orders", {
      routingKey: "order.#",
    }),

    // Queue-to-Exchange bindings for order events

    // Bind processing queue to order.created events
    orderProcessingBinding: defineBinding("order-processing", "orders", {
      routingKey: "order.created",
    }),

    // Bind notifications queue to ALL order events using wildcard
    orderNotificationsBinding: defineBinding("order-notifications", "orders", {
      routingKey: "order.#",
    }),

    // Bind shipping queue only to shipped orders
    orderShippingBinding: defineBinding("order-shipping", "orders", {
      routingKey: "order.shipped",
    }),

    // Bind urgent queue to any urgent order events
    orderUrgentBinding: defineBinding("order-urgent", "orders", {
      routingKey: "order.*.urgent",
    }),

    // Bind analytics queue to analytics exchange for all events
    analyticsBinding: defineBinding("analytics-processing", "order-analytics", {
      routingKey: "order.#",
    }),
  },
  publishers: {
    // Publisher for new orders
    orderCreated: definePublisher("orders", orderSchema, {
      routingKey: "order.created",
    }),

    // Publisher for regular order updates
    orderUpdated: definePublisher("orders", orderStatusSchema, {
      routingKey: "order.updated",
    }),

    // Publisher for shipped orders
    orderShipped: definePublisher("orders", orderStatusSchema, {
      routingKey: "order.shipped",
    }),

    // Publisher for urgent order updates
    orderUrgentUpdate: definePublisher("orders", orderStatusSchema, {
      routingKey: "order.updated.urgent",
    }),
  },
  consumers: {
    // Consumer for processing new orders
    processOrder: defineConsumer("order-processing", orderSchema, {
      prefetch: 10,
    }),

    // Consumer for sending all notifications
    notifyOrder: defineConsumer("order-notifications", z.union([orderSchema, orderStatusSchema]), {
      prefetch: 5,
    }),

    // Consumer for shipping department
    shipOrder: defineConsumer("order-shipping", orderStatusSchema, {
      prefetch: 5,
    }),

    // Consumer for urgent orders
    handleUrgentOrder: defineConsumer("order-urgent", orderStatusSchema, {
      prefetch: 20,
    }),

    // Consumer for analytics processing
    processAnalytics: defineConsumer(
      "analytics-processing",
      z.union([orderSchema, orderStatusSchema]),
      {
        prefetch: 50, // Higher prefetch for analytics
      },
    ),
  },
});
