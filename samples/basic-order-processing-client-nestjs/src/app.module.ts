import { AmqpClientModule } from "@amqp-contract/client-nestjs";
import { ConfigModule as NestConfigModule } from "@nestjs/config";
import { OrderService } from "./order.service.js";
import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";
import { Module } from "@nestjs/common";
import { z } from "zod";

const envSchema = z.object({
  AMQP_URL: z.string().url().default("amqp://localhost:5672"),
});

export type AppConfig = z.infer<typeof envSchema>;

@Module({
  imports: [
    NestConfigModule.forFeature(() => {
      const config = envSchema.parse(process.env);
      return config;
    }),
    AmqpClientModule.forRootAsync({
      useFactory: () => ({
        contract: orderContract,
        urls: [process.env["AMQP_URL"] || "amqp://localhost:5672"],
      }),
    }),
  ],
  providers: [OrderService],
  exports: [OrderService],
})
export class AppModule {}
