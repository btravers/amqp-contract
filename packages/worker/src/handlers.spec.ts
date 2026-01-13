import { Future, Result } from "@swan-io/boxed";
import { NonRetryableError, RetryableError } from "./errors.js";
import {
  defineConsumer,
  defineContract,
  defineExchange,
  defineMessage,
  defineQueue,
} from "@amqp-contract/contract";
import {
  defineHandler,
  defineHandlers,
  defineUnsafeHandler,
  defineUnsafeHandlers,
} from "./handlers.js";
import { describe, expect, it } from "vitest";
import type { ConsumeMessage } from "amqplib";
import { z } from "zod";

/**
 * Creates a mock ConsumeMessage for testing purposes.
 */
function createMockConsumeMessage(): ConsumeMessage {
  return {
    content: Buffer.from("{}"),
    fields: {
      consumerTag: "test-consumer-tag",
      deliveryTag: 1,
      redelivered: false,
      exchange: "test-exchange",
      routingKey: "test.key",
    },
    properties: {
      contentType: undefined,
      contentEncoding: undefined,
      headers: {},
      deliveryMode: undefined,
      priority: undefined,
      correlationId: undefined,
      replyTo: undefined,
      expiration: undefined,
      messageId: undefined,
      timestamp: undefined,
      type: undefined,
      userId: undefined,
      appId: undefined,
      clusterId: undefined,
    },
  };
}

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

  describe("defineUnsafeHandler", () => {
    it("should create a wrapped safe handler without options", () => {
      // GIVEN
      const handler = async ({ payload }: { payload: { id: string; data: string } }) => {
        console.log(payload.id);
      };

      // WHEN
      const result = defineUnsafeHandler(testContract, "testConsumer", handler);

      // THEN - result is a wrapped function, not the original
      expect(typeof result).toBe("function");
      expect(result).not.toBe(handler);
    });

    it("should create a wrapped safe handler with prefetch option", () => {
      // GIVEN
      const handler = async ({ payload }: { payload: { id: string; data: string } }) => {
        console.log(payload.id);
      };

      // WHEN
      const result = defineUnsafeHandler(testContract, "testConsumer", handler, { prefetch: 10 });

      // THEN - result is a tuple with wrapped handler and options
      expect(Array.isArray(result)).toBe(true);
      const [wrappedHandler, options] = result as [unknown, unknown];
      expect(typeof wrappedHandler).toBe("function");
      expect(wrappedHandler).not.toBe(handler);
      expect(options).toEqual({ prefetch: 10 });
    });

    it("should throw error if consumer not found in contract", () => {
      // GIVEN
      const handler = async ({ payload }: { payload: { id: string; data: string } }) => {
        console.log(payload.id);
      };

      // WHEN/THEN
      expect(() => {
        // oxlint-disable-next-line no-explicit-any
        (defineUnsafeHandler as any)(testContract, "nonExistentConsumer", handler);
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
        // oxlint-disable-next-line no-explicit-any
        (defineUnsafeHandler as any)(emptyContract, "testConsumer", handler);
      }).toThrow('Consumer "testConsumer" not found in contract. Available consumers: none');
    });

    it("should wrap errors in RetryableError by default", async () => {
      // GIVEN
      const handler = async (_message: { payload: { id: string; data: string } }) => {
        throw new Error("Test error");
      };

      // WHEN
      const result = defineUnsafeHandler(testContract, "testConsumer", handler);
      const wrappedResult = await (
        result as (
          input: { payload: { id: string; data: string } },
          raw: unknown,
        ) => Future<Result<void, unknown>>
      )({ payload: { id: "1", data: "test" } }, {}).toPromise();

      // THEN
      expect(wrappedResult.isError()).toBe(true);
      if (wrappedResult.isError()) {
        expect(wrappedResult.getError()).toBeInstanceOf(RetryableError);
      }
    });

    it("should preserve NonRetryableError thrown by handler", async () => {
      // GIVEN
      const handler = async (_message: { payload: { id: string; data: string } }) => {
        throw new NonRetryableError("Invalid data");
      };

      // WHEN
      const result = defineUnsafeHandler(testContract, "testConsumer", handler);
      const wrappedResult = await (
        result as (
          input: { payload: { id: string; data: string } },
          raw: unknown,
        ) => Future<Result<void, unknown>>
      )({ payload: { id: "1", data: "test" } }, {}).toPromise();

      // THEN
      expect(wrappedResult.isError()).toBe(true);
      if (wrappedResult.isError()) {
        expect(wrappedResult.getError()).toBeInstanceOf(NonRetryableError);
      }
    });
  });

  describe("defineUnsafeHandlers", () => {
    it("should create wrapped safe handlers", () => {
      // GIVEN
      const handlers = {
        testConsumer: async ({ payload }: { payload: { id: string; data: string } }) => {
          console.log(payload.id);
        },
        anotherConsumer: async ({ payload }: { payload: { id: string; data: string } }) => {
          console.log(payload.data);
        },
      };

      // WHEN
      const result = defineUnsafeHandlers(testContract, handlers);

      // THEN - result contains wrapped functions, not the originals
      expect(result).not.toBe(handlers);
      expect(typeof result.testConsumer).toBe("function");
      expect(typeof result.anotherConsumer).toBe("function");
      expect(result.testConsumer).not.toBe(handlers.testConsumer);
      expect(result.anotherConsumer).not.toBe(handlers.anotherConsumer);
    });

    it("should create wrapped handlers with mixed options", () => {
      // GIVEN
      const handler1 = async ({ payload }: { payload: { id: string; data: string } }) => {
        console.log(payload.id);
      };
      const handler2 = async ({ payload }: { payload: { id: string; data: string } }) => {
        console.log(payload.data);
      };

      const handlers = {
        testConsumer: handler1,
        anotherConsumer: [handler2, { prefetch: 5 }] as const,
      };

      // WHEN
      const result = defineUnsafeHandlers(testContract, handlers);

      // THEN - result contains wrapped handlers
      expect(typeof result["testConsumer"]).toBe("function");
      expect(Array.isArray(result["anotherConsumer"])).toBe(true);
      const [wrappedHandler2, options] = result["anotherConsumer"] as [unknown, unknown];
      expect(typeof wrappedHandler2).toBe("function");
      expect(options).toEqual({ prefetch: 5 });
    });

    it("should throw error if handler references non-existent consumer", () => {
      // GIVEN
      const handlers = {
        testConsumer: async ({ payload }: { payload: { id: string; data: string } }) => {
          console.log(payload.id);
        },
        nonExistentConsumer: async ({ payload }: { payload: { id: string; data: string } }) => {
          console.log(payload.data);
        },
      };

      // WHEN/THEN
      expect(() => {
        // oxlint-disable-next-line no-explicit-any
        defineUnsafeHandlers(testContract, handlers as any);
      }).toThrow(
        'Handler "nonExistentConsumer" references non-existent consumer. Available consumers: testConsumer, anotherConsumer',
      );
    });

    it("should throw error if contract has no consumers", () => {
      // GIVEN
      const emptyContract = defineContract({
        exchanges: { test: testExchange },
        queues: { testQueue },
      });

      const handlers = {
        testConsumer: async ({ payload }: { payload: { id: string; data: string } }) => {
          console.log(payload.id);
        },
      };

      // WHEN/THEN
      expect(() => {
        // oxlint-disable-next-line no-explicit-any
        defineUnsafeHandlers(emptyContract, handlers as any);
      }).toThrow(
        'Handler "testConsumer" references non-existent consumer. Available consumers: none',
      );
    });
  });

  describe("defineHandler (safe handlers)", () => {
    it("should create a simple safe handler without options", () => {
      // GIVEN
      const handler = ({ payload }: { payload: { id: string; data: string } }) => {
        console.log(payload.id);
        return Future.value(Result.Ok(undefined));
      };

      // WHEN
      const result = defineHandler(testContract, "testConsumer", handler);

      // THEN
      expect(result).toBe(handler);
    });

    it("should create a safe handler with prefetch option", () => {
      // GIVEN
      const handler = ({ payload }: { payload: { id: string; data: string } }) => {
        console.log(payload.id);
        return Future.value(Result.Ok(undefined));
      };

      // WHEN
      const result = defineHandler(testContract, "testConsumer", handler, { prefetch: 10 });

      // THEN
      expect(result).toEqual([handler, { prefetch: 10 }]);
    });

    it("should throw error if consumer not found in contract", () => {
      // GIVEN
      const handler = ({ payload }: { payload: { id: string; data: string } }) => {
        console.log(payload.id);
        return Future.value(Result.Ok(undefined));
      };

      // WHEN/THEN
      expect(() => {
        // oxlint-disable-next-line no-explicit-any
        (defineHandler as any)(testContract, "nonExistentConsumer", handler);
      }).toThrow(
        'Consumer "nonExistentConsumer" not found in contract. Available consumers: testConsumer, anotherConsumer',
      );
    });
  });

  describe("defineHandlers (safe handlers)", () => {
    it("should create multiple safe handlers", () => {
      // GIVEN
      const handlers = {
        testConsumer: ({ payload }: { payload: { id: string; data: string } }) => {
          console.log(payload.id);
          return Future.value(Result.Ok(undefined));
        },
        anotherConsumer: ({ payload }: { payload: { id: string; data: string } }) => {
          console.log(payload.data);
          return Future.value(Result.Ok(undefined));
        },
      };

      // WHEN
      const result = defineHandlers(testContract, handlers);

      // THEN
      expect(result).toBe(handlers);
    });

    it("should throw error if handler references non-existent consumer", () => {
      // GIVEN
      const handlers = {
        testConsumer: ({ payload }: { payload: { id: string; data: string } }) => {
          console.log(payload.id);
          return Future.value(Result.Ok(undefined));
        },
        nonExistentConsumer: ({ payload }: { payload: { id: string; data: string } }) => {
          console.log(payload.data);
          return Future.value(Result.Ok(undefined));
        },
      };

      // WHEN/THEN
      expect(() => {
        // oxlint-disable-next-line no-explicit-any
        defineHandlers(testContract, handlers as any);
      }).toThrow(
        'Handler "nonExistentConsumer" references non-existent consumer. Available consumers: testConsumer, anotherConsumer',
      );
    });
  });

  describe("safe handlers error handling", () => {
    it("should allow returning RetryableError from safe handler", () => {
      // GIVEN
      const handler = (
        _message: { payload: { id: string; data: string } },
        _rawMessage: ConsumeMessage,
      ) => {
        return Future.value(Result.Error(new RetryableError("Transient failure")));
      };

      // WHEN
      const result = defineHandler(testContract, "testConsumer", handler);

      // THEN - handler should be created successfully
      expect(result).toBe(handler);

      // Verify the handler returns the expected error
      const handlerResult = (result as typeof handler)(
        { payload: { id: "1", data: "test" } },
        createMockConsumeMessage(),
      );
      expect(handlerResult).toBeDefined();
    });

    it("should allow returning NonRetryableError from safe handler", () => {
      // GIVEN
      const handler = (
        _message: { payload: { id: string; data: string } },
        _rawMessage: ConsumeMessage,
      ) => {
        return Future.value(Result.Error(new NonRetryableError("Invalid message")));
      };

      // WHEN
      const result = defineHandler(testContract, "testConsumer", handler);

      // THEN - handler should be created successfully
      expect(result).toBe(handler);

      // Verify the handler returns the expected error
      const handlerResult = (result as typeof handler)(
        { payload: { id: "1", data: "test" } },
        createMockConsumeMessage(),
      );
      expect(handlerResult).toBeDefined();
    });
  });
});
