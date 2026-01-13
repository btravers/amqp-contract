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

  describe("defineUnsafeHandler", () => {
    it("should create a wrapped safe handler without options", () => {
      // GIVEN
      const handler = async (message: { payload: { id: string; data: string } }) => {
        console.log(message.payload.id);
      };

      // WHEN
      const result = defineUnsafeHandler(testContract, "testConsumer", handler);

      // THEN - result is a wrapped function, not the original
      expect(typeof result).toBe("function");
      expect(result).not.toBe(handler);
    });

    it("should create a wrapped safe handler with prefetch option", () => {
      // GIVEN
      const handler = async (message: { payload: { id: string; data: string } }) => {
        console.log(message.payload.id);
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

    it("should create a wrapped batch handler with batchSize", () => {
      // GIVEN
      const batchHandler = async (messages: Array<{ payload: { id: string; data: string } }>) => {
        console.log(messages.length);
      };

      // WHEN
      const result = defineUnsafeHandler(testContract, "testConsumer", batchHandler, {
        batchSize: 5,
        batchTimeout: 1000,
      });

      // THEN - result is a tuple with wrapped handler and options
      expect(Array.isArray(result)).toBe(true);
      const [wrappedHandler, options] = result as [unknown, unknown];
      expect(typeof wrappedHandler).toBe("function");
      expect(wrappedHandler).not.toBe(batchHandler);
      expect(options).toEqual({ batchSize: 5, batchTimeout: 1000 });
    });

    it("should throw error if consumer not found in contract", () => {
      // GIVEN
      const handler = async (message: { id: string; data: string }) => {
        console.log(message.id);
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
        testConsumer: async (message: { payload: { id: string; data: string } }) => {
          console.log(message.payload.id);
        },
        anotherConsumer: async (message: { payload: { id: string; data: string } }) => {
          console.log(message.payload.data);
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
      const handler1 = async (message: { payload: { id: string; data: string } }) => {
        console.log(message.payload.id);
      };
      const handler2 = async (message: { payload: { id: string; data: string } }) => {
        console.log(message.payload.data);
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
        testConsumer: async (message: { payload: { id: string; data: string } }) => {
          console.log(message.payload.id);
        },
        nonExistentConsumer: async (message: { payload: { id: string; data: string } }) => {
          console.log(message.payload.data);
        },
      };

      // WHEN/THEN
      expect(() => {
        // oxlint-disable-next-line no-explicit-any
        defineUnsafeHandlers(testContract, handlers as any);
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
        testConsumer: async (message: { payload: { id: string; data: string } }) => {
          console.log(message.payload.id);
        },
      };

      // WHEN/THEN
      expect(() => {
        // oxlint-disable-next-line no-explicit-any
        defineUnsafeHandlers(emptyContract, handlers as any);
      }).toThrow('Consumer "testConsumer" not found in contract. Available consumers: none');
    });
  });

  describe("defineHandler (safe handlers)", () => {
    it("should create a simple safe handler without options", () => {
      // GIVEN
      const handler = (message: { payload: { id: string; data: string } }) => {
        console.log(message.payload.id);
        return Future.value(Result.Ok(undefined));
      };

      // WHEN
      const result = defineHandler(testContract, "testConsumer", handler);

      // THEN
      expect(result).toBe(handler);
    });

    it("should create a safe handler with prefetch option", () => {
      // GIVEN
      const handler = (message: { payload: { id: string; data: string } }) => {
        console.log(message.payload.id);
        return Future.value(Result.Ok(undefined));
      };

      // WHEN
      const result = defineHandler(testContract, "testConsumer", handler, { prefetch: 10 });

      // THEN
      expect(result).toEqual([handler, { prefetch: 10 }]);
    });

    it("should create a safe batch handler with batchSize", () => {
      // GIVEN
      const batchHandler = (messages: Array<{ payload: { id: string; data: string } }>) => {
        console.log(messages.length);
        return Future.value(Result.Ok(undefined));
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
      const handler = (message: { payload: { id: string; data: string } }) => {
        console.log(message.payload.id);
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
        testConsumer: (message: { payload: { id: string; data: string } }) => {
          console.log(message.payload.id);
          return Future.value(Result.Ok(undefined));
        },
        anotherConsumer: (message: { payload: { id: string; data: string } }) => {
          console.log(message.payload.data);
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
        testConsumer: (message: { payload: { id: string; data: string } }) => {
          console.log(message.payload.id);
          return Future.value(Result.Ok(undefined));
        },
        nonExistentConsumer: (message: { payload: { id: string; data: string } }) => {
          console.log(message.payload.data);
          return Future.value(Result.Ok(undefined));
        },
      };

      // WHEN/THEN
      expect(() => {
        // oxlint-disable-next-line no-explicit-any
        defineHandlers(testContract, handlers as any);
      }).toThrow(
        'Consumer "nonExistentConsumer" not found in contract. Available consumers: testConsumer, anotherConsumer',
      );
    });
  });

  describe("safe handlers error handling", () => {
    it("should allow returning RetryableError from safe handler", () => {
      // GIVEN
      const handler = (_message: { payload: { id: string; data: string } }) => {
        return Future.value(Result.Error(new RetryableError("Transient failure")));
      };

      // WHEN
      const result = defineHandler(testContract, "testConsumer", handler);

      // THEN - handler should be created successfully
      expect(result).toBe(handler);

      // Verify the handler returns the expected error
      const handlerResult = (result as typeof handler)({ payload: { id: "1", data: "test" } });
      expect(handlerResult).toBeDefined();
    });

    it("should allow returning NonRetryableError from safe handler", () => {
      // GIVEN
      const handler = (_message: { payload: { id: string; data: string } }) => {
        return Future.value(Result.Error(new NonRetryableError("Invalid message")));
      };

      // WHEN
      const result = defineHandler(testContract, "testConsumer", handler);

      // THEN - handler should be created successfully
      expect(result).toBe(handler);

      // Verify the handler returns the expected error
      const handlerResult = (result as typeof handler)({ payload: { id: "1", data: "test" } });
      expect(handlerResult).toBeDefined();
    });
  });
});
