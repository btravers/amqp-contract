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
import type { MergeContracts } from "./types.js";
import { z } from "zod";

describe("mergeContracts - Type Tests", () => {
  describe("Type safety and inference", () => {
    it("should merge two contracts with publishers", () => {
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

      // THEN - Verify merged type matches expected structure
      type Expected = MergeContracts<[typeof orderContract, typeof paymentContract]>;
      expectTypeOf(merged).toMatchTypeOf<Expected>();
    });

    it("should merge two contracts with consumers", () => {
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

      // THEN - Verify merged type matches expected structure
      type Expected = MergeContracts<[typeof orderContract, typeof paymentContract]>;
      expectTypeOf(merged).toMatchTypeOf<Expected>();
    });

    it("should merge all resource types", () => {
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

      // THEN - Verify merged type matches expected structure with all resources
      type Expected = MergeContracts<[typeof contract1, typeof contract2]>;
      expectTypeOf(merged).toMatchTypeOf<Expected>();
    });

    it("should merge three or more contracts", () => {
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

      // THEN - Verify merged type matches expected structure with all three contracts
      type Expected = MergeContracts<[typeof contract1, typeof contract2, typeof contract3]>;
      expectTypeOf(merged).toMatchTypeOf<Expected>();
    });

    it("should handle empty contracts in merge", () => {
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

      // THEN - Verify merged type matches expected structure
      type Expected = MergeContracts<[typeof emptyContract, typeof fullContract]>;
      expectTypeOf(merged).toMatchTypeOf<Expected>();
    });

    it("should preserve exact types when merging", () => {
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

      // THEN - Verify merged type matches expected structure
      type Expected = MergeContracts<[typeof contract1, typeof contract2]>;
      expectTypeOf(merged).toMatchTypeOf<Expected>();
    });

    it("should merge partial contracts with exact types", () => {
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

      // THEN - Verify merged type matches expected structure
      type Expected = MergeContracts<
        [typeof contractWithExchange, typeof contractWithQueue, typeof contractWithPublisher]
      >;
      expectTypeOf(merged).toMatchTypeOf<Expected>();
    });

    it("should merge publishers with different message types", () => {
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

      // THEN - Verify merged type matches expected structure
      type Expected = MergeContracts<[typeof orderContract, typeof paymentContract]>;
      expectTypeOf(merged).toMatchTypeOf<Expected>();
    });

    it("should merge contracts with only exchanges", () => {
      // GIVEN
      const ex1 = defineExchange("ex1", "topic", { durable: true });
      const ex2 = defineExchange("ex2", "direct", { durable: false });

      const contract1 = defineContract({ exchanges: { ex1 } });
      const contract2 = defineContract({ exchanges: { ex2 } });

      // WHEN
      const merged = mergeContracts(contract1, contract2);

      // THEN - Verify merged type matches expected structure
      type Expected = MergeContracts<[typeof contract1, typeof contract2]>;
      expectTypeOf(merged).toMatchTypeOf<Expected>();
    });

    it("should preserve exact types for single contract", () => {
      // GIVEN
      const exchange = defineExchange("test", "topic", { durable: true });
      const message = defineMessage(z.object({ id: z.string() }));
      const contract = defineContract({
        exchanges: { test: exchange },
        publishers: { testPub: definePublisher(exchange, message, { routingKey: "test" }) },
      });

      // WHEN
      const merged = mergeContracts(contract);

      // THEN - Verify merged type matches expected structure
      type Expected = MergeContracts<[typeof contract]>;
      expectTypeOf(merged).toMatchTypeOf<Expected>();
    });
  });
});
