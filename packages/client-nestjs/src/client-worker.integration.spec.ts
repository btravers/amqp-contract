/* eslint-disable sort-imports -- Integration test imports order */
import {
  defineConsumer,
  defineContract,
  defineExchange,
  defineMessage,
  definePublisher,
  defineQueue,
  defineQueueBinding,
} from "@amqp-contract/contract";
import { AmqpClientModule } from "./client.module.js";
import { AmqpClientService } from "./client.service.js";
import { Test } from "@nestjs/testing";
import { describe, expect, vi } from "vitest";
import { it as baseIt } from "@amqp-contract/testing/extension";
import { z } from "zod";

// Define contract at module level for type inference
const ordersExchange = defineExchange("orders-exchange", "topic", { durable: false });
const ordersQueue = defineQueue("orders-queue", { durable: false });
const ordersBinding = defineQueueBinding(ordersQueue, ordersExchange, {
  routingKey: "order.#",
});

const orderMessage = defineMessage(
  z.object({
    orderId: z.string(),
    customerId: z.string(),
    amount: z.number(),
  }),
);

const testContract = defineContract({
  exchanges: {
    orders: ordersExchange,
  },
  queues: {
    orders: ordersQueue,
  },
  bindings: {
    ordersBinding,
  },
  publishers: {
    orderCreated: definePublisher(ordersExchange, orderMessage, {
      routingKey: "order.created",
    }),
  },
  consumers: {
    processOrder: defineConsumer(ordersQueue, orderMessage),
  },
});

const it = baseIt;

describe("Client and Worker Integration", () => {
  describe("end-to-end message flow", () => {
    it("should publish from client and consume in worker", async ({ amqpConnectionUrl }) => {
      // GIVEN - handler mock to track consumed messages
      const handler = vi.fn().mockResolvedValue();

      // Import worker module dynamically to avoid circular dependency issues
      const { AmqpWorkerModule } = await import("../../worker-nestjs/src/worker.module.js");

      // Create both client and worker modules
      const moduleRef = await Test.createTestingModule({
        imports: [
          AmqpClientModule.forRoot({
            contract: testContract,
            urls: [amqpConnectionUrl],
          }),
          AmqpWorkerModule.forRoot({
            contract: testContract,
            handlers: {
              processOrder: handler,
            },
            urls: [amqpConnectionUrl],
          }),
        ],
      }).compile();

      // Use module directly instead of creating app
      await moduleRef.init();

      const clientService = moduleRef.get(AmqpClientService<typeof testContract>);

      // Wait for worker to be ready
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // WHEN - publish message via client
      const publishResult = await clientService.publish("orderCreated", {
        orderId: "order-123",
        customerId: "customer-456",
        amount: 99.99,
      });

      // THEN - publish should succeed
      expect(publishResult.isOk()).toBe(true);

      // AND - worker should consume the message
      await vi.waitFor(
        () => {
          expect(handler).toHaveBeenCalledTimes(1);
          expect(handler).toHaveBeenCalledWith({
            orderId: "order-123",
            customerId: "customer-456",
            amount: 99.99,
          });
        },
        { timeout: 5000 },
      );

      await moduleRef.close();
    });

    it("should handle multiple messages in sequence", async ({ amqpConnectionUrl }) => {
      // GIVEN - handler mock
      const handler = vi.fn().mockResolvedValue();

      const { AmqpWorkerModule } = await import("../../worker-nestjs/src/worker.module.js");

      const moduleRef = await Test.createTestingModule({
        imports: [
          AmqpClientModule.forRoot({
            contract: testContract,
            urls: [amqpConnectionUrl],
          }),
          AmqpWorkerModule.forRoot({
            contract: testContract,
            handlers: {
              processOrder: handler,
            },
            urls: [amqpConnectionUrl],
          }),
        ],
      }).compile();

      // Use module directly instead of creating app
      await moduleRef.init();

      const clientService = moduleRef.get(AmqpClientService<typeof testContract>);

      // Wait for worker to be ready
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // WHEN - publish multiple messages
      const orders = [
        { orderId: "order-1", customerId: "customer-1", amount: 10.0 },
        { orderId: "order-2", customerId: "customer-2", amount: 20.0 },
        { orderId: "order-3", customerId: "customer-3", amount: 30.0 },
      ];

      for (const order of orders) {
        await clientService.publish("orderCreated", order);
      }

      // THEN - all messages should be consumed
      await vi.waitFor(
        () => {
          expect(handler).toHaveBeenCalledTimes(3);
          expect(handler).toHaveBeenNthCalledWith(1, orders[0]);
          expect(handler).toHaveBeenNthCalledWith(2, orders[1]);
          expect(handler).toHaveBeenNthCalledWith(3, orders[2]);
        },
        { timeout: 5000 },
      );

      await moduleRef.close();
    });

    it("should handle message validation failures gracefully", async ({ amqpConnectionUrl }) => {
      // GIVEN - handler mock
      const handler = vi.fn().mockResolvedValue();

      const { AmqpWorkerModule } = await import("../../worker-nestjs/src/worker.module.js");

      const moduleRef = await Test.createTestingModule({
        imports: [
          AmqpClientModule.forRoot({
            contract: testContract,
            urls: [amqpConnectionUrl],
          }),
          AmqpWorkerModule.forRoot({
            contract: testContract,
            handlers: {
              processOrder: handler,
            },
            urls: [amqpConnectionUrl],
          }),
        ],
      }).compile();

      // Use module directly instead of creating app
      await moduleRef.init();

      const clientService = moduleRef.get(AmqpClientService<typeof testContract>);

      // Wait for worker to be ready
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // WHEN - try to publish invalid message (client-side validation should catch it)
      const result = await clientService.publish("orderCreated", {
        orderId: "order-123",
        customerId: "customer-456",
        // @ts-expect-error - intentionally invalid for testing
        invalidField: "test",
      });

      // THEN - publish should fail at validation
      expect(result.isError()).toBe(true);

      // AND - handler should never be called
      await new Promise((resolve) => setTimeout(resolve, 2000));
      expect(handler).not.toHaveBeenCalled();

      await moduleRef.close();
    });
  });

  describe("connection sharing", () => {
    it("should work with shared connection URL", async ({ amqpConnectionUrl }) => {
      // GIVEN - both client and worker configured with same URL
      const handler = vi.fn().mockResolvedValue();

      const { AmqpWorkerModule } = await import("../../worker-nestjs/src/worker.module.js");

      const moduleRef = await Test.createTestingModule({
        imports: [
          AmqpClientModule.forRoot({
            contract: testContract,
            urls: [amqpConnectionUrl],
          }),
          AmqpWorkerModule.forRoot({
            contract: testContract,
            handlers: {
              processOrder: handler,
            },
            urls: [amqpConnectionUrl],
          }),
        ],
      }).compile();

      // Use module directly instead of creating app
      await moduleRef.init();

      const clientService = moduleRef.get(AmqpClientService<typeof testContract>);

      // Wait for worker to be ready
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // WHEN - publish and consume
      await clientService.publish("orderCreated", {
        orderId: "order-shared",
        customerId: "customer-shared",
        amount: 50.0,
      });

      // THEN - message should flow correctly
      await vi.waitFor(
        () => {
          expect(handler).toHaveBeenCalledTimes(1);
          expect(handler).toHaveBeenCalledWith({
            orderId: "order-shared",
            customerId: "customer-shared",
            amount: 50.0,
          });
        },
        { timeout: 5000 },
      );

      await moduleRef.close();
    });
  });
});
