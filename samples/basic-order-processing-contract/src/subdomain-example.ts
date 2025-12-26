import {
  defineConsumer,
  defineContract,
  defineExchange,
  defineMessage,
  definePublisher,
  defineQueue,
  defineQueueBinding,
  mergeContracts,
} from "@amqp-contract/contract";
import { z } from "zod";

/**
 * Example: Splitting Contracts into Subdomains
 *
 * This example demonstrates how to split a large AMQP topology into logical
 * subdomains and merge them together. This approach is beneficial for:
 * - Large applications with multiple bounded contexts
 * - Team-owned contract modules
 * - Shared infrastructure that's reused across applications
 * - Testing subsets of your topology in isolation
 */

// ============================================================================
// Order Subdomain
// ============================================================================

const orderSchema = z.object({
  orderId: z.string(),
  customerId: z.string(),
  amount: z.number().positive(),
  createdAt: z.string().datetime(),
});

const ordersExchange = defineExchange("orders", "topic", { durable: true });
const orderProcessingQueue = defineQueue("order-processing", { durable: true });
const orderMessage = defineMessage(orderSchema, {
  summary: "Order created event",
  description: "Emitted when a new order is created in the system",
});

/**
 * Contract for the order subdomain.
 * Handles order creation and processing.
 */
export const orderContract = defineContract({
  exchanges: {
    orders: ordersExchange,
  },
  queues: {
    orderProcessing: orderProcessingQueue,
  },
  bindings: {
    orderBinding: defineQueueBinding(orderProcessingQueue, ordersExchange, {
      routingKey: "order.created",
    }),
  },
  publishers: {
    orderCreated: definePublisher(ordersExchange, orderMessage, {
      routingKey: "order.created",
    }),
  },
  consumers: {
    processOrder: defineConsumer(orderProcessingQueue, orderMessage),
  },
});

// ============================================================================
// Payment Subdomain
// ============================================================================

const paymentSchema = z.object({
  paymentId: z.string(),
  orderId: z.string(),
  amount: z.number().positive(),
  method: z.enum(["credit_card", "paypal", "bank_transfer"]),
  processedAt: z.string().datetime(),
});

const paymentsExchange = defineExchange("payments", "topic", { durable: true });
const paymentProcessingQueue = defineQueue("payment-processing", { durable: true });
const paymentMessage = defineMessage(paymentSchema, {
  summary: "Payment received event",
  description: "Emitted when a payment is successfully processed",
});

/**
 * Contract for the payment subdomain.
 * Handles payment processing and reconciliation.
 */
export const paymentContract = defineContract({
  exchanges: {
    payments: paymentsExchange,
  },
  queues: {
    paymentProcessing: paymentProcessingQueue,
  },
  bindings: {
    paymentBinding: defineQueueBinding(paymentProcessingQueue, paymentsExchange, {
      routingKey: "payment.received",
    }),
  },
  publishers: {
    paymentReceived: definePublisher(paymentsExchange, paymentMessage, {
      routingKey: "payment.received",
    }),
  },
  consumers: {
    processPayment: defineConsumer(paymentProcessingQueue, paymentMessage),
  },
});

// ============================================================================
// Notification Subdomain
// ============================================================================

const notificationSchema = z.object({
  recipientId: z.string(),
  recipientEmail: z.string().email(),
  subject: z.string(),
  body: z.string(),
  priority: z.enum(["low", "normal", "high", "urgent"]),
});

const notificationsExchange = defineExchange("notifications", "topic", { durable: true });
const emailQueue = defineQueue("email-notifications", { durable: true });
const smsQueue = defineQueue("sms-notifications", { durable: true });
const notificationMessage = defineMessage(notificationSchema, {
  summary: "Notification event",
  description: "Emitted when a notification needs to be sent to a user",
});

/**
 * Contract for the notification subdomain.
 * Handles email and SMS notifications.
 */
export const notificationContract = defineContract({
  exchanges: {
    notifications: notificationsExchange,
  },
  queues: {
    emailNotifications: emailQueue,
    smsNotifications: smsQueue,
  },
  bindings: {
    emailBinding: defineQueueBinding(emailQueue, notificationsExchange, {
      routingKey: "notification.email",
    }),
    smsBinding: defineQueueBinding(smsQueue, notificationsExchange, {
      routingKey: "notification.sms",
    }),
  },
  publishers: {
    sendEmail: definePublisher(notificationsExchange, notificationMessage, {
      routingKey: "notification.email",
    }),
    sendSms: definePublisher(notificationsExchange, notificationMessage, {
      routingKey: "notification.sms",
    }),
  },
  consumers: {
    processEmail: defineConsumer(emailQueue, notificationMessage),
    processSms: defineConsumer(smsQueue, notificationMessage),
  },
});

// ============================================================================
// Shared Infrastructure Contract
// ============================================================================

const deadLetterExchange = defineExchange("dlx", "topic", { durable: true });
const deadLetterQueue = defineQueue("dlq", { durable: true });

/**
 * Shared infrastructure contract.
 * Defines dead letter exchange and queue that can be used across all subdomains.
 */
export const sharedInfraContract = defineContract({
  exchanges: {
    deadLetter: deadLetterExchange,
  },
  queues: {
    deadLetterQueue: deadLetterQueue,
  },
  bindings: {
    dlqBinding: defineQueueBinding(deadLetterQueue, deadLetterExchange, {
      routingKey: "#",
    }),
  },
});

// ============================================================================
// Merged Application Contract
// ============================================================================

/**
 * Complete application contract.
 * Merges all subdomain contracts together into a single contract that can be
 * used with TypedAmqpClient and TypedAmqpWorker.
 *
 * Benefits of this approach:
 * - Each subdomain can be developed, tested, and maintained independently
 * - Different teams can own different subdomains
 * - Shared infrastructure is defined once and reused
 * - The merged contract provides end-to-end type safety across all domains
 */
export const applicationContract = mergeContracts(
  sharedInfraContract,
  orderContract,
  paymentContract,
  notificationContract,
);

/**
 * Usage Example:
 *
 * ```typescript
 * import { TypedAmqpClient } from '@amqp-contract/client';
 * import { applicationContract } from './subdomain-example';
 *
 * // Create client with merged contract
 * const client = await TypedAmqpClient.create({
 *   contract: applicationContract,
 *   connection: 'amqp://localhost'
 * });
 *
 * // All publishers from all subdomains are available
 * await client.publish('orderCreated', {
 *   orderId: 'ORD-123',
 *   customerId: 'CUST-456',
 *   amount: 99.99,
 *   createdAt: new Date().toISOString(),
 * });
 *
 * await client.publish('paymentReceived', {
 *   paymentId: 'PAY-789',
 *   orderId: 'ORD-123',
 *   amount: 99.99,
 *   method: 'credit_card',
 *   processedAt: new Date().toISOString(),
 * });
 *
 * await client.publish('sendEmail', {
 *   recipientId: 'CUST-456',
 *   recipientEmail: 'customer@example.com',
 *   subject: 'Order Confirmation',
 *   body: 'Your order has been confirmed!',
 *   priority: 'high',
 * });
 * ```
 */
