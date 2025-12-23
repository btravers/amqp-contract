import { generateAsyncAPI } from "@amqp-contract/asyncapi";
import {
  defineQueueBinding,
  defineConsumer,
  defineContract,
  defineExchange,
  definePublisher,
  defineQueue,
} from "@amqp-contract/contract";
import { writeFileSync } from "fs";
import { z } from "zod";

// Define the contract
const orderContract = defineContract({
  exchanges: {
    orders: defineExchange("orders", "topic", { durable: true }),
    notifications: defineExchange("notifications", "fanout", { durable: true }),
  },
  queues: {
    orderProcessing: defineQueue("order-processing", { durable: true }),
    orderNotifications: defineQueue("order-notifications", { durable: true }),
    emailNotifications: defineQueue("email-notifications", { durable: true }),
  },
  bindings: {
    orderProcessingBinding: defineQueueBinding("order-processing", "orders", {
      routingKey: "order.created",
    }),
    orderNotificationsBinding: defineQueueBinding("order-notifications", "orders", {
      routingKey: "order.created",
    }),
    emailNotificationsBinding: defineQueueBinding("email-notifications", "notifications"),
  },
  publishers: {
    orderCreated: definePublisher(
      "orders",
      z.object({
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
      }),
      {
        routingKey: "order.created",
      },
    ),
    notificationSent: definePublisher(
      "notifications",
      z.object({
        notificationId: z.string(),
        recipientId: z.string(),
        type: z.enum(["email", "sms", "push"]),
        subject: z.string(),
        message: z.string(),
        sentAt: z.string().datetime(),
      }),
    ),
  },
  consumers: {
    processOrder: defineConsumer(
      "order-processing",
      z.object({
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
      }),
      {
        prefetch: 10,
      },
    ),
    notifyOrder: defineConsumer(
      "order-notifications",
      z.object({
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
      }),
      {
        prefetch: 5,
      },
    ),
    sendEmail: defineConsumer(
      "email-notifications",
      z.object({
        notificationId: z.string(),
        recipientId: z.string(),
        type: z.enum(["email", "sms", "push"]),
        subject: z.string(),
        message: z.string(),
        sentAt: z.string().datetime(),
      }),
      {
        prefetch: 20,
      },
    ),
  },
});

// Generate AsyncAPI specification
const asyncAPISpec = generateAsyncAPI(orderContract, {
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
