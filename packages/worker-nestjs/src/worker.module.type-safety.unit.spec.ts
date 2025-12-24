import { describe, it, expectTypeOf } from "vitest";
import { AmqpWorkerModule } from "./worker.module.js";
import type { DynamicModule } from "@nestjs/common";
import {
  defineContract,
  defineExchange,
  defineQueue,
  defineQueueBinding,
  defineConsumer,
  defineMessage,
} from "@amqp-contract/contract";
import { z } from "zod";

describe("AmqpWorkerModule - Type Safety", () => {
  describe("forRoot", () => {
    it("should enforce correct handler types based on contract", () => {
      const testExchange = defineExchange("test-exchange", "topic", { durable: true });
      const testQueue = defineQueue("test-queue", { durable: true });
      const testBinding = defineQueueBinding(testQueue, testExchange, {
        routingKey: "test.#",
      });

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
        queues: {
          testQueue,
        },
        bindings: {
          testBinding,
        },
        consumers: {
          processOrder: defineConsumer(testQueue, orderMessage),
        },
      });

      // This should compile with correct types
      const module = AmqpWorkerModule.forRoot({
        contract: testContract,
        handlers: {
          processOrder: async (message) => {
            // message should be typed as { orderId: string, amount: number }
            expectTypeOf(message).toEqualTypeOf<{
              orderId: string;
              amount: number;
            }>();
          },
        },
        urls: ["amqp://localhost"],
      });

      // Result should be DynamicModule
      expectTypeOf(module).toMatchTypeOf<DynamicModule>();
    });

    it("should allow multiple consumers with different types", () => {
      const testExchange = defineExchange("test-exchange", "topic", { durable: true });
      const orderQueue = defineQueue("order-queue", { durable: true });
      const userQueue = defineQueue("user-queue", { durable: true });
      const orderBinding = defineQueueBinding(orderQueue, testExchange, {
        routingKey: "order.#",
      });
      const userBinding = defineQueueBinding(userQueue, testExchange, {
        routingKey: "user.#",
      });

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
        queues: {
          orderQueue,
          userQueue,
        },
        bindings: {
          orderBinding,
          userBinding,
        },
        consumers: {
          processOrder: defineConsumer(orderQueue, orderMessage),
          processUser: defineConsumer(userQueue, userMessage),
        },
      });

      // This should compile with correct types for each handler
      const module = AmqpWorkerModule.forRoot({
        contract: testContract,
        handlers: {
          processOrder: async (message) => {
            expectTypeOf(message).toEqualTypeOf<{
              orderId: string;
              amount: number;
            }>();
          },
          processUser: async (message) => {
            expectTypeOf(message).toEqualTypeOf<{
              userId: string;
              email: string;
            }>();
          },
        },
        urls: ["amqp://localhost"],
      });

      expectTypeOf(module).toMatchTypeOf<DynamicModule>();
    });
  });

  describe("forRootAsync", () => {
    it("should enforce correct handler types with async configuration", () => {
      const testExchange = defineExchange("test-exchange", "topic", { durable: true });
      const testQueue = defineQueue("test-queue", { durable: true });
      const testBinding = defineQueueBinding(testQueue, testExchange, {
        routingKey: "test.#",
      });

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
        queues: {
          testQueue,
        },
        bindings: {
          testBinding,
        },
        consumers: {
          processOrder: defineConsumer(testQueue, orderMessage),
        },
      });

      // This should compile with correct types in useFactory
      const module = AmqpWorkerModule.forRootAsync({
        useFactory: () => ({
          contract: testContract,
          handlers: {
            processOrder: async (message) => {
              // message should be typed as { orderId: string, amount: number }
              expectTypeOf(message).toEqualTypeOf<{
                orderId: string;
                amount: number;
              }>();
            },
          },
          urls: ["amqp://localhost"],
        }),
      });

      // Result should be DynamicModule
      expectTypeOf(module).toMatchTypeOf<DynamicModule>();
    });

    it("should support async factory with injected dependencies", () => {
      const testExchange = defineExchange("test-exchange", "topic", { durable: true });
      const testQueue = defineQueue("test-queue", { durable: true });
      const testBinding = defineQueueBinding(testQueue, testExchange, {
        routingKey: "test.#",
      });

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
        queues: {
          testQueue,
        },
        bindings: {
          testBinding,
        },
        consumers: {
          processOrder: defineConsumer(testQueue, orderMessage),
        },
      });

      // Mock ConfigService type
      type ConfigService = {
        get: (key: string) => string[];
      };

      // This should compile with correct types and dependency injection
      const module = AmqpWorkerModule.forRootAsync({
        useFactory: (...args: unknown[]) => {
          const configService = args[0] as ConfigService;
          return {
            contract: testContract,
            handlers: {
              processOrder: async (message) => {
                expectTypeOf(message).toEqualTypeOf<{
                  orderId: string;
                  amount: number;
                }>();
              },
            },
            urls: configService.get("AMQP_URLS"),
          };
        },
        inject: ["ConfigService"],
      });

      expectTypeOf(module).toMatchTypeOf<DynamicModule>();
    });
  });
});
