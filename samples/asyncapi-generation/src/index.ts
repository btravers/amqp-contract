import {
  defineConsumer,
  defineContract,
  defineExchange,
  defineMessage,
  definePublisher,
  defineQueue,
  defineQueueBinding,
} from "@amqp-contract/contract";
import { AsyncAPIGenerator } from "@amqp-contract/asyncapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod";
import { writeFileSync } from "fs";
import { z } from "zod";

// Define exchanges
const ordersExchange = defineExchange("orders", "topic", { durable: true });
const notificationsExchange = defineExchange("notifications", "fanout", { durable: true });

// Define queues
const orderProcessingQueue = defineQueue("order-processing", { durable: true });
const orderNotificationsQueue = defineQueue("order-notifications", { durable: true });
const emailNotificationsQueue = defineQueue("email-notifications", { durable: true });

// Define message schemas
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

const notificationSchema = z.object({
  notificationId: z.string(),
  recipientId: z.string(),
  type: z.enum(["email", "sms", "push"]),
  subject: z.string(),
  message: z.string(),
  sentAt: z.string().datetime(),
});

// Define messages with metadata
const orderMessage = defineMessage(orderSchema, {
  summary: "Order created event",
  description: "Emitted when a new order is created in the system",
});

const notificationMessage = defineMessage(notificationSchema, {
  summary: "Notification sent event",
  description: "Emitted when a notification is sent to a user",
});

// Define the contract
const orderContract = defineContract({
  exchanges: {
    orders: ordersExchange,
    notifications: notificationsExchange,
  },
  queues: {
    orderProcessing: orderProcessingQueue,
    orderNotifications: orderNotificationsQueue,
    emailNotifications: emailNotificationsQueue,
  },
  bindings: {
    orderProcessingBinding: defineQueueBinding(orderProcessingQueue, ordersExchange, {
      routingKey: "order.created",
    }),
    orderNotificationsBinding: defineQueueBinding(orderNotificationsQueue, ordersExchange, {
      routingKey: "order.created",
    }),
    emailNotificationsBinding: defineQueueBinding(emailNotificationsQueue, notificationsExchange),
  },
  publishers: {
    orderCreated: definePublisher(ordersExchange, orderMessage, {
      routingKey: "order.created",
    }),
    notificationSent: definePublisher(notificationsExchange, notificationMessage),
  },
  consumers: {
    processOrder: defineConsumer(orderProcessingQueue, orderMessage),
    notifyOrder: defineConsumer(orderNotificationsQueue, orderMessage),
    sendEmail: defineConsumer(emailNotificationsQueue, notificationMessage),
  },
});

// Generate AsyncAPI specification
const generator = new AsyncAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
});

const asyncAPISpec = await generator.generate(orderContract, {
  info: {
    title: "Order Processing API",
    version: "1.0.0",
    description: "Type-safe AMQP messaging API for order processing and notifications",
    contact: {
      name: "API Support",
      email: "support@example.com",
    },
    license: {
      name: "MIT",
    },
  },
  servers: {
    development: {
      host: "localhost:5672",
      protocol: "amqp",
      description: "Development RabbitMQ server",
    },
    staging: {
      host: "rabbitmq-staging.example.com:5672",
      protocol: "amqp",
      description: "Staging RabbitMQ server",
    },
    production: {
      host: "rabbitmq.example.com:5672",
      protocol: "amqp",
      description: "Production RabbitMQ server",
    },
  },
});

// Write to file
writeFileSync("asyncapi.json", JSON.stringify(asyncAPISpec, null, 2));
console.log("✅ AsyncAPI specification generated: asyncapi.json");

// Also write to YAML format (as JSON can be converted to YAML easily)
writeFileSync(
  "asyncapi.yaml",
  `# AsyncAPI 3.0.0 Specification
# Generated from amqp-contract

# This is a simplified YAML representation
# For full YAML support, consider using a JSON-to-YAML converter

asyncapi: '3.0.0'
info:
  title: ${asyncAPISpec.info.title}
  version: ${asyncAPISpec.info.version}
  description: ${asyncAPISpec.info.description}

# See asyncapi.json for the complete specification
`,
);
console.log("✅ AsyncAPI specification generated: asyncapi.yaml");

// Print summary
console.log("\nSummary:");
console.log(`- Channels: ${Object.keys(asyncAPISpec.channels ?? {}).length}`);
console.log(`- Operations: ${Object.keys(asyncAPISpec.operations ?? {}).length}`);
console.log(`- Messages: ${Object.keys(asyncAPISpec.components?.messages ?? {}).length}`);
console.log(`- Servers: ${Object.keys(asyncAPISpec.servers ?? {}).length}`);
