import { describe, expect } from "vitest";
import { it } from "@amqp-contract/testing/extension";
import { Result } from "@swan-io/boxed";
import { TypedAmqpClient } from "@amqp-contract/client";
import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";

describe("Basic Order Processing Client Integration", () => {
  it("should publish a new order successfully", async ({ amqpConnectionUrl }) => {
    // GIVEN
    const clientResult = await TypedAmqpClient.create({
      contract: orderContract,
      urls: [amqpConnectionUrl],
    });

    expect(clientResult.isOk()).toBe(true);
    const client = clientResult.get();

    const newOrder = {
      orderId: "TEST-001",
      customerId: "CUST-123",
      items: [
        { productId: "PROD-A", quantity: 2, price: 29.99 },
        { productId: "PROD-B", quantity: 1, price: 49.99 },
      ],
      totalAmount: 109.97,
      createdAt: new Date().toISOString(),
    };

    // WHEN
    const result = await client.publish("orderCreated", newOrder);

    // THEN
    expect(result).toEqual(Result.Ok(true));

    // CLEANUP
    await client.close().resultToPromise();
  });

  it("should publish order status updates", async ({ amqpConnectionUrl }) => {
    // GIVEN
    const clientResult = await TypedAmqpClient.create({
      contract: orderContract,
      urls: [amqpConnectionUrl],
    });

    expect(clientResult.isOk()).toBe(true);
    const client = clientResult.get();

    const orderUpdate = {
      orderId: "TEST-001",
      status: "processing" as const,
      updatedAt: new Date().toISOString(),
    };

    // WHEN
    const result = await client.publish("orderUpdated", orderUpdate);

    // THEN
    expect(result).toEqual(Result.Ok(true));

    // CLEANUP
    await client.close().resultToPromise();
  });

  it("should validate order schema before publishing", async ({ amqpConnectionUrl }) => {
    // GIVEN
    const clientResult = await TypedAmqpClient.create({
      contract: orderContract,
      urls: [amqpConnectionUrl],
    });

    expect(clientResult.isOk()).toBe(true);
    const client = clientResult.get();

    const invalidOrder = {
      orderId: "TEST-001",
      customerId: "CUST-123",
      items: [
        { productId: "PROD-A", quantity: -1, price: 29.99 }, // Invalid: negative quantity
      ],
      totalAmount: 29.99,
      createdAt: new Date().toISOString(),
    };

    // WHEN
    const result = await client.publish("orderCreated", invalidOrder);

    // THEN
    expect(result.isError()).toBe(true);

    // CLEANUP
    await client.close().resultToPromise();
  });
});
