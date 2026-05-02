import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineContract } from "./contract.js";
import { defineMessage } from "./message.js";
import { defineQueue } from "./queue.js";
import { defineRpcClient, defineRpcServer, isRpcClientConfig, isRpcServerConfig } from "./rpc.js";

describe("RPC builders", () => {
  const queue = defineQueue("rpc.calculate", { type: "classic", durable: false });
  const request = defineMessage(z.object({ a: z.number(), b: z.number() }));
  const response = defineMessage(z.object({ sum: z.number() }));

  describe("defineRpcServer", () => {
    it("creates an RpcServerConfig with both schemas and the queue", () => {
      const server = defineRpcServer(queue, { request, response });

      expect(server.__brand).toBe("RpcServerConfig");
      expect(server.queue).toBe(queue);
      expect(server.requestMessage).toBe(request);
      expect(server.responseMessage).toBe(response);
      expect(server.consumer.queue).toBe(queue);
      expect(server.consumer.message).toBe(request);
      expect(server.consumer.responseMessage).toBe(response);
    });

    it("is recognised by isRpcServerConfig", () => {
      const server = defineRpcServer(queue, { request, response });
      expect(isRpcServerConfig(server)).toBe(true);
      expect(isRpcServerConfig({})).toBe(false);
    });
  });

  describe("defineRpcClient", () => {
    it("creates an RpcClientConfig that publishes to the default exchange with the queue name as routing key", () => {
      const server = defineRpcServer(queue, { request, response });
      const client = defineRpcClient(server);

      expect(client.__brand).toBe("RpcClientConfig");
      expect(client.requestMessage).toBe(request);
      expect(client.responseMessage).toBe(response);
      expect(client.publisher.exchange.name).toBe("");
      expect(client.publisher.exchange.type).toBe("direct");
      expect(client.publisher.routingKey).toBe("rpc.calculate");
      expect(client.publisher.message).toBe(request);
      expect(client.publisher.responseMessage).toBe(response);
    });

    it("is recognised by isRpcClientConfig", () => {
      const server = defineRpcServer(queue, { request, response });
      const client = defineRpcClient(server);
      expect(isRpcClientConfig(client)).toBe(true);
      expect(isRpcClientConfig({})).toBe(false);
    });
  });

  describe("defineContract integration", () => {
    it("auto-extracts the RPC server's queue and the RPC client's publisher", () => {
      const server = defineRpcServer(queue, { request, response });
      const client = defineRpcClient(server);

      const contract = defineContract({
        consumers: { calculate: server },
        publishers: { calculate: client },
      });

      // Queue is registered in contract.queues
      expect(contract.queues["rpc.calculate"]).toBeDefined();

      // Consumer carries the response schema
      expect(contract.consumers.calculate.responseMessage).toBe(response);

      // Publisher targets the default exchange with the queue name as routing key
      expect(contract.publishers.calculate.exchange.name).toBe("");
      expect(contract.publishers.calculate.routingKey).toBe("rpc.calculate");
      expect(contract.publishers.calculate.responseMessage).toBe(response);

      // No binding is created — the default exchange handles routing implicitly
      expect(contract.bindings).toEqual({});
    });
  });
});
