import { beforeEach, describe, expect } from "vitest";
import type { ContractDefinition } from "@amqp-contract/contract";
import { defineExchange } from "@amqp-contract/contract";
import { AmqpClient } from "../amqp-client.js";
import { it } from "@amqp-contract/testing/extension";

describe("AmqpClient Connection Sharing Integration", () => {
  beforeEach(async () => {
    // Reset connection cache between tests
    await AmqpClient._resetConnectionCacheForTesting();
  });

  it("should reuse connection for clients with same URLs", async ({ amqpConnectionUrl }) => {
    // GIVEN
    const contract: ContractDefinition = {
      exchanges: {
        orders: defineExchange("orders", { durable: false }),
      },
    };

    const urls = [amqpConnectionUrl];

    // WHEN - Create two clients with same URLs
    const client1 = new AmqpClient(contract, { urls });
    const client2 = new AmqpClient(contract, { urls });

    (await client1.waitForConnect())._unsafeUnwrap();
    (await client2.waitForConnect())._unsafeUnwrap();

    // THEN - Both clients should share the same connection instance
    expect(client1.getConnection()).toBe(client2.getConnection());

    // CLEANUP
    (await client1.close())._unsafeUnwrap();
    (await client2.close())._unsafeUnwrap();
  });

  it("should create separate connections for different URLs", async ({ amqpConnectionUrl }) => {
    // GIVEN
    const contract: ContractDefinition = {
      exchanges: {
        orders: defineExchange("orders", { durable: false }),
      },
    };

    // WHEN - Create two clients with different URLs
    // Use same URL but with different vhost paths to make them different
    const client1 = new AmqpClient(contract, { urls: [amqpConnectionUrl] });
    const client2 = new AmqpClient(contract, { urls: [`${amqpConnectionUrl}-different`] });

    (await client1.waitForConnect())._unsafeUnwrap();
    // client2 will fail to connect due to invalid URL, but that's okay for this test

    // THEN - Connections should be different instances
    expect(client1.getConnection()).toBeDefined();
    expect(client2.getConnection()).toBeDefined();
    expect(client1.getConnection()).not.toBe(client2.getConnection());

    // CLEANUP
    (await client1.close())._unsafeUnwrap();
    (await client2.close())._unsafeUnwrap();
  });

  it("should maintain connection when only one client closes", async ({ amqpConnectionUrl }) => {
    // GIVEN
    const contract: ContractDefinition = {
      exchanges: {
        test: defineExchange("test", { durable: false }),
      },
    };

    const urls = [amqpConnectionUrl];
    const client1 = new AmqpClient(contract, { urls });
    const client2 = new AmqpClient(contract, { urls });

    (await client1.waitForConnect())._unsafeUnwrap();
    (await client2.waitForConnect())._unsafeUnwrap();

    const sharedConnection = client1.getConnection();

    // WHEN - Close first client
    (await client1.close())._unsafeUnwrap();

    // THEN - Connection should still be alive (used by client2)
    expect(sharedConnection.isConnected()).toBe(true);

    // CLEANUP
    (await client2.close())._unsafeUnwrap();
  });

  it("should close connection when last client closes", async ({ amqpConnectionUrl }) => {
    // GIVEN
    const contract: ContractDefinition = {
      exchanges: {
        test: defineExchange("test", { durable: false }),
      },
    };

    const urls = [amqpConnectionUrl];
    const client1 = new AmqpClient(contract, { urls });
    const client2 = new AmqpClient(contract, { urls });

    (await client1.waitForConnect())._unsafeUnwrap();
    (await client2.waitForConnect())._unsafeUnwrap();

    const sharedConnection = client1.getConnection();

    // WHEN - Close both clients
    (await client1.close())._unsafeUnwrap();
    (await client2.close())._unsafeUnwrap();

    // Give connection a moment to close
    await new Promise((resolve) => setTimeout(resolve, 100));

    // THEN - Connection should be closed
    expect(sharedConnection.isConnected()).toBe(false);
  });

  it("should handle multiple clients with mixed URLs", async ({ amqpConnectionUrl }) => {
    // GIVEN
    const contract: ContractDefinition = {
      exchanges: {
        test: defineExchange("test", { durable: false }),
      },
    };

    const urls1 = [amqpConnectionUrl];
    const urls2 = [`${amqpConnectionUrl}-alt`];

    // WHEN - Create clients with different URLs
    const client1a = new AmqpClient(contract, { urls: urls1 });
    const client1b = new AmqpClient(contract, { urls: urls1 });
    const client2a = new AmqpClient(contract, { urls: urls2 });

    (await client1a.waitForConnect())._unsafeUnwrap();
    (await client1b.waitForConnect())._unsafeUnwrap();
    // client2a will fail to connect but that's okay

    // THEN - Clients with same URLs should share connection
    expect(client1a.getConnection()).toBe(client1b.getConnection());
    expect(client1a.getConnection()).not.toBe(client2a.getConnection());

    // CLEANUP
    (await client1a.close())._unsafeUnwrap();
    (await client1b.close())._unsafeUnwrap();
    (await client2a.close())._unsafeUnwrap();
  });

  it("should handle rapid create and close cycles", async ({ amqpConnectionUrl }) => {
    // GIVEN
    const contract: ContractDefinition = {
      exchanges: {
        test: defineExchange("test", { durable: false }),
      },
    };

    const urls = [amqpConnectionUrl];

    // WHEN - Rapidly create and close clients
    for (let i = 0; i < 5; i++) {
      const client = new AmqpClient(contract, { urls });
      (await client.waitForConnect())._unsafeUnwrap();
      (await client.close())._unsafeUnwrap();
    }

    // THEN - Should not throw errors and last close should clean up connection
    const finalClient = new AmqpClient(contract, { urls });
    (await finalClient.waitForConnect())._unsafeUnwrap();
    expect(finalClient.getConnection()).toBeDefined();

    // CLEANUP
    (await finalClient.close())._unsafeUnwrap();
  });
});
