import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChannelModel } from "amqplib";
import { defineContract, defineExchange, definePublisher } from "@amqp-contract/contract";
import { z } from "zod";
import { AmqpClientModule } from "./client.module.js";
import { AmqpClientService } from "./client.service.js";

describe("AmqpClientModule", () => {
  const mockConnection = {
    createChannel: vi.fn(),
  } as unknown as ChannelModel;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("forRoot", () => {
    it("should create a dynamic module with proper configuration", () => {
      const contract = defineContract({
        exchanges: {
          testExchange: defineExchange("test-exchange", "topic", { durable: true }),
        },
        publishers: {
          testPublisher: definePublisher("test-exchange", z.object({ message: z.string() }), {
            routingKey: "test.key",
          }),
        },
      });

      const module = AmqpClientModule.forRoot({
        contract,
        connection: mockConnection,
      });

      expect(module).toMatchObject({
        module: AmqpClientModule,
        providers: expect.arrayContaining([
          expect.objectContaining({
            provide: AmqpClientService,
            useFactory: expect.any(Function),
          }),
        ]),
        exports: [AmqpClientService],
      });
    });

    it("should create service instance from factory", () => {
      const contract = defineContract({
        exchanges: {
          testExchange: defineExchange("test-exchange", "topic", { durable: true }),
        },
        publishers: {
          testPublisher: definePublisher("test-exchange", z.object({ message: z.string() }), {
            routingKey: "test.key",
          }),
        },
      });

      const module = AmqpClientModule.forRoot({
        contract,
        connection: mockConnection,
      });

      const provider = module.providers?.[0];
      expect(provider).toBeDefined();

      if (provider && typeof provider === "object" && "useFactory" in provider) {
        const factory = provider.useFactory as () => AmqpClientService<typeof contract>;
        const service = factory();
        expect(service).toBeInstanceOf(AmqpClientService);
      }
    });
  });
});
