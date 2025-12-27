import { AppModule } from "./app.module.js";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

async function bootstrap() {
  const logger = new Logger("Bootstrap");

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["log", "error", "warn", "debug", "verbose"],
  });

  logger.log("=".repeat(60));
  logger.log("NestJS Worker ready, waiting for messages...");
  logger.log("=".repeat(60));
  logger.log("Subscribed to:");
  logger.log("  • order.created     → processOrder handler");
  logger.log("  • order.#           → notifyOrder handler (all events)");
  logger.log("  • order.shipped     → shipOrder handler");
  logger.log("  • order.*.urgent    → handleUrgentOrder handler");
  logger.log("  • order.# (via analytics exchange) → processAnalytics handler");
  logger.log("=".repeat(60));
  logger.log("Exchange-to-Exchange Binding:");
  logger.log("  orders → order-analytics (routing: order.#)");
  logger.log("=".repeat(60));

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    logger.log("Shutting down worker...");
    await app.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    logger.log("Shutting down worker...");
    await app.close();
    process.exit(0);
  });
}

bootstrap().catch((error) => {
  console.error("Bootstrap error:", error);
  process.exit(1);
});
