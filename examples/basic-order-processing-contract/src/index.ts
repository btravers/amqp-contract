import {
  defineCommandConsumer,
  defineCommandPublisher,
  defineConsumer,
  defineContract,
  defineEventConsumer,
  defineEventPublisher,
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

// Define dead letter exchange for failed messages
const ordersDlx = defineExchange("orders-dlx", "topic", { durable: true });

// Define queues so they can be referenced
const orderProcessingQueue = defineQueue("order-processing", {
  durable: true,
  // Configure dead letter exchange for failed order processing
  deadLetter: {
    exchange: ordersDlx,
    routingKey: "order.failed",
  },
  // Optional: Add message TTL (time-to-live) to automatically move old messages to DLX
  arguments: {
    "x-message-ttl": 86400000, // 24 hours
  },
});
const orderNotificationsQueue = defineQueue("order-notifications", { durable: true });
const orderShippingQueue = defineQueue("order-shipping", { durable: true });
const orderUrgentQueue = defineQueue("order-urgent", { durable: true });
const analyticsProcessingQueue = defineQueue("analytics-processing", { durable: true });

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
 * RECOMMENDED APPROACH: Event Pattern (Publisher → Consumer)
 *
 * Use this for events where publishers broadcast without knowing who consumes.
 * Multiple consumers can subscribe to the same event.
 */
const orderCreatedEvent = defineEventPublisher(ordersExchange, orderMessage, {
  routingKey: "order.created",
});

/**
 * RECOMMENDED APPROACH: Command Pattern (Consumer → Publisher)
 *
 * Use this for commands where the consumer "owns" the queue and
 * publishers send commands to it.
 */
const shipOrderCommand = defineCommandConsumer(
  orderShippingQueue,
  ordersExchange,
  orderStatusMessage,
  {
    routingKey: "order.shipped",
  },
);

// Create publisher that sends ship orders
const shipOrderPublisher = defineCommandPublisher(shipOrderCommand);

/**
 * Order processing contract demonstrating recommended patterns
 *
 * This contract demonstrates:
 * 1. Event Pattern: orderCreatedEvent broadcasts to multiple consumers
 * 2. Command Pattern: shipOrderCommand ensures publisher matches consumer
 * 3. Traditional Approach: For advanced scenarios like exchange-to-exchange bindings
 * 4. Dead Letter Exchange: Failed messages from orderProcessingQueue are routed to DLX
 *
 * Benefits of Event / Command patterns:
 * - Guaranteed message schema consistency
 * - Automatic routing key synchronization
 * - Type-safe contract definitions
 *
 * Dead Letter Exchange Pattern:
 * - Failed or rejected messages are automatically routed to a DLX
 * - Messages that exceed TTL are moved to DLX
 * - Enables message retry and error handling strategies
 */
export const orderContract = defineContract({
  exchanges: {
    // Primary exchange for all orders
    orders: ordersExchange,

    // Secondary exchange for analytics (receives filtered events from orders exchange)
    orderAnalytics: orderAnalyticsExchange,

    // Dead letter exchange for failed messages
    ordersDlx,
  },
  queues: {
    // Queue for processing all new orders (with DLX configuration)
    orderProcessing: orderProcessingQueue,

    // Queue for all notifications (subscribes to all order events)
    orderNotifications: orderNotificationsQueue,

    // Queue for shipping department (only shipped orders)
    orderShipping: orderShippingQueue,

    // Queue for urgent orders (any urgent event)
    orderUrgent: orderUrgentQueue,

    // Queue for analytics (receives events through orderAnalytics exchange)
    analyticsProcessing: analyticsProcessingQueue,

    // Dead letter queue to collect failed messages
    ordersDlxQueue,
  },
  bindings: {
    // Traditional approach for notifications queue to receive ALL order events
    // (Use wildcard pattern for notifications that need all events)
    orderNotificationsBinding: defineQueueBinding(orderNotificationsQueue, ordersExchange, {
      routingKey: "order.#",
    }),

    // Exchange-to-Exchange binding: Route all order events to analytics exchange
    // (Use traditional approach for complex routing patterns)
    orderToAnalytics: defineExchangeBinding(orderAnalyticsExchange, ordersExchange, {
      routingKey: "order.#",
    }),

    // Traditional approach for urgent queue (when not using Event/Command patterns)
    orderUrgentBinding: defineQueueBinding(orderUrgentQueue, ordersExchange, {
      routingKey: "order.*.urgent",
    }),

    // Bind analytics queue to analytics exchange for all events
    analyticsBinding: defineQueueBinding(analyticsProcessingQueue, orderAnalyticsExchange, {
      routingKey: "order.#",
    }),

    // Bind DLX queue to DLX to collect failed messages
    ordersDlxBinding: defineQueueBinding(ordersDlxQueue, ordersDlx, {
      routingKey: "order.failed",
    }),
  },
  publishers: {
    // Publisher from Event pattern (event-oriented broadcast)
    // EventPublisherConfig → auto-extracted to publisher
    orderCreated: orderCreatedEvent,

    // Publisher from Command pattern (command-oriented)
    orderShipped: shipOrderPublisher,

    // Traditional publishers (for other events)
    orderUpdated: definePublisher(ordersExchange, orderStatusMessage, {
      routingKey: "order.updated",
    }),

    orderUrgentUpdate: definePublisher(ordersExchange, orderStatusMessage, {
      routingKey: "order.updated.urgent",
    }),
  },
  consumers: {
    // Consumer from Event pattern (same message schema guaranteed)
    // EventConsumerResult → auto-extracted to consumer + binding
    processOrder: defineEventConsumer(orderCreatedEvent, orderProcessingQueue),

    // Consumer from Command pattern (same message schema guaranteed)
    // CommandConsumerConfig → auto-extracted to consumer + binding
    shipOrder: shipOrderCommand,

    // Traditional consumer for notifications (receives all order events via wildcard)
    notifyOrder: defineConsumer(orderNotificationsQueue, orderUnionMessage),

    // Traditional consumers (for other scenarios)
    handleUrgentOrder: defineConsumer(orderUrgentQueue, orderStatusMessage),
    processAnalytics: defineConsumer(analyticsProcessingQueue, orderUnionMessage),

    // Consumer for dead letter queue (handles failed messages)
    handleFailedOrders: defineConsumer(ordersDlxQueue, orderMessage),
  },
});
