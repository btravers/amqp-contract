import { describe, it, expectTypeOf } from "vitest";
import { AmqpClientModule } from "./client.module.js";
import type { DynamicModule } from "@nestjs/common";
import {
  defineContract,
  defineExchange,
  definePublisher,
  defineMessage,
} from "@amqp-contract/contract";
import { z } from "zod";

describe("AmqpClientModule - Type Safety", () => {
  describe("forRoot", () => {
    it("should preserve contract type for type-safe publishing", () => {
      const testExchange = defineExchange("test-exchange", "topic", { durable: true });

      const orderMessage = defineMessage(
        z.object({
          orderId: z.string(),
          amount: z.number(),
        })
      );

      const testContract = defineContract({
        exchanges: {
          testExchange,
        },
        publishers: {
          orderCreated: definePublisher(testExchange, orderMessage, {
            routingKey: "order.created",
          }),
        },
      });

      // This should compile with the correct contract type
      const module = AmqpClientModule.forRoot({
        contract: testContract,
        urls: ["amqp://localhost"],
      });

      // Result should be DynamicModule
      expectTypeOf(module).toMatchTypeOf<DynamicModule>();
    });

    it("should support multiple publishers with different types", () => {
      const testExchange = defineExchange("test-exchange", "topic", { durable: true });

      const orderMessage = defineMessage(
        z.object({
          orderId: z.string(),
          amount: z.number(),
        })
      );

      const userMessage = defineMessage(
        z.object({
          userId: z.string(),
          email: z.string(),
        })
      );

      const testContract = defineContract({
        exchanges: {
          testExchange,
        },
        publishers: {
          orderCreated: definePublisher(testExchange, orderMessage, {
            routingKey: "order.created",
          }),
          userRegistered: definePublisher(testExchange, userMessage, {
            routingKey: "user.registered",
          }),
        },
      });

      // This should compile with the correct contract type
      const module = AmqpClientModule.forRoot({
        contract: testContract,
        urls: ["amqp://localhost"],
      });

      expectTypeOf(module).toMatchTypeOf<DynamicModule>();
    });
  });

  describe("forRootAsync", () => {
    it("should preserve contract type with async configuration", () => {
      const testExchange = defineExchange("test-exchange", "topic", { durable: true });

      const orderMessage = defineMessage(
        z.object({
          orderId: z.string(),
          amount: z.number(),
        })
      );

      const testContract = defineContract({
        exchanges: {
          testExchange,
        },
        publishers: {
          orderCreated: definePublisher(testExchange, orderMessage, {
            routingKey: "order.created",
          }),
        },
      });

      // This should compile with correct types in useFactory
      const module = AmqpClientModule.forRootAsync({
        useFactory: () => ({
          contract: testContract,
          urls: ["amqp://localhost"],
        }),
      });

      // Result should be DynamicModule
      expectTypeOf(module).toMatchTypeOf<DynamicModule>();
    });

    it("should support async factory with injected dependencies", () => {
      const testExchange = defineExchange("test-exchange", "topic", { durable: true });

      const orderMessage = defineMessage(
        z.object({
          orderId: z.string(),
          amount: z.number(),
        })
      );

      const testContract = defineContract({
        exchanges: {
          testExchange,
        },
        publishers: {
          orderCreated: definePublisher(testExchange, orderMessage, {
            routingKey: "order.created",
          }),
        },
      });

      // Mock ConfigService type
      type ConfigService = {
        get: (key: string) => string[];
      };

      // This should compile with correct types and dependency injection
      const module = AmqpClientModule.forRootAsync({
        useFactory: (...args: unknown[]) => {
          const configService = args[0] as ConfigService;
          return {
            contract: testContract,
            urls: configService.get("AMQP_URLS"),
          };
        },
        inject: ["ConfigService"],
      });

      expectTypeOf(module).toMatchTypeOf<DynamicModule>();
    });
  });
});
