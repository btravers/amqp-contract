import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { AmqpClientService } from "@amqp-contract/client-nestjs";
import type { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";

@Injectable()
export class OrderService implements OnModuleInit {
  private readonly logger = new Logger(OrderService.name);

  constructor(private readonly amqpClient: AmqpClientService<typeof orderContract>) {}

  async onModuleInit() {
    this.logger.log("OrderService initialized and ready to publish orders");
  }

  /**
   * Publish a new order event
   */
  async createOrder(order: {
    orderId: string;
    customerId: string;
    items: Array<{ productId: string; quantity: number; price: number }>;
    totalAmount: number;
  }) {
    const result = await this.amqpClient.publish("orderCreated", {
      ...order,
      createdAt: new Date().toISOString(),
    });

    if (result.isError()) {
      this.logger.error(`Failed to publish order ${order.orderId}`, result.error);
      throw result.error;
    }

    this.logger.log(`Published order ${order.orderId}`);
    return { success: true };
  }

  /**
   * Publish an order status update
   */
  async updateOrderStatus(
    orderId: string,
    status: "processing" | "shipped" | "delivered" | "cancelled",
  ) {
    const result = await this.amqpClient.publish("orderUpdated", {
      orderId,
      status,
      updatedAt: new Date().toISOString(),
    });

    if (result.isError()) {
      this.logger.error(`Failed to publish order update for ${orderId}`, result.error);
      throw result.error;
    }

    this.logger.log(`Published order update for ${orderId}: ${status}`);
    return { success: true };
  }

  /**
   * Publish a shipped order event
   */
  async shipOrder(orderId: string) {
    const result = await this.amqpClient.publish("orderShipped", {
      orderId,
      status: "shipped",
      updatedAt: new Date().toISOString(),
    });

    if (result.isError()) {
      this.logger.error(`Failed to publish shipment for ${orderId}`, result.error);
      throw result.error;
    }

    this.logger.log(`Published shipment for ${orderId}`);
    return { success: true };
  }

  /**
   * Publish an urgent order update
   */
  async urgentUpdate(
    orderId: string,
    status: "processing" | "shipped" | "delivered" | "cancelled",
  ) {
    const result = await this.amqpClient.publish("orderUrgentUpdate", {
      orderId,
      status,
      updatedAt: new Date().toISOString(),
    });

    if (result.isError()) {
      this.logger.error(`Failed to publish urgent update for ${orderId}`, result.error);
      throw result.error;
    }

    this.logger.warn(`Published urgent update for ${orderId}: ${status}`);
    return { success: true };
  }
}
