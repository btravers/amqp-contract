import { Logger, Module } from "@nestjs/common";
import { ConfigModule as NestConfigModule } from "@nestjs/config";
import {
  HandleUrgentOrderHandler,
  NotifyOrderHandler,
  ProcessAnalyticsHandler,
  ProcessOrderHandler,
  ShipOrderHandler,
} from "./handlers/index.js";
import { AmqpWorkerModule } from "@amqp-contract/worker-nestjs";
import { z } from "zod";
import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";

const envSchema = z.object({
  AMQP_URL: z.string().url().default("amqp://localhost:5672"),
});

@Module({
  imports: [
    NestConfigModule.forFeature(() => {
      const config = envSchema.parse(process.env);
      return config;
    }),
    AmqpWorkerModule.forRootAsync({
      inject: [
        ProcessOrderHandler,
        NotifyOrderHandler,
        ShipOrderHandler,
        HandleUrgentOrderHandler,
        ProcessAnalyticsHandler,
      ],
      useFactory: (
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
        urls: [process.env["AMQP_URL"] || "amqp://localhost:5672"],
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
