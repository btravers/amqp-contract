import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineContract } from "./contract.js";
import { defineMessage } from "./message.js";
import { defineQueue } from "./queue.js";
import { defineRpc } from "./rpc.js";

describe("defineRpc", () => {
  const queue = defineQueue("rpc.calculate", { type: "classic", durable: false });
  const request = defineMessage(z.object({ a: z.number(), b: z.number() }));
  const response = defineMessage(z.object({ sum: z.number() }));

  it("returns an RpcDefinition carrying the queue, request, and response", () => {
    // WHEN
    const rpc = defineRpc(queue, { request, response });

    // THEN
    expect(rpc).toEqual({ queue, request, response });
  });

  describe("defineContract integration", () => {
    it("auto-extracts the RPC's queue and exposes it under contract.rpcs", () => {
      // GIVEN
      const calculate = defineRpc(queue, { request, response });

      // WHEN
      const contract = defineContract({
        rpcs: { calculate },
      });

      // THEN
      expect(contract).toMatchObject({
        // Queue registered, default exchange skipped — RPC routes implicitly
        // via the AMQP default exchange with the queue name as routing key.
        queues: { "rpc.calculate": queue },
        rpcs: { calculate: { queue, request, response } },
        // RPCs do not appear in publishers / consumers; no bindings either.
        publishers: {},
        consumers: {},
        bindings: {},
      });
    });

    it("throws when an RPC name collides with a consumer name", () => {
      // GIVEN
      const calculate = defineRpc(queue, { request, response });
      const consumerQueue = defineQueue("consumer-queue", { type: "classic", durable: false });
      const consumer = { queue: consumerQueue, message: request };

      // WHEN / THEN
      expect(() =>
        defineContract({
          consumers: { calculate: consumer },
          rpcs: { calculate },
        }),
      ).toThrow(/name collision between consumers and rpcs/);
    });

    it("auto-extracts the RPC's dead-letter exchange when configured", () => {
      // GIVEN
      const dlx = { name: "rpc.dlx", type: "topic" as const, durable: true };
      const dlqQueue = defineQueue("rpc.with-dlx", {
        type: "classic",
        durable: false,
        deadLetter: { exchange: dlx },
      });
      const calculate = defineRpc(dlqQueue, { request, response });

      // WHEN
      const contract = defineContract({
        rpcs: { calculate },
      });

      // THEN
      expect(contract.exchanges).toMatchObject({ "rpc.dlx": dlx });
    });
  });
});
