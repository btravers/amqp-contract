import { describe, expect } from "vitest";
import { it } from "@amqp-contract/testing/extension";
import { createClient } from "@amqp-contract/client";
import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";

describe("Basic Order Processing Client Integration", () => {
  describe("order publishing", () => {
    it("should publish a new order successfully", async ({ amqpConnection }) => {
      // GIVEN
      const client = createClient(orderContract);
      await client.connect(amqpConnection);

      const newOrder = {
        orderId: "TEST-001",
        customerId: "CUST-123",
        items: [
          { productId: "PROD-A", quantity: 2, price: 29.99 },
          { productId: "PROD-B", quantity: 1, price: 49.99 },
        ],
        totalAmount: 109.97,
        createdAt: new Date().toISOString(),
      };

      // WHEN
      const result = await client.publish("orderCreated", newOrder);

      // THEN
      expect(result).toBe(true);

      // CLEANUP
      await client.close();
    });

    it("should publish order status updates", async ({ amqpConnection }) => {
      // GIVEN
      const client = createClient(orderContract);
      await client.connect(amqpConnection);

      const orderUpdate = {
        orderId: "TEST-001",
        status: "processing" as const,
        updatedAt: new Date().toISOString(),
      };

      // WHEN
      const result = await client.publish("orderUpdated", orderUpdate);

      // THEN
      expect(result).toBe(true);

      // CLEANUP
      await client.close();
    });

    it("should publish shipped order notifications", async ({ amqpConnection }) => {
      // GIVEN
      const client = createClient(orderContract);
      await client.connect(amqpConnection);

      const shippedOrder = {
        orderId: "TEST-001",
        status: "shipped" as const,
        updatedAt: new Date().toISOString(),
      };

      // WHEN
      const result = await client.publish("orderShipped", shippedOrder);

      // THEN
      expect(result).toBe(true);

      // CLEANUP
      await client.close();
    });

    it("should publish urgent order updates", async ({ amqpConnection }) => {
      // GIVEN
      const client = createClient(orderContract);
      await client.connect(amqpConnection);

      const urgentUpdate = {
        orderId: "TEST-002",
        status: "cancelled" as const,
        updatedAt: new Date().toISOString(),
      };

      // WHEN
      const result = await client.publish("orderUrgentUpdate", urgentUpdate);

      // THEN
      expect(result).toBe(true);

      // CLEANUP
      await client.close();
    });
  });

  describe("order validation", () => {
    it("should validate order schema before publishing", async ({ amqpConnection }) => {
      // GIVEN
      const client = createClient(orderContract);
      await client.connect(amqpConnection);

      const invalidOrder = {
        orderId: "TEST-001",
        customerId: "CUST-123",
        items: [
          { productId: "PROD-A", quantity: -1, price: 29.99 }, // Invalid: negative quantity
        ],
        totalAmount: 29.99,
        createdAt: new Date().toISOString(),
      };

      // WHEN / THEN
      await expect(client.publish("orderCreated", invalidOrder)).rejects.toThrow();

      // CLEANUP
      await client.close();
    });

    it("should validate status enum values", async ({ amqpConnection }) => {
      // GIVEN
      const client = createClient(orderContract);
      await client.connect(amqpConnection);

      const invalidStatus = {
        orderId: "TEST-001",
        // @ts-expect-error - testing runtime validation with invalid status
        status: "invalid-status",
        updatedAt: new Date().toISOString(),
      };

      // WHEN / THEN
      await expect(client.publish("orderUpdated", invalidStatus)).rejects.toThrow();

      // CLEANUP
      await client.close();
    });
  });

  describe("topology setup", () => {
    it("should setup the complete order processing topology", async ({ amqpConnection }) => {
      // GIVEN
      const client = createClient(orderContract);

      // WHEN - Connect should setup exchanges, queues, and bindings
      await client.connect(amqpConnection);

      // THEN - No errors should be thrown
      expect(client).toBeDefined();

      // CLEANUP
      await client.close();
    });
  });
});
