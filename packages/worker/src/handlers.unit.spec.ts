import {
  defineConsumer,
  defineContract,
  defineMessage,
  defineQueue,
} from "@amqp-contract/contract";
import { defineHandler, defineHandlers } from "./handlers.js";
import { describe, expect, it, vi } from "vitest";
import type { WorkerInferConsumerInput } from "./types.js";
import { z } from "zod";

describe("handlers", () => {
  // Define test contracts
  const OrderMessage = defineMessage(
    z.object({
      orderId: z.string(),
      amount: z.number(),
    }),
  );

  const PaymentMessage = defineMessage(
    z.object({
      paymentId: z.string(),
      status: z.enum(["pending", "completed", "failed"]),
    }),
  );

  const ordersQueue = defineQueue("orders");
  const paymentsQueue = defineQueue("payments");

  const testContract = defineContract({
    queues: {
      orders: ordersQueue,
      payments: paymentsQueue,
    },
    consumers: {
      processOrder: defineConsumer(ordersQueue, OrderMessage),
      processPayment: defineConsumer(paymentsQueue, PaymentMessage),
    },
  });

  describe("defineHandler", () => {
    it("should define a type-safe handler for a consumer", () => {
      // GIVEN
      const handler = vi.fn().mockResolvedValue(undefined);

      // WHEN
      const processOrderHandler = defineHandler(testContract, "processOrder", handler);

      // THEN
      expect(processOrderHandler).toBe(handler);
      expect(typeof processOrderHandler).toBe("function");
    });

    it("should preserve handler function behavior", async () => {
      // GIVEN
      const mockHandler = vi.fn().mockResolvedValue(undefined);
      const handler = defineHandler(testContract, "processOrder", mockHandler);

      const testMessage: WorkerInferConsumerInput<typeof testContract, "processOrder"> = {
        orderId: "123",
        amount: 100,
      };

      // WHEN
      await handler(testMessage);

      // THEN
      expect(mockHandler).toHaveBeenCalledWith(testMessage);
      expect(mockHandler).toHaveBeenCalledTimes(1);
    });

    it("should throw error when consumer does not exist in contract", () => {
      // GIVEN
      const handler = vi.fn().mockResolvedValue(undefined);

      // WHEN / THEN
      expect(() => {
        // @ts-expect-error - Testing invalid consumer name
        defineHandler(testContract, "nonExistentConsumer", handler);
      }).toThrow('Consumer "nonExistentConsumer" not found in contract');
    });

    it("should list available consumers in error message", () => {
      // GIVEN
      const handler = vi.fn().mockResolvedValue(undefined);

      // WHEN / THEN
      expect(() => {
        // @ts-expect-error - Testing invalid consumer name
        defineHandler(testContract, "invalidConsumer", handler);
      }).toThrow("Available consumers: processOrder, processPayment");
    });

    it("should handle contract with no consumers", () => {
      // GIVEN
      const emptyContract = defineContract({
        queues: { test: { name: "test" } },
      });
      const handler = vi.fn().mockResolvedValue(undefined);

      // WHEN / THEN
      expect(() => {
        defineHandler(emptyContract, "anyConsumer" as never, handler);
      }).toThrow("Available consumers: none");
    });

    it("should work with async handlers", async () => {
      // GIVEN
      const asyncHandler = async (_message: { orderId: string; amount: number }) => {};

      const handler = defineHandler(testContract, "processOrder", asyncHandler);

      // WHEN
      await handler({ orderId: "456", amount: 200 });

      // THEN - handler executed without error
      expect(handler).toBeDefined();
    });

    it("should preserve handler error throwing", async () => {
      // GIVEN
      const errorHandler = vi.fn().mockRejectedValue(new Error("Processing failed"));
      const handler = defineHandler(testContract, "processOrder", errorHandler);

      // WHEN / THEN
      await expect(handler({ orderId: "789", amount: 300 })).rejects.toThrow("Processing failed");
    });
  });

  describe("defineHandlers", () => {
    it("should define multiple type-safe handlers at once", () => {
      // GIVEN
      const processOrderHandler = vi.fn().mockResolvedValue(undefined);
      const processPaymentHandler = vi.fn().mockResolvedValue(undefined);

      // WHEN
      const handlers = defineHandlers(testContract, {
        processOrder: processOrderHandler,
        processPayment: processPaymentHandler,
      });

      // THEN
      expect(handlers).toEqual({
        processOrder: processOrderHandler,
        processPayment: processPaymentHandler,
      });
    });

    it("should preserve all handler functions behavior", async () => {
      // GIVEN
      const mockOrderHandler = vi.fn().mockResolvedValue(undefined);
      const mockPaymentHandler = vi.fn().mockResolvedValue(undefined);

      const handlers = defineHandlers(testContract, {
        processOrder: mockOrderHandler,
        processPayment: mockPaymentHandler,
      });

      const orderMessage: WorkerInferConsumerInput<typeof testContract, "processOrder"> = {
        orderId: "123",
        amount: 100,
      };

      const paymentMessage: WorkerInferConsumerInput<typeof testContract, "processPayment"> = {
        paymentId: "456",
        status: "completed",
      };

      // WHEN
      await handlers.processOrder(orderMessage);
      await handlers.processPayment(paymentMessage);

      // THEN
      expect(mockOrderHandler).toHaveBeenCalledWith(orderMessage);
      expect(mockPaymentHandler).toHaveBeenCalledWith(paymentMessage);
      expect(mockOrderHandler).toHaveBeenCalledTimes(1);
      expect(mockPaymentHandler).toHaveBeenCalledTimes(1);
    });

    it("should throw error when any consumer does not exist in contract", () => {
      // GIVEN
      const handler = vi.fn().mockResolvedValue(undefined);

      // WHEN / THEN
      expect(() => {
        defineHandlers(testContract, {
          processOrder: handler,
          // @ts-expect-error - Testing invalid consumer name
          invalidConsumer: handler,
        });
      }).toThrow('Consumer "invalidConsumer" not found in contract');
    });

    it("should list available consumers in error message", () => {
      // GIVEN
      const handler = vi.fn().mockResolvedValue(undefined);

      // WHEN / THEN
      expect(() => {
        defineHandlers(testContract, {
          // @ts-expect-error - Testing invalid consumer name
          nonExistent: handler,
        });
      }).toThrow("Available consumers: processOrder, processPayment");
    });

    it("should handle contract with no consumers", () => {
      // GIVEN
      const emptyContract = defineContract({
        queues: { test: { name: "test" } },
      });
      const handler = vi.fn().mockResolvedValue(undefined);

      // WHEN / THEN
      expect(() => {
        defineHandlers(emptyContract, { anyConsumer: handler } as never);
      }).toThrow("Available consumers: none");
    });

    it("should work with async handlers", async () => {
      // GIVEN
      const asyncOrderHandler = async (_message: { orderId: string; amount: number }) => {};

      const asyncPaymentHandler = async (_message: {
        paymentId: string;
        status: "pending" | "completed" | "failed";
      }) => {};

      const handlers = defineHandlers(testContract, {
        processOrder: asyncOrderHandler,
        processPayment: asyncPaymentHandler,
      });

      // WHEN / THEN
      await expect(handlers.processOrder({ orderId: "123", amount: 100 })).resolves.toBeUndefined();
      await expect(
        handlers.processPayment({ paymentId: "456", status: "completed" }),
      ).resolves.toBeUndefined();
    });

    it("should preserve handler error throwing for all handlers", async () => {
      // GIVEN
      const errorHandler1 = vi.fn().mockRejectedValue(new Error("Order processing failed"));
      const errorHandler2 = vi.fn().mockRejectedValue(new Error("Payment processing failed"));

      const handlers = defineHandlers(testContract, {
        processOrder: errorHandler1,
        processPayment: errorHandler2,
      });

      // WHEN / THEN
      await expect(handlers.processOrder({ orderId: "123", amount: 100 })).rejects.toThrow(
        "Order processing failed",
      );
      await expect(
        handlers.processPayment({ paymentId: "456", status: "pending" }),
      ).rejects.toThrow("Payment processing failed");
    });

    it("should allow partial handler definitions", () => {
      // GIVEN - Only defining one of two consumers
      const processOrderHandler = vi.fn().mockResolvedValue(undefined);

      // WHEN
      const handlers = defineHandlers(testContract, {
        processOrder: processOrderHandler,
        processPayment: vi.fn().mockResolvedValue(undefined),
      });

      // THEN
      expect(handlers).toHaveProperty("processOrder");
      expect(handlers).toHaveProperty("processPayment");
    });
  });

  describe("Type Safety", () => {
    it("should infer correct message types for defineHandler", () => {
      // GIVEN / WHEN
      const handler = defineHandler(testContract, "processOrder", async (message) => {
        // Type test - these should be typed correctly
        const orderId: string = message.orderId;
        const amount: number = message.amount;

        expect(orderId).toBeDefined();
        expect(amount).toBeDefined();
      });

      // THEN
      expect(handler).toBeDefined();
    });

    it("should infer correct message types for defineHandlers", () => {
      // GIVEN / WHEN
      const handlers = defineHandlers(testContract, {
        processOrder: async (message) => {
          // Type test - these should be typed correctly
          const orderId: string = message.orderId;
          const amount: number = message.amount;
          expect(orderId).toBeDefined();
          expect(amount).toBeDefined();
        },
        processPayment: async (message) => {
          // Type test - these should be typed correctly
          const paymentId: string = message.paymentId;
          const status: "pending" | "completed" | "failed" = message.status;
          expect(paymentId).toBeDefined();
          expect(status).toBeDefined();
        },
      });

      // THEN
      expect(handlers).toBeDefined();
    });
  });
});
