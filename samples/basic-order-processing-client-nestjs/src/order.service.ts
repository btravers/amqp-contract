import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import {
  CreateOrderUseCase,
  type CreateOrderInput,
  ShipOrderUseCase,
  UrgentUpdateUseCase,
  UpdateOrderStatusUseCase,
} from "./use-cases/index.js";

/**
 * OrderService acts as a facade/adapter layer
 * that coordinates business use cases.
 * Following clean architecture principles:
 * - This service is in the "interface adapter" layer
 * - Use cases contain the business logic (application layer)
 * - AmqpClient is the infrastructure layer
 */
@Injectable()
export class OrderService implements OnModuleInit {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly createOrderUseCase: CreateOrderUseCase,
    private readonly updateOrderStatusUseCase: UpdateOrderStatusUseCase,
    private readonly shipOrderUseCase: ShipOrderUseCase,
    private readonly urgentUpdateUseCase: UrgentUpdateUseCase,
  ) {}

  async onModuleInit() {
    this.logger.log("OrderService initialized and ready to publish orders");
  }

  /**
   * Create and publish a new order event
   */
  async createOrder(order: CreateOrderInput) {
    return this.createOrderUseCase.execute(order);
  }

  /**
   * Publish an order status update
   */
  async updateOrderStatus(
    orderId: string,
    status: "processing" | "shipped" | "delivered" | "cancelled",
  ) {
    return this.updateOrderStatusUseCase.execute(orderId, status);
  }

  /**
   * Publish a shipped order event
   */
  async shipOrder(orderId: string) {
    return this.shipOrderUseCase.execute(orderId);
  }

  /**
   * Publish an urgent order update
   */
  async urgentUpdate(
    orderId: string,
    status: "processing" | "shipped" | "delivered" | "cancelled",
  ) {
    return this.urgentUpdateUseCase.execute(orderId, status);
  }
}
