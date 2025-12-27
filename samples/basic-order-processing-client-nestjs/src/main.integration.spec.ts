import { AmqpClientModule } from "@amqp-contract/client-nestjs";
import { describe, expect } from "vitest";
import { it } from "@amqp-contract/testing/extension";
import { OrderService } from "./order.service.js";
import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";
import { Test, type TestingModule } from "@nestjs/testing";

describe("NestJS Client Integration", () => {
  it("should publish a new order successfully", async ({ amqpConnectionUrl }) => {
    // GIVEN
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        AmqpClientModule.forRoot({
          contract: orderContract,
          urls: [amqpConnectionUrl],
        }),
      ],
      providers: [OrderService],
    }).compile();

    const orderService = moduleRef.get<OrderService>(OrderService);

    const newOrder = {
      orderId: "TEST-001",
      customerId: "CUST-123",
      items: [
        { productId: "PROD-A", quantity: 2, price: 29.99 },
        { productId: "PROD-B", quantity: 1, price: 49.99 },
      ],
      totalAmount: 109.97,
    };

    // WHEN
    const result = await orderService.createOrder(newOrder);

    // THEN
    expect(result).toEqual({ success: true });

    // CLEANUP
    await moduleRef.close();
  });

  it("should publish order status updates", async ({ amqpConnectionUrl }) => {
    // GIVEN
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        AmqpClientModule.forRoot({
          contract: orderContract,
          urls: [amqpConnectionUrl],
        }),
      ],
      providers: [OrderService],
    }).compile();

    const orderService = moduleRef.get<OrderService>(OrderService);

    // WHEN
    const result = await orderService.updateOrderStatus("TEST-001", "processing");

    // THEN
    expect(result).toEqual({ success: true });

    // CLEANUP
    await moduleRef.close();
  });

  it("should publish shipment notifications", async ({ amqpConnectionUrl }) => {
    // GIVEN
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        AmqpClientModule.forRoot({
          contract: orderContract,
          urls: [amqpConnectionUrl],
        }),
      ],
      providers: [OrderService],
    }).compile();

    const orderService = moduleRef.get<OrderService>(OrderService);

    // WHEN
    const result = await orderService.shipOrder("TEST-001");

    // THEN
    expect(result).toEqual({ success: true });

    // CLEANUP
    await moduleRef.close();
  });

  it("should publish urgent updates", async ({ amqpConnectionUrl }) => {
    // GIVEN
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        AmqpClientModule.forRoot({
          contract: orderContract,
          urls: [amqpConnectionUrl],
        }),
      ],
      providers: [OrderService],
    }).compile();

    const orderService = moduleRef.get<OrderService>(OrderService);

    // WHEN
    const result = await orderService.urgentUpdate("TEST-002", "cancelled");

    // THEN
    expect(result).toEqual({ success: true });

    // CLEANUP
    await moduleRef.close();
  });
});
