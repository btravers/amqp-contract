import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChannelModel } from "amqplib";
import { defineContract, defineQueue, defineConsumer } from "@amqp-contract/contract";
import { z } from "zod";
import { AmqpWorkerModule } from "./worker.module.js";
import { AmqpWorkerService } from "./worker.service.js";

describe("AmqpWorkerModule", () => {
  const mockConnection = {
    createChannel: vi.fn(),
  } as unknown as ChannelModel;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("forRoot", () => {
    it("should create a dynamic module with proper configuration", () => {
      const contract = defineContract({
        queues: {
          testQueue: defineQueue("test-queue", { durable: true }),
        },
        consumers: {
          testConsumer: defineConsumer("test-queue", z.object({ message: z.string() })),
        },
      });

      const handler = vi.fn();
      const module = AmqpWorkerModule.forRoot({
        contract,
        handlers: {
          testConsumer: handler,
        },
        connection: mockConnection,
      });

      expect(module).toMatchObject({
        module: AmqpWorkerModule,
        providers: expect.arrayContaining([
          expect.objectContaining({
            provide: AmqpWorkerService,
            useFactory: expect.any(Function),
          }),
        ]),
        exports: [AmqpWorkerService],
      });
    });

    it("should create service instance from factory", () => {
      const contract = defineContract({
        queues: {
          testQueue: defineQueue("test-queue", { durable: true }),
        },
        consumers: {
          testConsumer: defineConsumer("test-queue", z.object({ message: z.string() })),
        },
      });

      const handler = vi.fn();
      const module = AmqpWorkerModule.forRoot({
        contract,
        handlers: {
          testConsumer: handler,
        },
        connection: mockConnection,
      });

      const provider = module.providers?.[0];
      expect(provider).toBeDefined();

      if (provider && typeof provider === "object" && "useFactory" in provider) {
        const factory = provider.useFactory as () => AmqpWorkerService<typeof contract>;
        const service = factory();
        expect(service).toBeInstanceOf(AmqpWorkerService);
      }
    });
  });
});
