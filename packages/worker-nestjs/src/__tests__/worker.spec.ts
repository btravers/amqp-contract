import { Future, Result } from "@swan-io/boxed";
import {
  defineCommandConsumer,
  defineContract,
  defineExchange,
  defineMessage,
  defineQueue,
} from "@amqp-contract/contract";
import { describe, expect, vi } from "vitest";
import { AmqpWorkerModule } from "../worker.module.js";
import { Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { defineHandlers } from "@amqp-contract/worker";
import { it } from "@amqp-contract/testing/extension";
import { z } from "zod";

// Define contract at module level for type inference
const testExchange = defineExchange("test-exchange", "topic", { durable: false });
const testQueue = defineQueue("test-queue", { type: "classic", durable: false });

const testMessage = defineMessage(
  z.object({
    id: z.string(),
    message: z.string(),
  }),
);

const testConsumer = defineCommandConsumer(testQueue, testExchange, testMessage, {
  routingKey: "test.#",
});

const testContract = defineContract({
  consumers: {
    testConsumer,
  },
});

describe("AmqpWorkerModule Integration", () => {
  describe("module lifecycle", () => {
    it("should initialize and connect to RabbitMQ", async ({ amqpConnectionUrl }) => {
      // GIVEN - handler mock that returns a Future
      const handler = vi.fn().mockReturnValue(Future.value(Result.Ok(undefined)));

      // WHEN - create module
      const moduleRef = await Test.createTestingModule({
        imports: [
          AmqpWorkerModule.forRoot({
            contract: testContract,
            handlers: defineHandlers(testContract, {
              testConsumer: handler,
            }),
            urls: [amqpConnectionUrl],
          }),
        ],
      }).compile();

      // Use module directly instead of creating app
      await moduleRef.init();

      // THEN - module should be initialized
      expect(moduleRef).toBeDefined();

      await moduleRef.close();
    });

    it("should consume messages from a real RabbitMQ instance", async ({
      amqpConnectionUrl,
      publishMessage,
    }) => {
      // GIVEN - handler mock that returns a Future
      const handler = vi.fn().mockReturnValue(Future.value(Result.Ok(undefined)));

      const moduleRef = await Test.createTestingModule({
        imports: [
          AmqpWorkerModule.forRoot({
            contract: testContract,
            handlers: defineHandlers(testContract, {
              testConsumer: handler,
            }),
            urls: [amqpConnectionUrl],
          }),
        ],
      }).compile();

      // Use module directly instead of creating app
      await moduleRef.init();

      // Wait for worker to be ready
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // WHEN - publish message
      publishMessage(testExchange.name, "test.key", {
        id: "123",
        message: "Hello from integration test!",
      });

      // THEN - handler should be called
      await vi.waitFor(() => {
        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: {
              id: "123",
              message: "Hello from integration test!",
            },
          }),
          expect.anything(), // rawMessage
        );
      });

      await moduleRef.close();
    });

    it("should validate messages before consuming", async ({
      amqpConnectionUrl,
      publishMessage,
    }) => {
      // GIVEN - handler mock that returns a Future
      const handler = vi.fn().mockReturnValue(Future.value(Result.Ok(undefined)));

      const moduleRef = await Test.createTestingModule({
        imports: [
          AmqpWorkerModule.forRoot({
            contract: testContract,
            handlers: defineHandlers(testContract, {
              testConsumer: handler,
            }),
            urls: [amqpConnectionUrl],
          }),
        ],
      }).compile();

      // Use module directly instead of creating app
      await moduleRef.init();

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

      await moduleRef.close();
    });
  });

  describe("async module configuration", () => {
    it("should support forRootAsync with useFactory", async ({ amqpConnectionUrl }) => {
      // GIVEN - handler mock that returns a Future
      const handler = vi.fn().mockReturnValue(Future.value(Result.Ok(undefined)));

      // WHEN - module with async configuration
      const moduleRef = await Test.createTestingModule({
        imports: [
          AmqpWorkerModule.forRootAsync({
            useFactory: () => ({
              contract: testContract,
              handlers: defineHandlers(testContract, {
                testConsumer: handler,
              }),
              urls: [amqpConnectionUrl],
            }),
          }),
        ],
      }).compile();

      // Use module directly instead of creating app
      await moduleRef.init();

      // THEN - module should be initialized
      expect(moduleRef).toBeDefined();

      await moduleRef.close();
    });

    it("should support forRootAsync with dependency injection", async ({ amqpConnectionUrl }) => {
      // GIVEN - mock config service and handler
      class ConfigService {
        getAmqpUrls(): string[] {
          return [amqpConnectionUrl];
        }
      }

      // Create a Config module that exports ConfigService
      @Module({
        providers: [ConfigService],
        exports: [ConfigService],
      })
      class ConfigModule {}

      const handler = vi.fn().mockReturnValue(Future.value(Result.Ok(undefined)));

      const moduleRef = await Test.createTestingModule({
        imports: [
          ConfigModule,
          AmqpWorkerModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
              contract: testContract,
              handlers: defineHandlers(testContract, {
                testConsumer: handler,
              }),
              urls: configService.getAmqpUrls(),
            }),
            inject: [ConfigService],
          }),
        ],
      }).compile();

      // Use module directly instead of creating app
      await moduleRef.init();

      // THEN - module should be initialized
      expect(moduleRef).toBeDefined();

      await moduleRef.close();
    });
  });
});
