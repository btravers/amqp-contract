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
 * RECOMMENDED APPROACH: Publisher-First Pattern (Event-Oriented)
 *
 * Use this for events where publishers don't need to know about queues.
 * Multiple consumers can subscribe to the same event.
 */
const { publisher: orderCreatedPublisher, createConsumer: createOrderCreatedConsumer } =
  definePublisherFirst(ordersExchange, orderMessage, {
    routingKey: "order.created",
  });

// Create consumer for processing queue using publisher-first pattern
// We use the binding from this but define the actual consumer with retry policy below
const { binding: processOrderBinding } = createOrderCreatedConsumer(orderProcessingQueue);

// Add retry policy to the consumer for robust error handling
const processOrderConsumerWithRetry = defineConsumer(orderProcessingQueue, orderMessage, {
  retryPolicy: {
    maxAttempts: 3,
    backoff: {
      type: "exponential",
      initialInterval: 1000,
      maxInterval: 60000,
      coefficient: 2,
    },
  },
});

/**
 * RECOMMENDED APPROACH: Consumer-First Pattern (Command-Oriented)
 *
 * Use this for commands where the consumer defines what it expects.
 */
const {
  consumer: shipOrderConsumer,
  binding: shipOrderBinding,
  createPublisher: createShipOrderPublisher,
} = defineConsumerFirst(orderShippingQueue, ordersExchange, orderStatusMessage, {
  routingKey: "order.shipped",
});

/**
 * Order processing contract demonstrating recommended patterns
 *
 * This contract demonstrates:
 * 1. Publisher-First Pattern: createOrderCreatedConsumer can be used by multiple queues
 * 2. Consumer-First Pattern: shipOrderConsumer ensures publisher matches consumer
 * 3. Traditional Approach: For advanced scenarios like exchange-to-exchange bindings
 * 4. Dead Letter Exchange: Failed messages from orderProcessingQueue are routed to DLX
 * 5. Retry Policies: Configured with exponential backoff to prevent infinite loops
 *
 * Benefits of Publisher-First / Consumer-First:
 * - Guaranteed message schema consistency
 * - Automatic routing key synchronization
 * - Type-safe contract definitions
 *
 * Dead Letter Exchange Pattern:
 * - Failed or rejected messages are automatically routed to a DLX
 * - Messages that exceed TTL are moved to DLX
 * - Enables message retry and error handling strategies
 *
 * Retry Policy Pattern:
 * - Prevents infinite retry loops with maxRetries limit
 * - Exponential backoff reduces load during outages
 * - Messages exceeding retry limit are sent to DLX for inspection
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
    // Binding from Publisher-First pattern (guaranteed consistent routing key)
    orderProcessingBinding: processOrderBinding,

    // Traditional approach for notifications queue to receive ALL order events
    // (Use wildcard pattern for notifications that need all events)
    orderNotificationsBinding: defineQueueBinding(orderNotificationsQueue, ordersExchange, {
      routingKey: "order.#",
    }),

    // Binding from Consumer-First pattern (guaranteed consistent routing key)
    orderShippingBinding: shipOrderBinding,

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

    // Bind DLX queue to DLX to collect failed messages
    ordersDlxBinding: defineQueueBinding(ordersDlxQueue, ordersDlx, {
      routingKey: "order.failed",
    }),
  },
  publishers: {
    // Publisher from Publisher-First pattern (event-oriented)
    orderCreated: orderCreatedPublisher,

    // Publisher from Consumer-First pattern (command-oriented)
    orderShipped: createShipOrderPublisher("order.shipped"),

    // Traditional publishers (for other events)
    orderUpdated: definePublisher(ordersExchange, orderStatusMessage, {
      routingKey: "order.updated",
    }),

    orderUrgentUpdate: definePublisher(ordersExchange, orderStatusMessage, {
      routingKey: "order.updated.urgent",
    }),
  },
  consumers: {
    // Consumer with retry policy for production use (prevents infinite loops)
    processOrder: processOrderConsumerWithRetry,

    // Traditional consumer for notifications (receives all order events via wildcard)
    notifyOrder: defineConsumer(orderNotificationsQueue, orderUnionMessage),

    // Consumer from Consumer-First pattern
    shipOrder: shipOrderConsumer,

    // Traditional consumers (for other scenarios)
    handleUrgentOrder: defineConsumer(orderUrgentQueue, orderStatusMessage),
    processAnalytics: defineConsumer(analyticsProcessingQueue, orderUnionMessage),

    // Consumer for dead letter queue (handles failed messages)
    // No retry policy needed here as these are already failed messages
    handleFailedOrders: defineConsumer(ordersDlxQueue, orderMessage),
  },
});
