/* eslint-disable sort-imports */
import { Future, Result } from "@swan-io/boxed";
import { describe, expect, it } from "vitest";
import type { FullMessageEngine, MessageEngine, TopologyEngine } from "./interfaces.js";
import type {
  BindingDefinition,
  ConnectionConfig,
  ExchangeDefinition,
  PublishableMessage,
  QueueDefinition,
} from "./types.js";

describe("MessageEngine interface", () => {
  describe("type checking", () => {
    it("should allow implementation of MessageEngine", () => {
      // This is a type-level test to ensure the interface is implementable
      const mockEngine: MessageEngine = {
        connect: (_config: ConnectionConfig) => Future.value(Result.Ok(undefined)),
        disconnect: () => Future.value(Result.Ok(undefined)),
        getStatus: () => "connected" as const,
        waitForReady: (_timeoutMs?: number) => Future.value(Result.Ok(undefined)),
        publish: (_exchange: string, _message: PublishableMessage, _options?: unknown) =>
          Future.value(Result.Ok(undefined)),
        consume: (_queue: string, _handler: unknown, _options?: unknown) =>
          Future.value(Result.Ok("consumer-tag")),
        cancel: (_consumerTag: string) => Future.value(Result.Ok(undefined)),
        getMetrics: () => ({
          messagesPublished: 0,
          messagesConsumed: 0,
          messagesFailed: 0,
          status: "connected" as const,
        }),
      };

      expect(mockEngine).toBeDefined();
      expect(mockEngine.connect).toBeInstanceOf(Function);
      expect(mockEngine.publish).toBeInstanceOf(Function);
      expect(mockEngine.consume).toBeInstanceOf(Function);
    });

    it("should allow implementation of TopologyEngine", () => {
      const mockTopology: TopologyEngine = {
        assertExchange: (_exchange: ExchangeDefinition) => Future.value(Result.Ok(undefined)),
        assertQueue: (_queue: QueueDefinition) => Future.value(Result.Ok(undefined)),
        bindQueue: (_binding: BindingDefinition) => Future.value(Result.Ok(undefined)),
        deleteExchange: (_exchange: string) => Future.value(Result.Ok(undefined)),
        deleteQueue: (_queue: string) => Future.value(Result.Ok(undefined)),
        unbindQueue: (_binding: BindingDefinition) => Future.value(Result.Ok(undefined)),
      };

      expect(mockTopology).toBeDefined();
      expect(mockTopology.assertExchange).toBeInstanceOf(Function);
      expect(mockTopology.assertQueue).toBeInstanceOf(Function);
    });

    it("should allow implementation of FullMessageEngine", () => {
      const mockFullEngine: FullMessageEngine = {
        // MessageEngine methods
        connect: (_config: ConnectionConfig) => Future.value(Result.Ok(undefined)),
        disconnect: () => Future.value(Result.Ok(undefined)),
        getStatus: () => "connected" as const,
        waitForReady: (_timeoutMs?: number) => Future.value(Result.Ok(undefined)),
        publish: (_exchange: string, _message: PublishableMessage, _options?: unknown) =>
          Future.value(Result.Ok(undefined)),
        consume: (_queue: string, _handler: unknown, _options?: unknown) =>
          Future.value(Result.Ok("consumer-tag")),
        cancel: (_consumerTag: string) => Future.value(Result.Ok(undefined)),
        getMetrics: () => ({
          messagesPublished: 0,
          messagesConsumed: 0,
          messagesFailed: 0,
          status: "connected" as const,
        }),
        // TopologyEngine methods
        assertExchange: (_exchange: ExchangeDefinition) => Future.value(Result.Ok(undefined)),
        assertQueue: (_queue: QueueDefinition) => Future.value(Result.Ok(undefined)),
        bindQueue: (_binding: BindingDefinition) => Future.value(Result.Ok(undefined)),
        deleteExchange: (_exchange: string) => Future.value(Result.Ok(undefined)),
        deleteQueue: (_queue: string) => Future.value(Result.Ok(undefined)),
        unbindQueue: (_binding: BindingDefinition) => Future.value(Result.Ok(undefined)),
      };

      expect(mockFullEngine).toBeDefined();
      expect(mockFullEngine.connect).toBeInstanceOf(Function);
      expect(mockFullEngine.assertExchange).toBeInstanceOf(Function);
    });
  });
});

describe("Types", () => {
  describe("ConnectionConfig", () => {
    it("should accept valid connection config", () => {
      const config: ConnectionConfig = {
        urls: ["amqp://localhost"],
        protocol: "amqp",
        options: {},
      };

      expect(config.urls).toEqual(["amqp://localhost"]);
      expect(config.protocol).toBe("amqp");
    });

    it("should support multiple protocols", () => {
      const configs: ConnectionConfig[] = [
        { urls: ["amqp://localhost"], protocol: "amqp" },
        { urls: ["kafka://localhost"], protocol: "kafka" },
        { urls: ["redis://localhost"], protocol: "redis" },
        { urls: ["bullmq://localhost"], protocol: "bullmq" },
        { urls: ["custom://localhost"], protocol: "custom" },
      ];

      configs.forEach((config) => {
        expect(config.urls).toBeDefined();
        expect(config.protocol).toBeDefined();
      });
    });
  });

  describe("ExchangeDefinition", () => {
    it("should create valid exchange definition", () => {
      const exchange: ExchangeDefinition = {
        name: "orders",
        type: "topic",
        durable: true,
      };

      expect(exchange).toEqual({
        name: "orders",
        type: "topic",
        durable: true,
      });
    });
  });

  describe("QueueDefinition", () => {
    it("should create valid queue definition", () => {
      const queue: QueueDefinition = {
        name: "order-processing",
        durable: true,
        maxLength: 1000,
      };

      expect(queue).toEqual({
        name: "order-processing",
        durable: true,
        maxLength: 1000,
      });
    });
  });

  describe("BindingDefinition", () => {
    it("should create valid binding definition", () => {
      const binding: BindingDefinition = {
        queue: "order-processing",
        exchange: "orders",
        routingKey: "order.created",
      };

      expect(binding).toEqual({
        queue: "order-processing",
        exchange: "orders",
        routingKey: "order.created",
      });
    });
  });

  describe("PublishableMessage", () => {
    it("should create valid publishable message", () => {
      const message: PublishableMessage = {
        routingKey: "order.created",
        payload: { orderId: "123", amount: 99.99 },
        properties: {
          messageId: "msg-123",
          timestamp: Date.now(),
          contentType: "application/json",
        },
      };

      expect(message.routingKey).toBe("order.created");
      expect(message.payload).toEqual({ orderId: "123", amount: 99.99 });
      expect(message.properties?.messageId).toBe("msg-123");
    });
  });
});
