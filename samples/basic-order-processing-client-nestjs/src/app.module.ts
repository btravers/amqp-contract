import { ConfigModule, ConfigType } from "@nestjs/config";
import {
  CreateOrderUseCase,
  ShipOrderUseCase,
  UpdateOrderStatusUseCase,
  UrgentUpdateUseCase,
} from "./use-cases/index.js";
import { AmqpClientModule } from "@amqp-contract/client-nestjs";
import { Module } from "@nestjs/common";
import { amqpConfig } from "./config/amqp.config.js";
import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";

@Module({
  imports: [
    ConfigModule.forFeature(amqpConfig),
    AmqpClientModule.forRootAsync({
      imports: [ConfigModule.forFeature(amqpConfig)],
      inject: [amqpConfig.KEY],
      useFactory: (config: ConfigType<typeof amqpConfig>) => ({
        contract: orderContract,
        urls: [config.url],
      }),
    }),
  ],
  providers: [
    // Use Cases (Application Layer) - inject directly
    CreateOrderUseCase,
    UpdateOrderStatusUseCase,
    ShipOrderUseCase,
    UrgentUpdateUseCase,
  ],
  exports: [CreateOrderUseCase, UpdateOrderStatusUseCase, ShipOrderUseCase, UrgentUpdateUseCase],
})
export class AppModule {}
