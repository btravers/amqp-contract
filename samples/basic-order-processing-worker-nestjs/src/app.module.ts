import {
  handleUrgentOrderHandler,
  notifyOrderHandler,
  processAnalyticsHandler,
  processOrderHandler,
  shipOrderHandler,
} from "./handlers/index.js";
import { AmqpWorkerModule } from "@amqp-contract/worker-nestjs";
import { Module } from "@nestjs/common";
import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";
import { z } from "zod";

const env = z
  .object({
    AMQP_URL: z.string().url().default("amqp://localhost:5672"),
  })
  .parse(process.env);

@Module({
  imports: [
    AmqpWorkerModule.forRoot({
      contract: orderContract,
      handlers: {
        processOrder: processOrderHandler,
        notifyOrder: notifyOrderHandler,
        shipOrder: shipOrderHandler,
        handleUrgentOrder: handleUrgentOrderHandler,
        processAnalytics: processAnalyticsHandler,
      },
      urls: [env.AMQP_URL],
    }),
  ],
})
export class AppModule {}
