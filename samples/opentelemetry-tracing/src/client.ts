import { TypedAmqpClient } from "@amqp-contract/client";
import { ClientInstrumentation, ClientMetrics } from "@amqp-contract/opentelemetry";
import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";
import { trace, metrics } from "@opentelemetry/api";
import pino from "pino";
import { initializeTelemetry } from "./telemetry.js";

// Initialize OpenTelemetry SDK before creating clients
const sdk = initializeTelemetry("order-service-client");

const logger = pino({
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
    },
  },
});

/**
 * Order Publisher Application with OpenTelemetry
 *
 * This application demonstrates:
 * 1. OpenTelemetry SDK initialization
 * 2. Client instrumentation with tracing and metrics
 * 3. Automatic trace context injection into messages
 * 4. Publishing orders with distributed tracing
 */
async function main() {
  logger.info("Starting Order Service Client with OpenTelemetry...");

  // Get tracer and meter for this service
  const tracer = trace.getTracer("order-service-client", "1.0.0");
  const meter = metrics.getMeter("order-service-client", "1.0.0");

  // Create OpenTelemetry instrumentation and metrics
  const instrumentation = new ClientInstrumentation({
    tracer,
    enableTracing: true,
  });

  const clientMetrics = new ClientMetrics({
    meter,
  });

  // Create the AMQP client with OpenTelemetry
  const clientResult = await TypedAmqpClient.create({
    contract: orderContract,
    urls: [process.env.AMQP_URL || "amqp://localhost"],
    instrumentation,
    metrics: clientMetrics,
  });

  if (clientResult.isError()) {
    logger.error({ error: clientResult.error }, "Failed to create client");
    process.exit(1);
  }

  const client = clientResult.get();
  logger.info("✅ Client connected with OpenTelemetry instrumentation");

  // Simulate publishing orders periodically
  let orderCount = 0;

  const publishInterval = setInterval(async () => {
    orderCount++;
    const orderId = `ORD-${Date.now()}-${orderCount}`;

    logger.info({ orderId }, "Publishing order...");

    // Create a span for the business logic
    const span = tracer.startSpan("create-order");
    span.setAttribute("order.id", orderId);
    span.setAttribute("order.count", orderCount);

    try {
      // Publish the order - automatically creates a child span
      // and injects trace context into message headers
      const result = await client
        .publish("orderCreated", {
          orderId,
          customerId: `CUST-${Math.floor(Math.random() * 1000)}`,
          items: [
            {
              productId: `PROD-${Math.floor(Math.random() * 100)}`,
              quantity: Math.floor(Math.random() * 5) + 1,
              price: Math.floor(Math.random() * 100) + 10,
            },
          ],
          totalAmount: Math.floor(Math.random() * 500) + 50,
          createdAt: new Date().toISOString(),
        })
        .resultToPromise();

      if (result.isError()) {
        logger.error({ error: result.error, orderId }, "❌ Failed to publish order");
        span.recordException(result.error);
        span.setStatus({ code: 2, message: result.error.message }); // ERROR
      } else {
        logger.info({ orderId }, "✅ Order published successfully");
        span.setStatus({ code: 1 }); // OK
      }
    } catch (error) {
      logger.error({ error, orderId }, "❌ Unexpected error");
      span.recordException(error as Error);
      span.setStatus({ code: 2 }); // ERROR
    } finally {
      span.end();
    }

    // Stop after 10 orders for this demo
    if (orderCount >= 10) {
      clearInterval(publishInterval);
      logger.info("Published 10 orders. Shutting down...");
      await client.close().resultToPromise();
      await sdk.shutdown();
      process.exit(0);
    }
  }, 2000); // Publish every 2 seconds

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    clearInterval(publishInterval);
    logger.info("Shutting down client...");
    await client.close().resultToPromise();
    await sdk.shutdown();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
