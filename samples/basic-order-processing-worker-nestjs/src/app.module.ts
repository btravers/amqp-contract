import { ConfigModule, ConfigType } from "@nestjs/config";
import {
  HandleUrgentOrderHandler,
  NotifyOrderHandler,
  ProcessAnalyticsHandler,
  ProcessOrderHandler,
  ShipOrderHandler,
} from "./handlers/index.js";
import { Logger, Module } from "@nestjs/common";
import { AmqpWorkerModule } from "@amqp-contract/worker-nestjs";
import { amqpConfig } from "./config/amqp.config.js";
import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";

@Module({
  imports: [
    ConfigModule.forFeature(amqpConfig),
    AmqpWorkerModule.forRootAsync({
      imports: [ConfigModule.forFeature(amqpConfig)],
      inject: [
        amqpConfig.KEY,
        Logger,
        ProcessOrderHandler,
        NotifyOrderHandler,
        ShipOrderHandler,
        HandleUrgentOrderHandler,
        ProcessAnalyticsHandler,
      ],
      useFactory: (
        config: ConfigType<typeof amqpConfig>,
        logger: Logger,
        processOrder: ProcessOrderHandler,
        notifyOrder: NotifyOrderHandler,
        shipOrder: ShipOrderHandler,
        handleUrgentOrder: HandleUrgentOrderHandler,
        processAnalytics: ProcessAnalyticsHandler,
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
        logger,
      }),
    }),
  ],
  providers: [
    Logger,
    ProcessOrderHandler,
    NotifyOrderHandler,
    ShipOrderHandler,
    HandleUrgentOrderHandler,
    ProcessAnalyticsHandler,
  ],
})
export class AppModule {}
