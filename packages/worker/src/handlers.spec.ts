import {
  defineConsumer,
  defineContract,
  defineExchange,
  defineMessage,
  defineQueue,
} from "@amqp-contract/contract";
import { defineHandler, defineHandlers } from "./handlers.js";
import { describe, expect, it } from "vitest";
import { z } from "zod";

describe("handlers", () => {
  // Setup test contract
  const testExchange = defineExchange("test-exchange", "topic", { durable: true });
  const testQueue = defineQueue("test-queue", { durable: true });
  const testMessage = defineMessage(
    z.object({
      id: z.string(),
      data: z.string(),
    }),
  );

  const testContract = defineContract({
    exchanges: { test: testExchange },
    queues: { testQueue },
    consumers: {
      testConsumer: defineConsumer(testQueue, testMessage),
      anotherConsumer: defineConsumer(testQueue, testMessage),
    },
  });

  describe("defineHandler", () => {
    it("should create a simple handler without options", () => {
      // GIVEN
      const handler = async (message: { id: string; data: string }) => {
        console.log(message.id);
      };

      // WHEN
      const result = defineHandler(testContract, "testConsumer", handler);

      // THEN
      expect(result).toBe(handler);
    });

    it("should create a handler with prefetch option", () => {
      // GIVEN
      const handler = async (message: { id: string; data: string }) => {
        console.log(message.id);
      };

      // WHEN
      const result = defineHandler(testContract, "testConsumer", handler, { prefetch: 10 });

      // THEN
      expect(result).toEqual([handler, { prefetch: 10 }]);
    });

    it("should create a batch handler with batchSize", () => {
      // GIVEN
      const batchHandler = async (messages: Array<{ id: string; data: string }>) => {
        console.log(messages.length);
      };

      // WHEN
      const result = defineHandler(testContract, "testConsumer", batchHandler, {
        batchSize: 5,
        batchTimeout: 1000,
      });

      // THEN
      expect(result).toEqual([batchHandler, { batchSize: 5, batchTimeout: 1000 }]);
    });

    it("should throw error if consumer not found in contract", () => {
      // GIVEN
      const handler = async (message: { id: string; data: string }) => {
        console.log(message.id);
      };

      // WHEN/THEN
      expect(() => {
        // @ts-expect-error Testing invalid consumer name
        defineHandler(testContract, "nonExistentConsumer", handler);
      }).toThrow(
        'Consumer "nonExistentConsumer" not found in contract. Available consumers: testConsumer, anotherConsumer',
      );
    });

    it("should throw error if contract has no consumers", () => {
      // GIVEN
      const emptyContract = defineContract({
        exchanges: { test: testExchange },
        queues: { testQueue },
      });
      const handler = async (message: { id: string; data: string }) => {
        console.log(message.id);
      };

      // WHEN/THEN
      expect(() => {
        // @ts-expect-error Testing with empty contract
        defineHandler(emptyContract, "testConsumer", handler);
      }).toThrow('Consumer "testConsumer" not found in contract. Available consumers: none');
    });
  });

  describe("defineHandlers", () => {
    it("should create multiple handlers", () => {
      // GIVEN
      const handlers = {
        testConsumer: async (message: { id: string; data: string }) => {
          console.log(message.id);
        },
        anotherConsumer: async (message: { id: string; data: string }) => {
          console.log(message.data);
        },
      };

      // WHEN
      const result = defineHandlers(testContract, handlers);

      // THEN
      expect(result).toBe(handlers);
    });

    it("should create handlers with mixed options", () => {
      // GIVEN
      const handler1 = async (message: { id: string; data: string }) => {
        console.log(message.id);
      };
      const handler2 = async (message: { id: string; data: string }) => {
        console.log(message.data);
      };

      const handlers = {
        testConsumer: handler1,
        anotherConsumer: [handler2, { prefetch: 5 }] as const,
      };

      // WHEN
      const result = defineHandlers(testContract, handlers);

      // THEN
      expect(result).toBe(handlers);
      expect(result.testConsumer).toBe(handler1);
      expect(result.anotherConsumer).toEqual([handler2, { prefetch: 5 }]);
    });

    it("should throw error if handler references non-existent consumer", () => {
      // GIVEN
      const handlers = {
        testConsumer: async (message: { id: string; data: string }) => {
          console.log(message.id);
        },
        // @ts-expect-error Testing invalid consumer name
        nonExistentConsumer: async (message: { id: string; data: string }) => {
          console.log(message.data);
        },
      };

      // WHEN/THEN
      expect(() => {
        defineHandlers(testContract, handlers);
      }).toThrow(
        'Consumer "nonExistentConsumer" not found in contract. Available consumers: testConsumer, anotherConsumer',
      );
    });

    it("should throw error if contract has no consumers", () => {
      // GIVEN
      const emptyContract = defineContract({
        exchanges: { test: testExchange },
        queues: { testQueue },
      });

      const handlers = {
        // @ts-expect-error Testing with empty contract
        testConsumer: async (message: { id: string; data: string }) => {
          console.log(message.id);
        },
      };

      // WHEN/THEN
      expect(() => {
        defineHandlers(emptyContract, handlers);
      }).toThrow('Consumer "testConsumer" not found in contract. Available consumers: none');
    });
  });
});
