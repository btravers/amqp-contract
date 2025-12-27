import { ConfigModule, ConfigType } from "@nestjs/config";
import { Logger, Module } from "@nestjs/common";
import { AmqpWorkerModule } from "@amqp-contract/worker-nestjs";
import { amqpConfig } from "./config/amqp.config.js";
import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";

@Module({
  imports: [
    ConfigModule.forFeature(amqpConfig),
    AmqpWorkerModule.forRootAsync({
      imports: [ConfigModule.forFeature(amqpConfig)],
      inject: [amqpConfig.KEY],
      useFactory: (config: ConfigType<typeof amqpConfig>) => ({
        contract: orderContract,
        handlers: {
          processOrder: async (message) => {
            console.log(`[PROCESSING] New order received: ${message.orderId}`);
          },
          notifyOrder: async (message) => {
            console.log(`[NOTIFICATION] Order event: ${message.orderId}`);
          },
          shipOrder: async (message) => {
            console.log(`[SHIPPING] Order shipped: ${message.orderId}`);
          },
          handleUrgentOrder: async (message) => {
            console.log(`[URGENT] Urgent order: ${message.orderId}`);
          },
          processAnalytics: async (message) => {
            console.log(`[ANALYTICS] Processing analytics for: ${message.orderId}`);
          },
        },
        urls: [config.url],
        logger: new Logger("AmqpWorker"),
      }),
    }),
  ],
  providers: [Logger],
})
export class AppModule {}
