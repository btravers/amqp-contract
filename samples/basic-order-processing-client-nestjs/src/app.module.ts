import { type ConfigType, Module } from "@nestjs/common";
import { AmqpClientModule } from "@amqp-contract/client-nestjs";
import { ConfigModule } from "@nestjs/config";
import {
  CreateOrderUseCase,
  ShipOrderUseCase,
  UrgentUpdateUseCase,
  UpdateOrderStatusUseCase,
} from "./use-cases/index.js";
import { amqpConfig } from "./config/amqp.config.js";
import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";

@Module({
  imports: [
    ConfigModule.forFeature(amqpConfig),
    AmqpClientModule.forRootAsync({
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
