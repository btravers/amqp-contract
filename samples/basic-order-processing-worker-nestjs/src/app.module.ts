import { ConfigModule, ConfigType } from "@nestjs/config";
import {
  HandleUrgentOrderHandler,
  HandlersModule,
  NotifyOrderHandler,
  ProcessAnalyticsHandler,
  ProcessOrderHandler,
  ShipOrderHandler,
} from "./handlers";
import { AmqpWorkerModule } from "@amqp-contract/worker-nestjs";
import { Module } from "@nestjs/common";
import { amqpConfig } from "./config/amqp.config.js";
import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";

@Module({
  imports: [
    ConfigModule.forFeature(amqpConfig),
    AmqpWorkerModule.forRootAsync({
      imports: [ConfigModule.forFeature(amqpConfig), HandlersModule],
      inject: [
        ProcessOrderHandler,
        NotifyOrderHandler,
        ShipOrderHandler,
        HandleUrgentOrderHandler,
        ProcessAnalyticsHandler,
        amqpConfig.KEY,
      ],
      useFactory: (
        processOrder: ProcessOrderHandler,
        notifyOrder: NotifyOrderHandler,
        shipOrder: ShipOrderHandler,
        handleUrgentOrder: HandleUrgentOrderHandler,
        processAnalytics: ProcessAnalyticsHandler,
        config: ConfigType<typeof amqpConfig>,
      ) => ({
        contract: orderContract,
        handlers: {
          processOrder: processOrder.handler,
          notifyOrder: notifyOrder.handler,
          shipOrder: shipOrder.handler,
          handleUrgentOrder: handleUrgentOrder.handler,
          processAnalytics: processAnalytics.handler,
        },
        urls: [config.url],
      }),
    }),
  ],
})
export class AppModule {}
