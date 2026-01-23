import { ConfigModule, ConfigType } from "@nestjs/config";
import {
  HandleFailedOrdersHandler,
  HandleUrgentOrderHandler,
  HandlersModule,
  NotifyOrderHandler,
  ProcessOrderHandler,
  ShipOrderHandler,
} from "./handlers/index.js";
import { AmqpWorkerModule } from "@amqp-contract/worker-nestjs";
import { Module } from "@nestjs/common";
import { amqpConfig } from "./config/amqp.config.js";
import { orderContract } from "@amqp-contract-examples/basic-order-processing-contract";

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
        HandleFailedOrdersHandler,
        amqpConfig.KEY,
      ],
      useFactory: (
        processOrder: ProcessOrderHandler,
        notifyOrder: NotifyOrderHandler,
        shipOrder: ShipOrderHandler,
        handleUrgentOrder: HandleUrgentOrderHandler,
        handleFailedOrders: HandleFailedOrdersHandler,
        config: ConfigType<typeof amqpConfig>,
      ) => ({
        contract: orderContract,
        handlers: {
          processOrder: processOrder.handler,
          notifyOrder: notifyOrder.handler,
          shipOrder: shipOrder.handler,
          handleUrgentOrder: handleUrgentOrder.handler,
          handleFailedOrders: handleFailedOrders.handler,
        },
        urls: [config.url],
      }),
    }),
  ],
})
export class AppModule {}
