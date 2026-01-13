import {
  ContractValidationError,
  QueueConstraints,
  ValidationErrorCode,
  assertConsumerExists,
  assertHandlersMatchConsumers,
  assertValidContract,
  getConsumerNames,
  hasConsumer,
  validateContract,
  validateDeliveryLimit,
  validateExchangeName,
  validateExchangeType,
  validateMaxPriority,
  validateQueueName,
  validateRoutingKey,
} from "./validation.js";
import {
  defineConsumer,
  defineContract,
  defineExchange,
  defineMessage,
  definePublisher,
  defineQueue,
  defineQueueBinding,
} from "./builder.js";
import { describe, expect, it } from "vitest";
import type { ContractDefinition } from "./types.js";
import { z } from "zod";

describe("validation", () => {
  describe("ContractValidationError", () => {
    it("should create error with code and context", () => {
      // WHEN
      const error = new ContractValidationError(
        "Test error message",
        ValidationErrorCode.INVALID_MAX_PRIORITY,
        { value: 10, min: 1, max: 255 },
      );

      // THEN
      expect({
        message: error.message,
        code: error.code,
        context: error.context,
        name: error.name,
      }).toEqual({
        message: "Test error message",
        code: ValidationErrorCode.INVALID_MAX_PRIORITY,
        context: { value: 10, min: 1, max: 255 },
        name: "ContractValidationError",
      });
    });

    it("should create error without context", () => {
      // WHEN
      const error = new ContractValidationError(
        "Test error",
        ValidationErrorCode.INVALID_QUEUE_NAME,
      );

      // THEN
      expect({
        message: error.message,
        code: error.code,
        context: error.context,
      }).toEqual({
        message: "Test error",
        code: ValidationErrorCode.INVALID_QUEUE_NAME,
        context: undefined,
      });
    });
  });

  describe("QueueConstraints", () => {
    it("should have correct constraint values", () => {
      // THEN
      expect(QueueConstraints).toEqual({
        MAX_PRIORITY: {
          MIN: 1,
          MAX: 255,
          RECOMMENDED_MAX: 10,
        },
        DELIVERY_LIMIT: {
          MIN: 1,
        },
      });
    });
  });

  describe("validateMaxPriority", () => {
    it("should accept valid maxPriority value of 1", () => {
      // WHEN/THEN
      expect(() => validateMaxPriority(1)).not.toThrow();
    });

    it("should accept valid maxPriority value of 10", () => {
      // WHEN/THEN
      expect(() => validateMaxPriority(10)).not.toThrow();
    });

    it("should accept valid maxPriority value of 255", () => {
      // WHEN/THEN
      expect(() => validateMaxPriority(255)).not.toThrow();
    });

    it("should throw for non-integer value", () => {
      // WHEN/THEN
      expect(() => validateMaxPriority(1.5)).toThrow(
        "Invalid maxPriority: 1.5. Must be an integer.",
      );
    });

    it("should throw for value below minimum", () => {
      // WHEN/THEN
      expect(() => validateMaxPriority(0)).toThrow("Invalid maxPriority: 0. Must be at least 1.");
    });

    it("should throw for value above maximum", () => {
      // WHEN/THEN
      expect(() => validateMaxPriority(256)).toThrow(
        "Invalid maxPriority: 256. Must be at most 255. Recommended range: 1-10.",
      );
    });
  });

  describe("validateDeliveryLimit", () => {
    it("should accept valid deliveryLimit value of 1", () => {
      // WHEN/THEN
      expect(() => validateDeliveryLimit(1)).not.toThrow();
    });

    it("should accept valid deliveryLimit value of 100", () => {
      // WHEN/THEN
      expect(() => validateDeliveryLimit(100)).not.toThrow();
    });

    it("should throw for non-integer value", () => {
      // WHEN/THEN
      expect(() => validateDeliveryLimit(1.5)).toThrow(
        "Invalid deliveryLimit: 1.5. Must be a positive integer.",
      );
    });

    it("should throw for value below minimum", () => {
      // WHEN/THEN
      expect(() => validateDeliveryLimit(0)).toThrow(
        "Invalid deliveryLimit: 0. Must be at least 1.",
      );
    });
  });

  describe("validateQueueName", () => {
    it("should accept valid queue name", () => {
      // WHEN/THEN
      expect(() => validateQueueName("my-queue")).not.toThrow();
    });

    it("should accept queue name with dots", () => {
      // WHEN/THEN
      expect(() => validateQueueName("queue.name.with.dots")).not.toThrow();
    });

    it("should throw for empty queue name", () => {
      // WHEN/THEN
      expect(() => validateQueueName("")).toThrow("Invalid queue name: cannot be empty.");
    });

    it("should throw for whitespace-only queue name", () => {
      // WHEN/THEN
      expect(() => validateQueueName("   ")).toThrow("Invalid queue name: cannot be empty.");
    });
  });

  describe("validateExchangeName", () => {
    it("should accept valid exchange name", () => {
      // WHEN/THEN
      expect(() => validateExchangeName("my-exchange")).not.toThrow();
    });

    it("should throw for empty exchange name", () => {
      // WHEN/THEN
      expect(() => validateExchangeName("")).toThrow("Invalid exchange name: cannot be empty.");
    });
  });

  describe("validateExchangeType", () => {
    it("should accept fanout type", () => {
      // WHEN/THEN
      expect(() => validateExchangeType("fanout")).not.toThrow();
    });

    it("should accept direct type", () => {
      // WHEN/THEN
      expect(() => validateExchangeType("direct")).not.toThrow();
    });

    it("should accept topic type", () => {
      // WHEN/THEN
      expect(() => validateExchangeType("topic")).not.toThrow();
    });

    it("should throw for invalid exchange type", () => {
      // WHEN/THEN
      expect(() => validateExchangeType("invalid")).toThrow(
        'Invalid exchange type: "invalid". Must be one of: fanout, direct, topic.',
      );
    });
  });

  describe("validateRoutingKey", () => {
    it("should accept valid routing key", () => {
      // WHEN/THEN
      expect(() => validateRoutingKey("order.created")).not.toThrow();
    });

    it("should throw for empty routing key", () => {
      // WHEN/THEN
      expect(() => validateRoutingKey("")).toThrow("Invalid routing key: cannot be empty.");
    });

    it("should throw for routing key with star wildcard", () => {
      // WHEN/THEN
      expect(() => validateRoutingKey("order.*")).toThrow(
        'Invalid routing key: "order.*". Routing keys for publishing cannot contain wildcards (* or #).',
      );
    });

    it("should throw for routing key with hash wildcard", () => {
      // WHEN/THEN
      expect(() => validateRoutingKey("order.#")).toThrow(
        'Invalid routing key: "order.#". Routing keys for publishing cannot contain wildcards (* or #).',
      );
    });
  });

  describe("contract validation", () => {
    const testExchange = defineExchange("test-exchange", "topic", { durable: true });
    const testQueue = defineQueue("test-queue", { durable: true });
    const testMessage = defineMessage(z.object({ id: z.string() }));

    describe("validateContract", () => {
      it("should return valid for a correct contract", () => {
        // GIVEN
        const contract = defineContract({
          exchanges: { test: testExchange },
          queues: { testQueue },
          bindings: {
            binding: defineQueueBinding(testQueue, testExchange, { routingKey: "test.key" }),
          },
          publishers: {
            publisher: definePublisher(testExchange, testMessage, { routingKey: "test.key" }),
          },
          consumers: {
            consumer: defineConsumer(testQueue, testMessage),
          },
        });

        // WHEN
        const result = validateContract(contract);

        // THEN
        expect(result).toEqual({
          valid: true,
          errors: [],
        });
      });

      it("should detect undefined exchange in binding", () => {
        // GIVEN
        const undefinedExchange = defineExchange("undefined-exchange", "topic");
        const contract: ContractDefinition = {
          exchanges: { test: testExchange },
          queues: { testQueue },
          bindings: {
            binding: defineQueueBinding(testQueue, undefinedExchange, { routingKey: "test.key" }),
          },
        };

        // WHEN
        const result = validateContract(contract);

        // THEN
        expect({
          valid: result.valid,
          errorCount: result.errors.length,
          errorCode: result.errors[0]?.code,
        }).toEqual({
          valid: false,
          errorCount: 1,
          errorCode: ValidationErrorCode.BINDING_REFERENCES_UNDEFINED_EXCHANGE,
        });
      });

      it("should detect undefined queue in binding", () => {
        // GIVEN
        const undefinedQueue = defineQueue("undefined-queue");
        const contract: ContractDefinition = {
          exchanges: { test: testExchange },
          queues: { testQueue },
          bindings: {
            binding: defineQueueBinding(undefinedQueue, testExchange, { routingKey: "test.key" }),
          },
        };

        // WHEN
        const result = validateContract(contract);

        // THEN
        expect({
          valid: result.valid,
          errorCount: result.errors.length,
          errorCode: result.errors[0]?.code,
        }).toEqual({
          valid: false,
          errorCount: 1,
          errorCode: ValidationErrorCode.BINDING_REFERENCES_UNDEFINED_QUEUE,
        });
      });

      it("should detect undefined exchange in publisher", () => {
        // GIVEN
        const undefinedExchange = defineExchange("undefined-exchange", "topic");
        const contract: ContractDefinition = {
          exchanges: { test: testExchange },
          publishers: {
            publisher: definePublisher(undefinedExchange, testMessage, { routingKey: "test.key" }),
          },
        };

        // WHEN
        const result = validateContract(contract);

        // THEN
        expect({
          valid: result.valid,
          errorCount: result.errors.length,
          errorCode: result.errors[0]?.code,
        }).toEqual({
          valid: false,
          errorCount: 1,
          errorCode: ValidationErrorCode.PUBLISHER_REFERENCES_UNDEFINED_EXCHANGE,
        });
      });

      it("should detect undefined queue in consumer", () => {
        // GIVEN
        const undefinedQueue = defineQueue("undefined-queue");
        const contract: ContractDefinition = {
          queues: { testQueue },
          consumers: {
            consumer: defineConsumer(undefinedQueue, testMessage),
          },
        };

        // WHEN
        const result = validateContract(contract);

        // THEN
        expect({
          valid: result.valid,
          errorCount: result.errors.length,
          errorCode: result.errors[0]?.code,
        }).toEqual({
          valid: false,
          errorCount: 1,
          errorCode: ValidationErrorCode.CONSUMER_REFERENCES_UNDEFINED_QUEUE,
        });
      });
    });

    describe("assertValidContract", () => {
      it("should not throw for valid contract", () => {
        // GIVEN
        const contract = defineContract({
          exchanges: { test: testExchange },
          queues: { testQueue },
        });

        // WHEN/THEN
        expect(() => assertValidContract(contract)).not.toThrow();
      });

      it("should throw for invalid contract", () => {
        // GIVEN
        const undefinedQueue = defineQueue("undefined-queue");
        const contract: ContractDefinition = {
          queues: { testQueue },
          consumers: {
            consumer: defineConsumer(undefinedQueue, testMessage),
          },
        };

        // WHEN/THEN
        expect(() => assertValidContract(contract)).toThrow(ContractValidationError);
      });
    });
  });

  describe("consumer validation utilities", () => {
    const testExchange = defineExchange("test-exchange", "topic", { durable: true });
    const testQueue = defineQueue("test-queue", { durable: true });
    const testMessage = defineMessage(z.object({ id: z.string() }));

    const contract = defineContract({
      exchanges: { test: testExchange },
      queues: { testQueue },
      consumers: {
        testConsumer: defineConsumer(testQueue, testMessage),
        anotherConsumer: defineConsumer(testQueue, testMessage),
      },
    });

    describe("hasConsumer", () => {
      it("should return true for existing consumer", () => {
        // WHEN/THEN
        expect(hasConsumer(contract, "testConsumer")).toBe(true);
      });

      it("should return false for non-existing consumer", () => {
        // WHEN/THEN
        expect(hasConsumer(contract, "nonExistent")).toBe(false);
      });

      it("should return false for contract without consumers", () => {
        // GIVEN
        const emptyContract: ContractDefinition = {};

        // WHEN/THEN
        expect(hasConsumer(emptyContract, "testConsumer")).toBe(false);
      });
    });

    describe("getConsumerNames", () => {
      it("should return all consumer names", () => {
        // WHEN
        const names = getConsumerNames(contract);

        // THEN
        expect(names.sort()).toEqual(["anotherConsumer", "testConsumer"]);
      });

      it("should return empty array for contract without consumers", () => {
        // GIVEN
        const emptyContract: ContractDefinition = {};

        // WHEN/THEN
        expect(getConsumerNames(emptyContract)).toEqual([]);
      });
    });

    describe("assertConsumerExists", () => {
      it("should not throw for existing consumer", () => {
        // WHEN/THEN
        expect(() => assertConsumerExists(contract, "testConsumer")).not.toThrow();
      });

      it("should throw for non-existing consumer", () => {
        // WHEN/THEN
        expect(() => assertConsumerExists(contract, "nonExistent")).toThrow(
          'Consumer "nonExistent" not found in contract. Available consumers: testConsumer, anotherConsumer',
        );
      });
    });

    describe("assertHandlersMatchConsumers", () => {
      it("should not throw when all handlers match consumers", () => {
        // WHEN/THEN
        expect(() =>
          assertHandlersMatchConsumers(contract, ["testConsumer", "anotherConsumer"]),
        ).not.toThrow();
      });

      it("should throw when handler references non-existent consumer", () => {
        // WHEN/THEN
        expect(() => assertHandlersMatchConsumers(contract, ["nonExistent"])).toThrow(
          'Handler "nonExistent" references non-existent consumer. Available consumers: testConsumer, anotherConsumer',
        );
      });
    });
  });
});
