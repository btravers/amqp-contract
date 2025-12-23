import { describe, it, expect, vi, beforeEach } from "vitest";
import { setupInfra } from "./setup.js";
import type { Channel } from "amqplib";
import {
  defineContract,
  defineExchange,
  defineQueue,
  defineQueueBinding,
  defineExchangeBinding,
} from "@amqp-contract/contract";

describe("setupInfra", () => {
  const mockChannel = {
    assertExchange: vi.fn().mockResolvedValue(undefined),
    assertQueue: vi.fn().mockResolvedValue(undefined),
    bindQueue: vi.fn().mockResolvedValue(undefined),
    bindExchange: vi.fn().mockResolvedValue(undefined),
  } as unknown as Channel;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should setup exchanges from contract", async () => {
    // GIVEN
    const contract = defineContract({
      exchanges: {
        orders: defineExchange("orders", "topic", { durable: true }),
        notifications: defineExchange("notifications", "fanout", { autoDelete: true }),
      },
    });

    // WHEN
    await setupInfra(mockChannel, contract);

    // THEN
    expect(mockChannel.assertExchange).toHaveBeenCalledTimes(2);
    expect(mockChannel.assertExchange).toHaveBeenNthCalledWith(1, "orders", "topic", {
      durable: true,
      autoDelete: undefined,
      internal: undefined,
      arguments: undefined,
    });
    expect(mockChannel.assertExchange).toHaveBeenNthCalledWith(2, "notifications", "fanout", {
      durable: undefined,
      autoDelete: true,
      internal: undefined,
      arguments: undefined,
    });
  });

  it("should setup queues from contract", async () => {
    // GIVEN
    const contract = defineContract({
      queues: {
        orderProcessing: defineQueue("order-processing", { durable: true }),
        notifications: defineQueue("notifications", { exclusive: true, autoDelete: true }),
      },
    });

    // WHEN
    await setupInfra(mockChannel, contract);

    // THEN
    expect(mockChannel.assertQueue).toHaveBeenCalledTimes(2);
    expect(mockChannel.assertQueue).toHaveBeenNthCalledWith(1, "order-processing", {
      durable: true,
      exclusive: undefined,
      autoDelete: undefined,
      arguments: undefined,
    });
    expect(mockChannel.assertQueue).toHaveBeenNthCalledWith(2, "notifications", {
      durable: undefined,
      exclusive: true,
      autoDelete: true,
      arguments: undefined,
    });
  });

  it("should setup queue bindings from contract", async () => {
    // GIVEN
    const ordersExchange = defineExchange("orders", "topic", { durable: true });
    const orderQueue = defineQueue("order-processing", { durable: true });
    const contract = defineContract({
      exchanges: {
        orders: ordersExchange,
      },
      queues: {
        orderProcessing: orderQueue,
      },
      bindings: {
        orderBinding: defineQueueBinding(orderQueue, ordersExchange, {
          routingKey: "order.created",
        }),
      },
    });

    // WHEN
    await setupInfra(mockChannel, contract);

    // THEN
    expect(mockChannel.bindQueue).toHaveBeenCalledTimes(1);
    expect(mockChannel.bindQueue).toHaveBeenCalledWith(
      "order-processing",
      "orders",
      "order.created",
      undefined,
    );
  });

  it("should setup exchange bindings from contract", async () => {
    // GIVEN
    const sourceExchange = defineExchange("source", "topic", { durable: true });
    const destExchange = defineExchange("destination", "topic", { durable: true });
    const contract = defineContract({
      exchanges: {
        source: sourceExchange,
        destination: destExchange,
      },
      bindings: {
        exchangeBinding: defineExchangeBinding(destExchange, sourceExchange, {
          routingKey: "*.important",
        }),
      },
    });

    // WHEN
    await setupInfra(mockChannel, contract);

    // THEN
    expect(mockChannel.bindExchange).toHaveBeenCalledTimes(1);
    expect(mockChannel.bindExchange).toHaveBeenCalledWith(
      "destination",
      "source",
      "*.important",
      undefined,
    );
  });

  it("should setup complete contract with all resources", async () => {
    // GIVEN
    const ordersExchange = defineExchange("orders", "topic", { durable: true });
    const analyticsExchange = defineExchange("analytics", "fanout");
    const orderQueue = defineQueue("order-processing", { durable: true });
    const analyticsQueue = defineQueue("analytics-processing");

    const contract = defineContract({
      exchanges: {
        orders: ordersExchange,
        analytics: analyticsExchange,
      },
      queues: {
        orderProcessing: orderQueue,
        analyticsProcessing: analyticsQueue,
      },
      bindings: {
        orderBinding: defineQueueBinding(orderQueue, ordersExchange, {
          routingKey: "order.#",
        }),
        analyticsBinding: defineQueueBinding(analyticsQueue, analyticsExchange),
        exchangeBinding: defineExchangeBinding(analyticsExchange, ordersExchange, {
          routingKey: "order.created",
        }),
      },
    });

    // WHEN
    await setupInfra(mockChannel, contract);

    // THEN
    expect(mockChannel.assertExchange).toHaveBeenCalledTimes(2);
    expect(mockChannel.assertQueue).toHaveBeenCalledTimes(2);
    expect(mockChannel.bindQueue).toHaveBeenCalledTimes(2);
    expect(mockChannel.bindExchange).toHaveBeenCalledTimes(1);
  });

  it("should handle empty contract", async () => {
    // GIVEN
    const contract = defineContract({});

    // WHEN
    await setupInfra(mockChannel, contract);

    // THEN
    expect(mockChannel.assertExchange).not.toHaveBeenCalled();
    expect(mockChannel.assertQueue).not.toHaveBeenCalled();
    expect(mockChannel.bindQueue).not.toHaveBeenCalled();
    expect(mockChannel.bindExchange).not.toHaveBeenCalled();
  });

  it("should handle fanout exchange binding without routing key", async () => {
    // GIVEN
    const fanoutExchange = defineExchange("fanout", "fanout");
    const orderQueue = defineQueue("order-queue");
    const contract = defineContract({
      exchanges: {
        fanout: fanoutExchange,
      },
      queues: {
        orderQueue: orderQueue,
      },
      bindings: {
        fanoutBinding: defineQueueBinding(orderQueue, fanoutExchange),
      },
    });

    // WHEN
    await setupInfra(mockChannel, contract);

    // THEN
    expect(mockChannel.bindQueue).toHaveBeenCalledWith("order-queue", "fanout", "", undefined);
  });

  it("should pass custom arguments to exchanges", async () => {
    // GIVEN
    const contract = defineContract({
      exchanges: {
        orders: defineExchange("orders", "topic", {
          durable: true,
          arguments: { "x-custom": "value" },
        }),
      },
    });

    // WHEN
    await setupInfra(mockChannel, contract);

    // THEN
    expect(mockChannel.assertExchange).toHaveBeenCalledWith("orders", "topic", {
      durable: true,
      autoDelete: undefined,
      internal: undefined,
      arguments: { "x-custom": "value" },
    });
  });

  it("should pass custom arguments to queues", async () => {
    // GIVEN
    const contract = defineContract({
      queues: {
        orders: defineQueue("orders", {
          durable: true,
          arguments: { "x-max-length": 1000 },
        }),
      },
    });

    // WHEN
    await setupInfra(mockChannel, contract);

    // THEN
    expect(mockChannel.assertQueue).toHaveBeenCalledWith("orders", {
      durable: true,
      exclusive: undefined,
      autoDelete: undefined,
      arguments: { "x-max-length": 1000 },
    });
  });

  it("should pass custom arguments to bindings", async () => {
    // GIVEN
    const exchange = defineExchange("orders", "topic");
    const queue = defineQueue("orders");
    const contract = defineContract({
      exchanges: { orders: exchange },
      queues: { orders: queue },
      bindings: {
        orderBinding: defineQueueBinding(queue, exchange, {
          routingKey: "order.#",
          arguments: { "x-match": "all" },
        }),
      },
    });

    // WHEN
    await setupInfra(mockChannel, contract);

    // THEN
    expect(mockChannel.bindQueue).toHaveBeenCalledWith("orders", "orders", "order.#", {
      "x-match": "all",
    });
  });
});
