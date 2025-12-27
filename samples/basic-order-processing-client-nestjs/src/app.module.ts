import { type ConfigType, Module } from "@nestjs/common";
import { AmqpClientModule } from "@amqp-contract/client-nestjs";
import { ConfigModule } from "@nestjs/config";
import { OrderService } from "./order.service.js";
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
  providers: [OrderService],
  exports: [OrderService],
})
export class AppModule {}
