/* eslint-disable sort-imports */
import pino from "pino";
import { initializeTelemetry } from "./telemetry.js";
import { WorkerInstrumentation, WorkerMetrics } from "@amqp-contract/opentelemetry";
import { TypedAmqpWorker } from "@amqp-contract/worker";
import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";
import { metrics, trace } from "@opentelemetry/api";
/* eslint-enable sort-imports */

// Initialize OpenTelemetry SDK before creating workers
const sdk = initializeTelemetry("order-service-worker");

const logger = pino({
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
    },
  },
});

/**
 * Order Worker Application with OpenTelemetry
 *
 * This application demonstrates:
 * 1. OpenTelemetry SDK initialization
 * 2. Worker instrumentation with tracing and metrics
 * 3. Automatic trace context extraction from messages
 * 4. Processing orders with distributed tracing
 * 5. Parent-child span relationships across services
 */
async function main() {
  logger.info("Starting Order Service Worker with OpenTelemetry...");

  // Get tracer and meter for this service
  const tracer = trace.getTracer("order-service-worker", "1.0.0");
  const meter = metrics.getMeter("order-service-worker", "1.0.0");

  // Create OpenTelemetry instrumentation and metrics
  const instrumentation = new WorkerInstrumentation({
    tracer,
    enableTracing: true,
  });

  const workerMetrics = new WorkerMetrics({
    meter,
  });

  // Create the AMQP worker with OpenTelemetry
  const workerResult = await TypedAmqpWorker.create({
    contract: orderContract,
    handlers: {
      // Handler for processing new orders
      // The span created here will be a child of the publisher's span
      processOrder: async (message) => {
        const { orderId, customerId, totalAmount } = message;

        logger.info({ orderId, customerId, totalAmount }, "📦 Processing order...");

        // Create a custom span for inventory check
        const inventorySpan = tracer.startSpan("check-inventory");
        inventorySpan.setAttribute("order.id", orderId);
        inventorySpan.setAttribute("order.amount", totalAmount);

        try {
          // Simulate inventory check
          await new Promise((resolve) => setTimeout(resolve, 100));

          if (totalAmount > 1000) {
            // Simulate inventory shortage for large orders
            inventorySpan.addEvent("inventory-shortage", {
              "order.id": orderId,
              "required.amount": totalAmount,
            });
            logger.warn({ orderId }, "⚠️  Inventory shortage for large order");
          } else {
            inventorySpan.addEvent("inventory-available");
            logger.info({ orderId }, "✅ Inventory available");
          }

          inventorySpan.setStatus({ code: 1 }); // OK
        } catch (error) {
          inventorySpan.recordException(error as Error);
          inventorySpan.setStatus({ code: 2 }); // ERROR
          throw error;
        } finally {
          inventorySpan.end();
        }

        // Create a custom span for payment processing
        const paymentSpan = tracer.startSpan("process-payment");
        paymentSpan.setAttribute("order.id", orderId);
        paymentSpan.setAttribute("payment.amount", totalAmount);

        try {
          // Simulate payment processing
          await new Promise((resolve) => setTimeout(resolve, 150));

          paymentSpan.addEvent("payment-captured", {
            "order.id": orderId,
            "payment.amount": totalAmount,
          });

          logger.info({ orderId, totalAmount }, "💳 Payment processed");
          paymentSpan.setStatus({ code: 1 }); // OK
        } catch (error) {
          paymentSpan.recordException(error as Error);
          paymentSpan.setStatus({ code: 2 }); // ERROR
          throw error;
        } finally {
          paymentSpan.end();
        }

        logger.info({ orderId }, "✅ Order processed successfully");
      },

      // Handler for order notifications (receives all order events)
      notifyOrder: async (message) => {
        if ("orderId" in message && "items" in message) {
          // It's an order created event
          logger.info({ orderId: message.orderId }, "📧 Sending order confirmation email");
        } else if ("orderId" in message && "status" in message) {
          // It's an order status update
          logger.info(
            { orderId: message.orderId, status: message.status },
            "📧 Sending status update email",
          );
        }

        // Simulate email sending
        await new Promise((resolve) => setTimeout(resolve, 50));
      },

      // Handler for shipping orders
      shipOrder: async (message) => {
        logger.info({ orderId: message.orderId }, "📦 Processing shipment");
        await new Promise((resolve) => setTimeout(resolve, 100));
      },

      // Handler for urgent orders
      handleUrgentOrder: async (message) => {
        logger.info(
          { orderId: message.orderId, status: message.status },
          "🚨 Handling urgent order",
        );
        await new Promise((resolve) => setTimeout(resolve, 50));
      },

      // Handler for analytics
      processAnalytics: async (_message) => {
        logger.info("📊 Processing analytics");
        await new Promise((resolve) => setTimeout(resolve, 50));
      },

      // Handler for failed orders (DLX)
      handleFailedOrders: async (message) => {
        logger.error({ orderId: message.orderId }, "💀 Handling failed order from DLX");
        await new Promise((resolve) => setTimeout(resolve, 50));
      },
    },
    urls: [(process.env["AMQP_URL"] as string | undefined) || "amqp://localhost"],
    instrumentation,
    metrics: workerMetrics,
  }).resultToPromise();

  logger.info("✅ Worker started with OpenTelemetry instrumentation");
  logger.info("Waiting for messages... (Press Ctrl+C to exit)");

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    logger.info("Shutting down worker...");
    await workerResult.close().resultToPromise();
    await sdk.shutdown();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
