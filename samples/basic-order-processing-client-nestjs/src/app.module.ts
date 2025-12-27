import { AmqpClientModule } from "@amqp-contract/client-nestjs";
import { Module } from "@nestjs/common";
import { OrderService } from "./order.service.js";
import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";
import { z } from "zod";

const env = z
  .object({
    AMQP_URL: z.string().url().default("amqp://localhost:5672"),
  })
  .parse(process.env);

@Module({
  imports: [
    AmqpClientModule.forRoot({
      contract: orderContract,
      urls: [env.AMQP_URL],
    }),
  ],
  providers: [OrderService],
  exports: [OrderService],
})
export class AppModule {}
