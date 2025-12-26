/* eslint-disable sort-imports -- Integration test imports order */
import {
  defineConsumer,
  defineContract,
  defineExchange,
  defineMessage,
  defineQueue,
  defineQueueBinding,
} from "@amqp-contract/contract";
import { AmqpWorkerModule } from "./worker.module.js";
import { Test } from "@nestjs/testing";
import { describe, expect, vi } from "vitest";
import { it as baseIt } from "@amqp-contract/testing/extension";
import { z } from "zod";

// Define contract at module level for type inference
const testExchange = defineExchange("test-exchange", "topic", { durable: false });
const testQueue = defineQueue("test-queue", { durable: false });
const testBinding = defineQueueBinding(testQueue, testExchange, {
  routingKey: "test.#",
});

const testMessage = defineMessage(
  z.object({
    id: z.string(),
    message: z.string(),
  }),
);

const testContract = defineContract({
  exchanges: {
    test: testExchange,
  },
  queues: {
    test: testQueue,
  },
  bindings: {
    testBinding,
  },
  consumers: {
    testConsumer: defineConsumer(testQueue, testMessage),
  },
});

const it = baseIt;

describe("AmqpWorkerModule Integration", () => {
  describe("module lifecycle", () => {
    it("should initialize and connect to RabbitMQ", async ({ amqpConnectionUrl }) => {
      // GIVEN - handler mock
      const handler = vi.fn();

      // WHEN - create module
      const moduleRef = await Test.createTestingModule({
        imports: [
          AmqpWorkerModule.forRoot({
            contract: testContract,
            handlers: {
              testConsumer: handler,
            },
            urls: [amqpConnectionUrl],
          }),
        ],
      }).compile();

      const app = moduleRef.createNestApplication();
      await app.init();

      // THEN - module should be initialized
      expect(app).toBeDefined();

      await app.close();
    });

    it("should consume messages from a real RabbitMQ instance", async ({
      amqpConnectionUrl,
      publishMessage,
    }) => {
      // GIVEN - handler mock
      const handler = vi.fn();

      const moduleRef = await Test.createTestingModule({
        imports: [
          AmqpWorkerModule.forRoot({
            contract: testContract,
            handlers: {
              testConsumer: handler,
            },
            urls: [amqpConnectionUrl],
          }),
        ],
      }).compile();

      const app = moduleRef.createNestApplication();
      await app.init();

      // Wait for worker to be ready
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // WHEN - publish message
      publishMessage(testExchange.name, "test.key", {
        id: "123",
        message: "Hello from integration test!",
      });

      // THEN - handler should be called
      await vi.waitFor(
        () => {
          expect(handler).toHaveBeenCalledWith({
            id: "123",
            message: "Hello from integration test!",
          });
        },
        { timeout: 5000 },
      );

      await app.close();
    });

    it("should validate messages before consuming", async ({
      amqpConnectionUrl,
      publishMessage,
    }) => {
      // GIVEN - handler mock
      const handler = vi.fn();

      const moduleRef = await Test.createTestingModule({
        imports: [
          AmqpWorkerModule.forRoot({
            contract: testContract,
            handlers: {
              testConsumer: handler,
            },
            urls: [amqpConnectionUrl],
          }),
        ],
      }).compile();

      const app = moduleRef.createNestApplication();
      await app.init();

      // Wait for worker to be ready
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // WHEN - publish invalid message
      publishMessage(testExchange.name, "test.key", {
        id: "123",
        // Missing 'message' field
      });

      // THEN - handler should not be called with invalid message
      await new Promise((resolve) => setTimeout(resolve, 2000));
      expect(handler).not.toHaveBeenCalled();

      await app.close();
    });
  });

  describe("async module configuration", () => {
    it("should support forRootAsync with useFactory", async ({ amqpConnectionUrl }) => {
      // GIVEN - handler mock
      const handler = vi.fn();

      // WHEN - module with async configuration
      const moduleRef = await Test.createTestingModule({
        imports: [
          AmqpWorkerModule.forRootAsync({
            useFactory: () => ({
              contract: testContract,
              handlers: {
                testConsumer: handler,
              },
              urls: [amqpConnectionUrl],
            }),
          }),
        ],
      }).compile();

      const app = moduleRef.createNestApplication();
      await app.init();

      // THEN - module should be initialized
      expect(app).toBeDefined();

      await app.close();
    });

    it("should support forRootAsync with dependency injection", async ({ amqpConnectionUrl }) => {
      // GIVEN - mock config service and handler
      class ConfigService {
        getAmqpUrls(): string[] {
          return [amqpConnectionUrl];
        }
      }

      const handler = vi.fn();

      const moduleRef = await Test.createTestingModule({
        imports: [
          AmqpWorkerModule.forRootAsync({
            useFactory: (configService: ConfigService) => ({
              contract: testContract,
              handlers: {
                testConsumer: handler,
              },
              urls: configService.getAmqpUrls(),
            }),
            inject: [ConfigService],
          }),
        ],
        providers: [ConfigService],
      }).compile();

      const app = moduleRef.createNestApplication();
      await app.init();

      // THEN - module should be initialized
      expect(app).toBeDefined();

      await app.close();
    });
  });
});
