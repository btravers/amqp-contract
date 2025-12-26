/* eslint-disable sort-imports -- Integration test imports order */
import {
  defineContract,
  defineExchange,
  defineMessage,
  definePublisher,
} from "@amqp-contract/contract";
import { AmqpClientModule } from "./client.module.js";
import { AmqpClientService } from "./client.service.js";
import { Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect } from "vitest";
import { it as baseIt } from "@amqp-contract/testing/extension";
import { z } from "zod";

// Define contract at module level for type inference
const testExchange = defineExchange("test-exchange", "topic", { durable: false });
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
  publishers: {
    testPublisher: definePublisher(testExchange, testMessage, {
      routingKey: "test.key",
    }),
  },
});

const it = baseIt.extend<{
  clientService: AmqpClientService<typeof testContract>;
}>({
  clientService: async ({ amqpConnectionUrl }, use) => {
    // Create NestJS testing module
    const moduleRef = await Test.createTestingModule({
      imports: [
        AmqpClientModule.forRoot({
          contract: testContract,
          urls: [amqpConnectionUrl],
        }),
      ],
    }).compile();

    await moduleRef.init();

    const service = moduleRef.get(AmqpClientService<typeof testContract>);

    await use(service);

    await moduleRef.close();
  },
});

describe("AmqpClientModule Integration", () => {
  describe("module lifecycle", () => {
    it("should initialize and connect to RabbitMQ", async ({ clientService }) => {
      // THEN - service should be initialized and ready to use
      expect(clientService).toBeDefined();
    });

    it("should publish messages to a real RabbitMQ instance", async ({
      clientService,
      initConsumer,
    }) => {
      // GIVEN
      const pendingMessages = await initConsumer(
        testContract.publishers.testPublisher.exchange.name,
        testContract.publishers.testPublisher.routingKey,
      );

      // WHEN
      const result = await clientService.publish("testPublisher", {
        id: "123",
        message: "Hello from integration test!",
      });

      // THEN
      expect(result.isOk()).toBe(true);

      const messages = await pendingMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual(
        expect.objectContaining({
          content: Buffer.from(
            JSON.stringify({ id: "123", message: "Hello from integration test!" }),
          ),
        }),
      );
    });

    it("should validate messages before publishing", async ({ clientService }) => {
      // WHEN - publish with invalid data (missing required field)
      const result = await clientService.publish("testPublisher", {
        id: "123",
        // @ts-expect-error - intentionally invalid for testing
        invalidField: "test",
      });

      // THEN - should return error
      expect(result.isError()).toBe(true);
    });
  });

  describe("async module configuration", () => {
    it("should support forRootAsync with useFactory", async ({ amqpConnectionUrl }) => {
      // GIVEN - module with async configuration
      const moduleRef = await Test.createTestingModule({
        imports: [
          AmqpClientModule.forRootAsync({
            useFactory: () => ({
              contract: testContract,
              urls: [amqpConnectionUrl],
            }),
          }),
        ],
      }).compile();

      // Use module directly instead of creating app
      await moduleRef.init();

      const service = moduleRef.get(AmqpClientService<typeof testContract>);

      // THEN - service should be functional
      expect(service).toBeDefined();

      await moduleRef.close();
    });

    it("should support forRootAsync with dependency injection", async ({ amqpConnectionUrl }) => {
      // GIVEN - mock config service
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

      const moduleRef = await Test.createTestingModule({
        imports: [
          ConfigModule,
          AmqpClientModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
              contract: testContract,
              urls: configService.getAmqpUrls(),
            }),
            inject: [ConfigService],
          }),
        ],
      }).compile();

      // Use module directly instead of creating app
      await moduleRef.init();

      const service = moduleRef.get(AmqpClientService<typeof testContract>);

      // THEN - service should be functional
      expect(service).toBeDefined();

      await moduleRef.close();
    });
  });
});
