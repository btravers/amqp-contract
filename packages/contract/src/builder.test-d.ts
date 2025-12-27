import {
  defineConsumer,
  defineContract,
  defineExchange,
  defineMessage,
  definePublisher,
  defineQueue,
  defineQueueBinding,
  mergeContracts,
} from "./builder.js";
import { describe, expectTypeOf, it } from "vitest";
import type { ContractDefinition } from "./types.js";
import { z } from "zod";

describe("mergeContracts - Type Tests", () => {
  describe("Type safety and inference", () => {
    it("should return a valid ContractDefinition when merging two contracts with publishers", () => {
      // GIVEN
      const orderExchange = defineExchange("orders", "topic", { durable: true });
      const paymentExchange = defineExchange("payments", "topic", { durable: true });

      const orderMessage = defineMessage(z.object({ orderId: z.string() }));
      const paymentMessage = defineMessage(z.object({ paymentId: z.string() }));

      const orderContract = defineContract({
        exchanges: { orders: orderExchange },
        publishers: {
          orderCreated: definePublisher(orderExchange, orderMessage, {
            routingKey: "order.created",
          }),
        },
      });

      const paymentContract = defineContract({
        exchanges: { payments: paymentExchange },
        publishers: {
          paymentReceived: definePublisher(paymentExchange, paymentMessage, {
            routingKey: "payment.received",
          }),
        },
      });

      // WHEN
      const merged = mergeContracts(orderContract, paymentContract);

      // THEN - Verify result is a valid ContractDefinition
      expectTypeOf(merged).toMatchTypeOf<ContractDefinition>();
      expectTypeOf(merged).toHaveProperty("exchanges");
      expectTypeOf(merged).toHaveProperty("publishers");
    });

    it("should return a valid ContractDefinition when merging two contracts with consumers", () => {
      // GIVEN
      const orderQueue = defineQueue("orders", { durable: true });
      const paymentQueue = defineQueue("payments", { durable: true });

      const orderMessage = defineMessage(z.object({ orderId: z.string() }));
      const paymentMessage = defineMessage(z.object({ paymentId: z.string() }));

      const orderContract = defineContract({
        queues: { orders: orderQueue },
        consumers: {
          processOrder: defineConsumer(orderQueue, orderMessage),
        },
      });

      const paymentContract = defineContract({
        queues: { payments: paymentQueue },
        consumers: {
          processPayment: defineConsumer(paymentQueue, paymentMessage),
        },
      });

      // WHEN
      const merged = mergeContracts(orderContract, paymentContract);

      // THEN - Verify result is a valid ContractDefinition
      expectTypeOf(merged).toMatchTypeOf<ContractDefinition>();
      expectTypeOf(merged).toHaveProperty("queues");
      expectTypeOf(merged).toHaveProperty("consumers");
    });

    it("should return a valid ContractDefinition with all resource types", () => {
      // GIVEN
      const exchange1 = defineExchange("ex1", "topic", { durable: true });
      const exchange2 = defineExchange("ex2", "topic", { durable: true });
      const queue1 = defineQueue("q1", { durable: true });
      const queue2 = defineQueue("q2", { durable: true });
      const message1 = defineMessage(z.object({ id: z.string() }));
      const message2 = defineMessage(z.object({ value: z.number() }));

      const contract1 = defineContract({
        exchanges: { ex1: exchange1 },
        queues: { q1: queue1 },
        bindings: {
          b1: defineQueueBinding(queue1, exchange1, { routingKey: "test" }),
        },
        publishers: {
          pub1: definePublisher(exchange1, message1, { routingKey: "test" }),
        },
        consumers: {
          con1: defineConsumer(queue1, message1),
        },
      });

      const contract2 = defineContract({
        exchanges: { ex2: exchange2 },
        queues: { q2: queue2 },
        bindings: {
          b2: defineQueueBinding(queue2, exchange2, { routingKey: "test2" }),
        },
        publishers: {
          pub2: definePublisher(exchange2, message2, { routingKey: "test2" }),
        },
        consumers: {
          con2: defineConsumer(queue2, message2),
        },
      });

      // WHEN
      const merged = mergeContracts(contract1, contract2);

      // THEN - Verify result is a valid ContractDefinition with all resource types
      expectTypeOf(merged).toMatchTypeOf<ContractDefinition>();
      expectTypeOf(merged).toHaveProperty("exchanges");
      expectTypeOf(merged).toHaveProperty("queues");
      expectTypeOf(merged).toHaveProperty("bindings");
      expectTypeOf(merged).toHaveProperty("publishers");
      expectTypeOf(merged).toHaveProperty("consumers");
    });

    it("should return a valid ContractDefinition when merging three or more contracts", () => {
      // GIVEN
      const ex1 = defineExchange("ex1", "topic", { durable: true });
      const ex2 = defineExchange("ex2", "topic", { durable: true });
      const ex3 = defineExchange("ex3", "topic", { durable: true });
      const msg = defineMessage(z.object({ id: z.string() }));

      const contract1 = defineContract({
        exchanges: { ex1 },
        publishers: { pub1: definePublisher(ex1, msg, { routingKey: "test1" }) },
      });
      const contract2 = defineContract({
        exchanges: { ex2 },
        publishers: { pub2: definePublisher(ex2, msg, { routingKey: "test2" }) },
      });
      const contract3 = defineContract({
        exchanges: { ex3 },
        publishers: { pub3: definePublisher(ex3, msg, { routingKey: "test3" }) },
      });

      // WHEN
      const merged = mergeContracts(contract1, contract2, contract3);

      // THEN - Verify result is a valid ContractDefinition
      expectTypeOf(merged).toMatchTypeOf<ContractDefinition>();
      expectTypeOf(merged).toHaveProperty("exchanges");
      expectTypeOf(merged).toHaveProperty("publishers");
    });

    it("should return a valid ContractDefinition when handling empty contracts", () => {
      // GIVEN
      const exchange = defineExchange("test", "topic", { durable: true });
      const message = defineMessage(z.object({ id: z.string() }));
      const emptyContract = defineContract({});
      const fullContract = defineContract({
        exchanges: { test: exchange },
        publishers: { testPub: definePublisher(exchange, message, { routingKey: "test" }) },
      });

      // WHEN
      const merged = mergeContracts(emptyContract, fullContract);

      // THEN - Verify result is a valid ContractDefinition
      expectTypeOf(merged).toMatchTypeOf<ContractDefinition>();
      expectTypeOf(merged).toHaveProperty("exchanges");
      expectTypeOf(merged).toHaveProperty("publishers");
    });

    it("should return a valid ContractDefinition preserving types", () => {
      // GIVEN
      const ex1 = defineExchange("ex1", "topic", { durable: true });
      const ex2 = defineExchange("ex2", "topic", { durable: true });

      const contract1 = defineContract({
        exchanges: { ex1 },
      });
      const contract2 = defineContract({
        exchanges: { ex2 },
      });

      // WHEN
      const merged = mergeContracts(contract1, contract2);

      // THEN - Verify result is a valid ContractDefinition
      expectTypeOf(merged).toMatchTypeOf<ContractDefinition>();
      expectTypeOf(merged).toHaveProperty("exchanges");
    });

    it("should return a valid ContractDefinition when merging partial contracts", () => {
      // GIVEN
      const exchange = defineExchange("ex", "topic", { durable: true });
      const queue = defineQueue("q", { durable: true });
      const message = defineMessage(z.object({ id: z.string() }));

      const contractWithExchange = defineContract({ exchanges: { ex: exchange } });
      const contractWithQueue = defineContract({ queues: { q: queue } });
      const contractWithPublisher = defineContract({
        publishers: {
          pub: definePublisher(exchange, message, { routingKey: "test" }),
        },
      });

      // WHEN
      const merged = mergeContracts(contractWithExchange, contractWithQueue, contractWithPublisher);

      // THEN - Verify result is a valid ContractDefinition
      expectTypeOf(merged).toMatchTypeOf<ContractDefinition>();
      expectTypeOf(merged).toHaveProperty("exchanges");
      expectTypeOf(merged).toHaveProperty("queues");
      expectTypeOf(merged).toHaveProperty("publishers");
    });

    it("should return a valid ContractDefinition with different message types", () => {
      // GIVEN
      const exchange = defineExchange("ex", "topic", { durable: true });
      const orderMessage = defineMessage(
        z.object({
          orderId: z.string(),
          amount: z.number(),
        }),
      );
      const paymentMessage = defineMessage(
        z.object({
          paymentId: z.string(),
          total: z.number(),
        }),
      );

      const orderContract = defineContract({
        publishers: {
          orderCreated: definePublisher(exchange, orderMessage, {
            routingKey: "order.created",
          }),
        },
      });

      const paymentContract = defineContract({
        publishers: {
          paymentProcessed: definePublisher(exchange, paymentMessage, {
            routingKey: "payment.processed",
          }),
        },
      });

      // WHEN
      const merged = mergeContracts(orderContract, paymentContract);

      // THEN - Verify result is a valid ContractDefinition
      expectTypeOf(merged).toMatchTypeOf<ContractDefinition>();
      expectTypeOf(merged).toHaveProperty("publishers");
    });

    it("should return a valid ContractDefinition with only exchanges", () => {
      // GIVEN
      const ex1 = defineExchange("ex1", "topic", { durable: true });
      const ex2 = defineExchange("ex2", "direct", { durable: false });

      const contract1 = defineContract({ exchanges: { ex1 } });
      const contract2 = defineContract({ exchanges: { ex2 } });

      // WHEN
      const merged = mergeContracts(contract1, contract2);

      // THEN - Verify result is a valid ContractDefinition
      expectTypeOf(merged).toMatchTypeOf<ContractDefinition>();
      expectTypeOf(merged).toHaveProperty("exchanges");
    });

    it("should return a valid ContractDefinition for single contract", () => {
      // GIVEN
      const exchange = defineExchange("test", "topic", { durable: true });
      const message = defineMessage(z.object({ id: z.string() }));
      const contract = defineContract({
        exchanges: { test: exchange },
        publishers: { testPub: definePublisher(exchange, message, { routingKey: "test" }) },
      });

      // WHEN
      const merged = mergeContracts(contract);

      // THEN - Verify result is a valid ContractDefinition
      expectTypeOf(merged).toMatchTypeOf<ContractDefinition>();
      expectTypeOf(merged).toHaveProperty("exchanges");
      expectTypeOf(merged).toHaveProperty("publishers");
    });
  });
});
