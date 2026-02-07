import { Future, Result } from "@swan-io/boxed";
import { NonRetryableError, RetryableError } from "./errors.js";
import {
  defineConsumer,
  defineContract,
  defineMessage,
  defineQueue,
} from "@amqp-contract/contract";
import { defineHandler, defineHandlers } from "./handlers.js";
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
  const testQueue = defineQueue("test-queue", { durable: true });
  const testMessage = defineMessage(
    z.object({
      id: z.string(),
      data: z.string(),
    }),
  );

  const testContract = defineContract({
    consumers: {
      testConsumer: defineConsumer(testQueue, testMessage),
      anotherConsumer: defineConsumer(testQueue, testMessage),
    },
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
        'Consumer "nonExistentConsumer" not found in contract. Available consumers: testConsumer, anotherConsumer',
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
