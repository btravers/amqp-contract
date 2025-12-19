import { describe, expect, vi } from "vitest";
import { it } from "@amqp-contract/testing/extension";
import { createWorker } from "@amqp-contract/worker";
import { createClient } from "@amqp-contract/client";
import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";

describe("Basic Order Processing Worker Integration", () => {
  describe("order processing", () => {
    it("should process new orders from order.created queue", async ({ amqpConnection }) => {
      // GIVEN
      const processOrderHandler = vi.fn();

      const worker = createWorker(orderContract, {
        processOrder: processOrderHandler,
        notifyOrder: vi.fn(),
        shipOrder: vi.fn(),
        handleUrgentOrder: vi.fn(),
      });

      await worker.connect(amqpConnection);
      await worker.consume("processOrder");

      const client = createClient(orderContract);
      await client.connect(amqpConnection);

      const newOrder = {
        orderId: "TEST-001",
        customerId: "CUST-123",
        items: [{ productId: "PROD-A", quantity: 2, price: 29.99 }],
        totalAmount: 59.98,
        createdAt: new Date().toISOString(),
      };

      // WHEN
      await client.publish("orderCreated", newOrder);

      // THEN
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(processOrderHandler).toHaveBeenCalledWith(newOrder);

      // CLEANUP
      await worker.close();
      await client.close();
    });

    it("should receive notifications for all order events", async ({ amqpConnection }) => {
      // GIVEN
      const notifyOrderHandler = vi.fn();

      const worker = createWorker(orderContract, {
        processOrder: vi.fn(),
        notifyOrder: notifyOrderHandler,
        shipOrder: vi.fn(),
        handleUrgentOrder: vi.fn(),
      });

      await worker.connect(amqpConnection);
      await worker.consume("notifyOrder");

      const client = createClient(orderContract);
      await client.connect(amqpConnection);

      // WHEN - Publish different types of order events
      const newOrder = {
        orderId: "TEST-002",
        customerId: "CUST-456",
        items: [{ productId: "PROD-B", quantity: 1, price: 49.99 }],
        totalAmount: 49.99,
        createdAt: new Date().toISOString(),
      };

      const orderUpdate = {
        orderId: "TEST-002",
        status: "processing" as const,
        updatedAt: new Date().toISOString(),
      };

      await client.publish("orderCreated", newOrder);
      await client.publish("orderUpdated", orderUpdate);

      // THEN - Should receive both events
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(notifyOrderHandler).toHaveBeenCalledTimes(2);
      expect(notifyOrderHandler).toHaveBeenCalledWith(newOrder);
      expect(notifyOrderHandler).toHaveBeenCalledWith(orderUpdate);

      // CLEANUP
      await worker.close();
      await client.close();
    });

    it("should handle shipped orders", async ({ amqpConnection }) => {
      // GIVEN
      const shipOrderHandler = vi.fn();

      const worker = createWorker(orderContract, {
        processOrder: vi.fn(),
        notifyOrder: vi.fn(),
        shipOrder: shipOrderHandler,
        handleUrgentOrder: vi.fn(),
      });

      await worker.connect(amqpConnection);
      await worker.consume("shipOrder");

      const client = createClient(orderContract);
      await client.connect(amqpConnection);

      const shippedOrder = {
        orderId: "TEST-003",
        status: "shipped" as const,
        updatedAt: new Date().toISOString(),
      };

      // WHEN
      await client.publish("orderShipped", shippedOrder);

      // THEN
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(shipOrderHandler).toHaveBeenCalledWith(shippedOrder);

      // CLEANUP
      await worker.close();
      await client.close();
    });

    it("should handle urgent order updates", async ({ amqpConnection }) => {
      // GIVEN
      const handleUrgentOrderHandler = vi.fn();

      const worker = createWorker(orderContract, {
        processOrder: vi.fn(),
        notifyOrder: vi.fn(),
        shipOrder: vi.fn(),
        handleUrgentOrder: handleUrgentOrderHandler,
      });

      await worker.connect(amqpConnection);
      await worker.consume("handleUrgentOrder");

      const client = createClient(orderContract);
      await client.connect(amqpConnection);

      const urgentUpdate = {
        orderId: "TEST-004",
        status: "cancelled" as const,
        updatedAt: new Date().toISOString(),
      };

      // WHEN
      await client.publish("orderUrgentUpdate", urgentUpdate);

      // THEN
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(handleUrgentOrderHandler).toHaveBeenCalledWith(urgentUpdate);

      // CLEANUP
      await worker.close();
      await client.close();
    });
  });

  describe("routing patterns", () => {
    it("should demonstrate topic exchange routing with wildcards", async ({ amqpConnection }) => {
      // GIVEN
      const notifyOrderHandler = vi.fn();
      const urgentOrderHandler = vi.fn();

      const worker = createWorker(orderContract, {
        processOrder: vi.fn(),
        notifyOrder: notifyOrderHandler,
        shipOrder: vi.fn(),
        handleUrgentOrder: urgentOrderHandler,
      });

      await worker.connect(amqpConnection);
      await worker.consume("notifyOrder"); // Subscribes to "order.#" (all order events)
      await worker.consume("handleUrgentOrder"); // Subscribes to "order.*.urgent"

      const client = createClient(orderContract);
      await client.connect(amqpConnection);

      // WHEN - Publish urgent update
      const urgentUpdate = {
        orderId: "TEST-005",
        status: "cancelled" as const,
        updatedAt: new Date().toISOString(),
      };

      await client.publish("orderUrgentUpdate", urgentUpdate);

      // THEN - Both handlers should receive the message
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(notifyOrderHandler).toHaveBeenCalledWith(urgentUpdate); // Matches "order.#"
      expect(urgentOrderHandler).toHaveBeenCalledWith(urgentUpdate); // Matches "order.*.urgent"

      // CLEANUP
      await worker.close();
      await client.close();
    });
  });

  describe("consumeAll", () => {
    it("should start all consumers at once", async ({ amqpConnection }) => {
      // GIVEN
      const processOrderHandler = vi.fn();
      const notifyOrderHandler = vi.fn();
      const shipOrderHandler = vi.fn();
      const urgentOrderHandler = vi.fn();

      const worker = createWorker(orderContract, {
        processOrder: processOrderHandler,
        notifyOrder: notifyOrderHandler,
        shipOrder: shipOrderHandler,
        handleUrgentOrder: urgentOrderHandler,
      });

      await worker.connect(amqpConnection);

      // WHEN - Start all consumers
      await worker.consumeAll();

      const client = createClient(orderContract);
      await client.connect(amqpConnection);

      // Publish messages to different queues
      const newOrder = {
        orderId: "TEST-006",
        customerId: "CUST-789",
        items: [{ productId: "PROD-C", quantity: 1, price: 19.99 }],
        totalAmount: 19.99,
        createdAt: new Date().toISOString(),
      };

      const shippedOrder = {
        orderId: "TEST-007",
        status: "shipped" as const,
        updatedAt: new Date().toISOString(),
      };

      await client.publish("orderCreated", newOrder);
      await client.publish("orderShipped", shippedOrder);

      // THEN - All relevant handlers should be called
      await new Promise((resolve) => setTimeout(resolve, 800));
      expect(processOrderHandler).toHaveBeenCalledWith(newOrder);
      expect(notifyOrderHandler).toHaveBeenCalled(); // Receives all events
      expect(shipOrderHandler).toHaveBeenCalledWith(shippedOrder);

      // CLEANUP
      await worker.close();
      await client.close();
    });
  });

  describe("message validation", () => {
    it("should reject invalid messages", async ({ amqpConnection }) => {
      // GIVEN
      const processOrderHandler = vi.fn();

      const worker = createWorker(orderContract, {
        processOrder: processOrderHandler,
        notifyOrder: vi.fn(),
        shipOrder: vi.fn(),
        handleUrgentOrder: vi.fn(),
      });

      await worker.connect(amqpConnection);
      await worker.consume("processOrder");

      // WHEN - Manually publish an invalid message (bypassing client validation)
      const channel = await amqpConnection.createChannel();
      await channel.assertExchange("orders", "topic", { durable: true });
      await channel.assertQueue("order-processing", { durable: true });
      await channel.bindQueue("order-processing", "orders", "order.created");

      channel.publish(
        "orders",
        "order.created",
        Buffer.from(
          JSON.stringify({
            orderId: "TEST-008",
            customerId: "CUST-999",
            items: [
              { productId: "PROD-X", quantity: -5, price: 10.0 }, // Invalid: negative quantity
            ],
            totalAmount: 10.0,
            createdAt: new Date().toISOString(),
          }),
        ),
      );

      // THEN - Handler should not be called due to validation failure
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(processOrderHandler).not.toHaveBeenCalled();

      // CLEANUP
      await channel.close();
      await worker.close();
    });
  });
});
