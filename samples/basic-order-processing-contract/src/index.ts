import {
  defineConsumer,
  defineContract,
  defineExchange,
  defineExchangeBinding,
  defineMessage,
  definePublisher,
  defineQueue,
  defineQueueBinding,
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

// Define exchanges first so they can be referenced
const ordersExchange = defineExchange("orders", "topic", { durable: true });
const orderAnalyticsExchange = defineExchange("order-analytics", "topic", { durable: true });

// Define queues so they can be referenced
const orderProcessingQueue = defineQueue("order-processing", { durable: true });
const orderNotificationsQueue = defineQueue("order-notifications", { durable: true });
const orderShippingQueue = defineQueue("order-shipping", { durable: true });
const orderUrgentQueue = defineQueue("order-urgent", { durable: true });
const analyticsProcessingQueue = defineQueue("analytics-processing", { durable: true });

// Define messages with metadata
const orderMessage = defineMessage(orderSchema, {
  summary: "Order created event",
  description: "Emitted when a new order is created in the system",
});

const orderStatusMessage = defineMessage(orderStatusSchema, {
  summary: "Order status update event",
  description: "Emitted when an order status changes",
});

const orderUnionMessage = defineMessage(z.union([orderSchema, orderStatusSchema]));

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
    orders: ordersExchange,

    // Secondary exchange for analytics (receives filtered events from orders exchange)
    orderAnalytics: orderAnalyticsExchange,
  },
  queues: {
    // Queue for processing all new orders
    orderProcessing: orderProcessingQueue,

    // Queue for all notifications (subscribes to all order events)
    orderNotifications: orderNotificationsQueue,

    // Queue for shipping department (only shipped orders)
    orderShipping: orderShippingQueue,

    // Queue for urgent orders (any urgent event)
    orderUrgent: orderUrgentQueue,

    // Queue for analytics (receives events through orderAnalytics exchange)
    analyticsProcessing: analyticsProcessingQueue,
  },
  bindings: {
    // Exchange-to-Exchange binding: Route all order events to analytics exchange
    // This demonstrates how messages can flow through multiple exchanges
    orderToAnalytics: defineExchangeBinding(orderAnalyticsExchange, ordersExchange, {
      routingKey: "order.#",
    }),

    // Queue-to-Exchange bindings for order events

    // Bind processing queue to order.created events
    orderProcessingBinding: defineQueueBinding(orderProcessingQueue, ordersExchange, {
      routingKey: "order.created",
    }),

    // Bind notifications queue to ALL order events using wildcard
    orderNotificationsBinding: defineQueueBinding(orderNotificationsQueue, ordersExchange, {
      routingKey: "order.#",
    }),

    // Bind shipping queue only to shipped orders
    orderShippingBinding: defineQueueBinding(orderShippingQueue, ordersExchange, {
      routingKey: "order.shipped",
    }),

    // Bind urgent queue to any urgent order events
    orderUrgentBinding: defineQueueBinding(orderUrgentQueue, ordersExchange, {
      routingKey: "order.*.urgent",
    }),

    // Bind analytics queue to analytics exchange for all events
    analyticsBinding: defineQueueBinding(analyticsProcessingQueue, orderAnalyticsExchange, {
      routingKey: "order.#",
    }),
  },
  publishers: {
    // Publisher for new orders
    orderCreated: definePublisher(ordersExchange, orderMessage, {
      routingKey: "order.created",
    }),

    // Publisher for regular order updates
    orderUpdated: definePublisher(ordersExchange, orderStatusMessage, {
      routingKey: "order.updated",
    }),

    // Publisher for shipped orders
    orderShipped: definePublisher(ordersExchange, orderStatusMessage, {
      routingKey: "order.shipped",
    }),

    // Publisher for urgent order updates
    orderUrgentUpdate: definePublisher(ordersExchange, orderStatusMessage, {
      routingKey: "order.updated.urgent",
    }),
  },
  consumers: {
    // Consumer for processing new orders
    processOrder: defineConsumer(orderProcessingQueue, orderMessage),

    // Consumer for sending all notifications
    notifyOrder: defineConsumer(orderNotificationsQueue, orderUnionMessage),

    // Consumer for shipping department
    shipOrder: defineConsumer(orderShippingQueue, orderStatusMessage),

    // Consumer for urgent orders
    handleUrgentOrder: defineConsumer(orderUrgentQueue, orderStatusMessage),

    // Consumer for analytics processing
    processAnalytics: defineConsumer(analyticsProcessingQueue, orderUnionMessage),
  },
});
