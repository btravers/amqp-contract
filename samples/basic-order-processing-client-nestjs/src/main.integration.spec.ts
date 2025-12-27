import type { INestApplicationContext } from "@nestjs/common";
import { describe, expect } from "vitest";
import { bootstrap } from "./bootstrap.js";
import { it } from "@amqp-contract/testing/extension";
import {
  CreateOrderUseCase,
  ShipOrderUseCase,
  UrgentUpdateUseCase,
  UpdateOrderStatusUseCase,
} from "./use-cases/index.js";

const testIt = it.extend<{
  app: INestApplicationContext;
  createOrderUseCase: CreateOrderUseCase;
  updateOrderStatusUseCase: UpdateOrderStatusUseCase;
  shipOrderUseCase: ShipOrderUseCase;
  urgentUpdateUseCase: UrgentUpdateUseCase;
}>({
  app: async ({}, use) => {
    const app = await bootstrap();
    await use(app);
    await app.close();
  },
  createOrderUseCase: async ({ app }, use) => {
    await use(app.get(CreateOrderUseCase));
  },
  updateOrderStatusUseCase: async ({ app }, use) => {
    await use(app.get(UpdateOrderStatusUseCase));
  },
  shipOrderUseCase: async ({ app }, use) => {
    await use(app.get(ShipOrderUseCase));
  },
  urgentUpdateUseCase: async ({ app }, use) => {
    await use(app.get(UrgentUpdateUseCase));
  },
});

describe("NestJS Client Integration", () => {
  testIt("should publish a new order successfully", async ({ createOrderUseCase }) => {
    // GIVEN
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
    const result = await createOrderUseCase.execute(newOrder).resultToPromise();

    // THEN
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.get()).toEqual({ success: true });
    }
  });

  testIt("should publish order status updates", async ({ updateOrderStatusUseCase }) => {
    // WHEN
    const result = await updateOrderStatusUseCase
      .execute("TEST-001", "processing")
      .resultToPromise();

    // THEN
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.get()).toEqual({ success: true });
    }
  });

  testIt("should publish shipment notifications", async ({ shipOrderUseCase }) => {
    // WHEN
    const result = await shipOrderUseCase.execute("TEST-001").resultToPromise();

    // THEN
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.get()).toEqual({ success: true });
    }
  });

  testIt("should publish urgent updates", async ({ urgentUpdateUseCase }) => {
    // WHEN
    const result = await urgentUpdateUseCase.execute("TEST-002", "cancelled").resultToPromise();

    // THEN
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.get()).toEqual({ success: true });
    }
  });
});
