import {
  defineContract,
  defineEventConsumer,
  defineEventPublisher,
  defineExchange,
  defineMessage,
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

// Define exchanges
const ordersExchange = defineExchange("orders", "topic", { durable: true });

// Define dead letter exchange for failed messages
const ordersDlx = defineExchange("orders-dlx", "topic", { durable: true });

// Define queues
const orderProcessingQueue = defineQueue("order-processing", {
  durable: true,
  deadLetter: {
    exchange: ordersDlx,
    routingKey: "order.failed",
  },
  arguments: {
    "x-message-ttl": 86400000, // 24 hours
  },
});
const orderNotificationsQueue = defineQueue("order-notifications", { durable: true });
const orderShippingQueue = defineQueue("order-shipping", { durable: true });
const orderUrgentQueue = defineQueue("order-urgent", { durable: true });

// Dead letter queue to collect failed messages
const ordersDlxQueue = defineQueue("orders-dlx-queue", { durable: true });

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
 * Event publishers for each event type.
 *
 * Each publisher broadcasts a specific event to the orders exchange.
 * Consumers subscribe using defineEventConsumer with optional routing key overrides.
 */
const orderCreatedEvent = defineEventPublisher(ordersExchange, orderMessage, {
  routingKey: "order.created",
});

const orderShippedEvent = defineEventPublisher(ordersExchange, orderStatusMessage, {
  routingKey: "order.shipped",
});

/**
 * Virtual event publisher for the notifications consumer.
 *
 * This is not added to the publishers section since it's only used to define
 * the consumer's message type (union of all order event schemas) and binding
 * with a wildcard routing key (order.#).
 */
const allOrderEvents = defineEventPublisher(ordersExchange, orderUnionMessage, {
  routingKey: "order.created",
});

/**
 * Virtual event publisher for the urgent orders consumer.
 *
 * Used to define the binding with the wildcard pattern order.*.urgent.
 */
const urgentOrderEvents = defineEventPublisher(ordersExchange, orderStatusMessage, {
  routingKey: "order.updated.urgent",
});

/**
 * Virtual event publisher for the DLX consumer.
 *
 * Used to bind the DLX queue to the dead letter exchange.
 */
const failedOrderEvent = defineEventPublisher(ordersDlx, orderMessage, {
  routingKey: "order.failed",
});

/**
 * Order processing contract demonstrating the event pattern.
 *
 * This contract demonstrates:
 * 1. Event Pattern: publishers broadcast events, consumers subscribe with routing key overrides
 * 2. Dead Letter Exchange: Failed messages from orderProcessingQueue are routed to DLX
 * 3. Topic Exchange Wildcards: Consumers use patterns like order.# and order.*.urgent
 *
 * Exchanges, queues, and bindings are automatically extracted from publishers and consumers.
 */
export const orderContract = defineContract({
  publishers: {
    orderCreated: orderCreatedEvent,
    orderShipped: orderShippedEvent,
    orderUpdated: definePublisher(ordersExchange, orderStatusMessage, {
      routingKey: "order.updated",
    }),
    orderUrgentUpdate: definePublisher(ordersExchange, orderStatusMessage, {
      routingKey: "order.updated.urgent",
    }),
  },
  consumers: {
    // Event consumer: subscribes to order.created events
    processOrder: defineEventConsumer(orderCreatedEvent, orderProcessingQueue),

    // Event consumer with routing key override: subscribes to ALL order events
    notifyOrder: defineEventConsumer(allOrderEvents, orderNotificationsQueue, {
      routingKey: "order.#",
    }),

    // Event consumer: subscribes to order.shipped events
    shipOrder: defineEventConsumer(orderShippedEvent, orderShippingQueue),

    // Event consumer with routing key override: subscribes to urgent events
    handleUrgentOrder: defineEventConsumer(urgentOrderEvents, orderUrgentQueue, {
      routingKey: "order.*.urgent",
    }),

    // DLX consumer: receives failed messages
    handleFailedOrders: defineEventConsumer(failedOrderEvent, ordersDlxQueue),
  },
});
