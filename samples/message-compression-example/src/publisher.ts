import { TypedAmqpClient } from "@amqp-contract/client";
import { contract } from "./contract.js";
import pino from "pino";
import { z } from "zod";
import * as crypto from "node:crypto";

const env = z
  .object({
    AMQP_URL: z.string().url().default("amqp://localhost:5672"),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  })
  .parse(process.env);

const logger = pino({
  level: env.LOG_LEVEL,
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
    },
  },
});

/**
 * Generate a large data payload for testing compression
 */
function generateLargePayload(id: string, itemCount: number) {
  const items = [];
  for (let i = 0; i < itemCount; i++) {
    items.push({
      name: `Item ${i}`,
      description: `This is a detailed description for item ${i}. It contains lots of text that will compress well. Lorem ipsum dolor sit amet, consectetur adipiscing elit.`,
      properties: {
        category: `Category ${i % 10}`,
        tags: [`tag${i}`, `tag${i + 1}`, `tag${i + 2}`],
        metadata: {
          createdBy: "system",
          version: "1.0.0",
          region: "us-east-1",
        },
      },
    });
  }

  return {
    id,
    timestamp: new Date().toISOString(),
    metadata: {
      source: "data-generator",
      environment: "production",
      version: "2.1.0",
      correlationId: `corr-${Date.now()}`,
      userId: `user-${crypto.randomInt(0, 1000)}`,
    },
    items,
  };
}

/**
 * Calculate size reduction percentage
 */
function calculateReduction(original: number, compressed: number): string {
  const reduction = ((original - compressed) / original) * 100;
  return reduction.toFixed(1);
}

async function main() {
  // Create type-safe client
  const client = await TypedAmqpClient.create({
    contract,
    urls: [env.AMQP_URL],
  })
    .tapError((error) => logger.error({ error }, "Failed to create client"))
    .resultToPromise();

  logger.info("Publisher ready - demonstrating message compression");
  logger.info("=".repeat(70));

  // Example 1: Small message - No compression
  logger.info("📦 Example 1: Publishing small message WITHOUT compression");
  const smallPayload = {
    id: "small-001",
    timestamp: new Date().toISOString(),
    value: 42,
  };
  const smallPayloadSize = JSON.stringify(smallPayload).length;

  await client
    .publish("smallData", smallPayload)
    .tapError((error) => logger.error({ error }, "Failed to publish"))
    .resultToPromise();

  logger.info(`   ✓ Published ${smallPayloadSize} bytes`);
  logger.info(`   → Small messages don't benefit from compression overhead`);
  logger.info("");
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Example 2: Large message - No compression (baseline)
  logger.info("📦 Example 2: Publishing large message WITHOUT compression (baseline)");
  const largePayload1 = generateLargePayload("large-001", 50);
  const largePayloadSize1 = JSON.stringify(largePayload1).length;

  const start1 = Date.now();
  await client
    .publish("largeData", largePayload1)
    .tapError((error) => logger.error({ error }, "Failed to publish"))
    .resultToPromise();
  const duration1 = Date.now() - start1;

  logger.info(`   ✓ Published ${largePayloadSize1} bytes in ${duration1}ms`);
  logger.info(`   → No compression applied`);
  logger.info("");
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Example 3: Large message - With GZIP compression
  logger.info("📦 Example 3: Publishing large message WITH GZIP compression");
  const largePayload2 = generateLargePayload("large-002", 50);
  const largePayloadSize2 = JSON.stringify(largePayload2).length;

  const start2 = Date.now();
  await client
    .publish("largeData", largePayload2, {
      compression: "gzip",
      persistent: true,
    })
    .tapError((error) => logger.error({ error }, "Failed to publish"))
    .resultToPromise();
  const duration2 = Date.now() - start2;

  logger.info(`   ✓ Published ${largePayloadSize2} bytes in ${duration2}ms`);
  logger.info(`   → GZIP compression applied`);
  logger.info(`   → Estimated reduction: ~70-80% for text-heavy content`);
  logger.info("");
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Example 4: Large message - With DEFLATE compression
  logger.info("📦 Example 4: Publishing large message WITH DEFLATE compression");
  const largePayload3 = generateLargePayload("large-003", 50);
  const largePayloadSize3 = JSON.stringify(largePayload3).length;

  const start3 = Date.now();
  await client
    .publish("largeData", largePayload3, {
      compression: "deflate",
      persistent: true,
    })
    .tapError((error) => logger.error({ error }, "Failed to publish"))
    .resultToPromise();
  const duration3 = Date.now() - start3;

  logger.info(`   ✓ Published ${largePayloadSize3} bytes in ${duration3}ms`);
  logger.info(`   → DEFLATE compression applied (faster than gzip)`);
  logger.info(`   → Estimated reduction: ~65-75% for text-heavy content`);
  logger.info("");
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Example 5: Conditional compression based on size
  logger.info("📦 Example 5: Conditional compression based on message size");
  const conditionalPayload = generateLargePayload("large-004", 100);
  const conditionalPayloadSize = JSON.stringify(conditionalPayload).length;

  // Compress if message is larger than 1KB
  const SIZE_THRESHOLD = 1024;
  const shouldCompress = conditionalPayloadSize > SIZE_THRESHOLD;

  const start4 = Date.now();
  await client
    .publish("largeData", conditionalPayload, {
      compression: shouldCompress ? "gzip" : undefined,
      persistent: true,
    })
    .tapError((error) => logger.error({ error }, "Failed to publish"))
    .resultToPromise();
  const duration4 = Date.now() - start4;

  logger.info(`   ✓ Published ${conditionalPayloadSize} bytes in ${duration4}ms`);
  logger.info(`   → Threshold: ${SIZE_THRESHOLD} bytes`);
  logger.info(`   → Compression: ${shouldCompress ? "ENABLED (gzip)" : "DISABLED"}`);
  logger.info("");

  logger.info("=".repeat(70));
  logger.info("✅ All examples published successfully!");
  logger.info("");
  logger.info("Key Takeaways:");
  logger.info("  • Small messages (<1KB): Skip compression (overhead not worth it)");
  logger.info("  • Large messages (>1KB): Use compression to reduce bandwidth");
  logger.info("  • GZIP: Better compression ratio, slightly slower");
  logger.info("  • DEFLATE: Faster compression, slightly lower ratio");
  logger.info("  • Consumers automatically decompress - no configuration needed");
  logger.info("=".repeat(70));

  // Keep the connection open for a bit
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Clean up
  await client.close();
  logger.info("Publisher stopped");
  process.exit(0);
}

main().catch((error) => {
  logger.error({ error }, "Publisher error");
  process.exit(1);
});
