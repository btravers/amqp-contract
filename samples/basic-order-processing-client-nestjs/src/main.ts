import {
  CreateOrderUseCase,
  ShipOrderUseCase,
  UpdateOrderStatusUseCase,
  UrgentUpdateUseCase,
} from "./use-cases/index.js";
import { Logger } from "@nestjs/common";
import { bootstrap } from "./bootstrap.js";

/**
 * Demo scenario - publishes sample orders to demonstrate the AMQP client
 * This is separate from the application bootstrap to maintain clean architecture
 */
async function runDemo(): Promise<void> {
  const logger = new Logger("Demo");

  // Bootstrap the application
  const app = await bootstrap();

  try {
    // Get use cases directly from DI container
    const createOrderUseCase = app.get(CreateOrderUseCase);
    const updateOrderStatusUseCase = app.get(UpdateOrderStatusUseCase);
    const shipOrderUseCase = app.get(ShipOrderUseCase);
    const urgentUpdateUseCase = app.get(UrgentUpdateUseCase);

    logger.log("=".repeat(60));
    logger.log("NestJS Client ready - Publishing orders");
    logger.log("=".repeat(60));

    // Helper to await Future<Result> and handle errors
    const executeUseCase = async (
      future: ReturnType<
        | typeof createOrderUseCase.execute
        | typeof updateOrderStatusUseCase.execute
        | typeof shipOrderUseCase.execute
        | typeof urgentUpdateUseCase.execute
      >,
      errorMessage: string,
    ): Promise<void> => {
      const result = await future.resultToPromise();
      if (result.isError()) {
        logger.error(errorMessage, result.error);
        throw result.error;
      }
    };

    // 1. Publish a new order (routing key: order.created)
    logger.log("1️⃣ Publishing NEW ORDER (order.created)");
    await executeUseCase(
      createOrderUseCase.execute({
        orderId: "ORD-001",
        customerId: "CUST-123",
        items: [
          { productId: "PROD-A", quantity: 2, price: 29.99 },
          { productId: "PROD-B", quantity: 1, price: 49.99 },
        ],
        totalAmount: 109.97,
      }),
      "Failed to create order ORD-001",
    );
    logger.log(`   ✓ Published order ORD-001`);
    logger.log(`   → Will be received by: processing & notifications queues`);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // 2. Publish a regular order update (routing key: order.updated)
    logger.log("2️⃣ Publishing ORDER UPDATE (order.updated)");
    await executeUseCase(
      updateOrderStatusUseCase.execute("ORD-001", "processing"),
      "Failed to update order ORD-001",
    );
    logger.log(`   ✓ Published update for ORD-001`);
    logger.log(`   → Will be received by: notifications queue only`);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // 3. Publish a shipped order (routing key: order.shipped)
    logger.log("3️⃣ Publishing ORDER SHIPPED (order.shipped)");
    await executeUseCase(shipOrderUseCase.execute("ORD-001"), "Failed to ship order ORD-001");
    logger.log(`   ✓ Published shipment for ORD-001`);
    logger.log(`   → Will be received by: notifications & shipping queues`);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // 4. Publish another new order
    logger.log("4️⃣ Publishing ANOTHER NEW ORDER (order.created)");
    await executeUseCase(
      createOrderUseCase.execute({
        orderId: "ORD-002",
        customerId: "CUST-456",
        items: [{ productId: "PROD-C", quantity: 3, price: 15.99 }],
        totalAmount: 47.97,
      }),
      "Failed to create order ORD-002",
    );
    logger.log(`   ✓ Published order ORD-002`);
    logger.log(`   → Will be received by: processing & notifications queues`);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // 5. Publish an urgent order update (routing key: order.updated.urgent)
    logger.log("5️⃣ Publishing URGENT ORDER UPDATE (order.updated.urgent)");
    await executeUseCase(
      urgentUpdateUseCase.execute("ORD-002", "cancelled"),
      "Failed to urgently update order ORD-002",
    );
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
