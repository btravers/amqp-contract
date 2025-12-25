import {
  defineConsumer,
  defineConsumerFirst,
  defineContract,
  defineExchange,
  defineExchangeBinding,
  defineMessage,
  definePublisher,
  definePublisherFirst,
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
 * RECOMMENDED APPROACH: Publisher-First Pattern (Event-Oriented)
 *
 * Use this for events where publishers don't need to know about queues.
 * Multiple consumers can subscribe to the same event.
 */
const orderCreatedEvent = definePublisherFirst(ordersExchange, orderMessage, {
  routingKey: "order.created",
});

// Multiple consumers can be created from the same event
const { consumer: processOrderConsumer, binding: processOrderBinding } =
  orderCreatedEvent.createConsumer(orderProcessingQueue);
const { consumer: notifyOrderConsumer, binding: notifyOrderBinding } =
  orderCreatedEvent.createConsumer(orderNotificationsQueue);

/**
 * RECOMMENDED APPROACH: Consumer-First Pattern (Command-Oriented)
 *
 * Use this for commands where the consumer defines what it expects.
 */
const shipOrderCommand = defineConsumerFirst(
  orderShippingQueue,
  ordersExchange,
  orderStatusMessage,
  { routingKey: "order.shipped" },
);

/**
 * Order processing contract demonstrating recommended patterns
 *
 * This contract demonstrates:
 * 1. Publisher-First Pattern: orderCreatedEvent can be consumed by multiple queues
 * 2. Consumer-First Pattern: shipOrderCommand ensures publisher matches consumer
 * 3. Traditional Approach: For advanced scenarios like exchange-to-exchange bindings
 *
 * Benefits of Publisher-First / Consumer-First:
 * - Guaranteed message schema consistency
 * - Automatic routing key synchronization
 * - Type-safe contract definitions
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
    // Bindings from Publisher-First pattern (guaranteed consistent routing keys)
    orderProcessingBinding: processOrderBinding,
    orderNotificationsBinding: notifyOrderBinding,

    // Binding from Consumer-First pattern (guaranteed consistent routing key)
    orderShippingBinding: shipOrderCommand.binding,

    // Exchange-to-Exchange binding: Route all order events to analytics exchange
    // (Use traditional approach for complex routing patterns)
    orderToAnalytics: defineExchangeBinding(orderAnalyticsExchange, ordersExchange, {
      routingKey: "order.#",
    }),

    // Traditional approach for urgent queue (when not using Publisher/Consumer-First)
    orderUrgentBinding: defineQueueBinding(orderUrgentQueue, ordersExchange, {
      routingKey: "order.*.urgent",
    }),

    // Bind analytics queue to analytics exchange for all events
    analyticsBinding: defineQueueBinding(analyticsProcessingQueue, orderAnalyticsExchange, {
      routingKey: "order.#",
    }),
  },
  publishers: {
    // Publisher from Publisher-First pattern (event-oriented)
    orderCreated: orderCreatedEvent.publisher,

    // Publisher from Consumer-First pattern (command-oriented)
    orderShipped: shipOrderCommand.createPublisher(),

    // Traditional publishers (for other events)
    orderUpdated: definePublisher(ordersExchange, orderStatusMessage, {
      routingKey: "order.updated",
    }),

    orderUrgentUpdate: definePublisher(ordersExchange, orderStatusMessage, {
      routingKey: "order.updated.urgent",
    }),
  },
  consumers: {
    // Consumers from Publisher-First pattern (same message schema guaranteed)
    processOrder: processOrderConsumer,
    notifyOrder: notifyOrderConsumer,

    // Consumer from Consumer-First pattern
    shipOrder: shipOrderCommand.consumer,

    // Traditional consumers (for other scenarios)
    handleUrgentOrder: defineConsumer(orderUrgentQueue, orderStatusMessage),
    processAnalytics: defineConsumer(analyticsProcessingQueue, orderUnionMessage),
  },
});
