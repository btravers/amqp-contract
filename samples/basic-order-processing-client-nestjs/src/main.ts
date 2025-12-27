import { Logger } from "@nestjs/common";
import { OrderService } from "./order.service.js";
import { bootstrap } from "./bootstrap.js";

/**
 * Demo scenario - publishes sample orders to demonstrate the AMQP client
 * This is separate from the application bootstrap to maintain clean architecture
 */
async function runDemo() {
  const logger = new Logger("Demo");

  // Bootstrap the application
  const app = await bootstrap();

  try {
    const orderService = app.get(OrderService);

    logger.log("=".repeat(60));
    logger.log("NestJS Client ready - Publishing orders");
    logger.log("=".repeat(60));

    // 1. Publish a new order (routing key: order.created)
    logger.log("1️⃣ Publishing NEW ORDER (order.created)");
    await orderService.createOrder({
      orderId: "ORD-001",
      customerId: "CUST-123",
      items: [
        { productId: "PROD-A", quantity: 2, price: 29.99 },
        { productId: "PROD-B", quantity: 1, price: 49.99 },
      ],
      totalAmount: 109.97,
    });
    logger.log(`   ✓ Published order ORD-001`);
    logger.log(`   → Will be received by: processing & notifications queues`);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // 2. Publish a regular order update (routing key: order.updated)
    logger.log("2️⃣ Publishing ORDER UPDATE (order.updated)");
    await orderService.updateOrderStatus("ORD-001", "processing");
    logger.log(`   ✓ Published update for ORD-001`);
    logger.log(`   → Will be received by: notifications queue only`);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // 3. Publish a shipped order (routing key: order.shipped)
    logger.log("3️⃣ Publishing ORDER SHIPPED (order.shipped)");
    await orderService.shipOrder("ORD-001");
    logger.log(`   ✓ Published shipment for ORD-001`);
    logger.log(`   → Will be received by: notifications & shipping queues`);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // 4. Publish another new order
    logger.log("4️⃣ Publishing ANOTHER NEW ORDER (order.created)");
    await orderService.createOrder({
      orderId: "ORD-002",
      customerId: "CUST-456",
      items: [{ productId: "PROD-C", quantity: 3, price: 15.99 }],
      totalAmount: 47.97,
    });
    logger.log(`   ✓ Published order ORD-002`);
    logger.log(`   → Will be received by: processing & notifications queues`);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // 5. Publish an urgent order update (routing key: order.updated.urgent)
    logger.log("5️⃣ Publishing URGENT ORDER UPDATE (order.updated.urgent)");
    await orderService.urgentUpdate("ORD-002", "cancelled");
    logger.log(`   ✓ Published urgent update for ORD-002`);
    logger.log(`   → Will be received by: notifications & urgent queues`);

    logger.log("=".repeat(60));
    logger.log("All orders published!");
    logger.log("=".repeat(60));

    // Keep the connection open for a bit
    await new Promise((resolve) => setTimeout(resolve, 2000));
  } finally {
    await app.close();
    logger.log("Client stopped");
  }
}

runDemo().catch((error) => {
  console.error("Demo error:", error);
  process.exit(1);
});
