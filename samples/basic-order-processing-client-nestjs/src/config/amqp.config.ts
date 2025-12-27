import { registerAs } from "@nestjs/config";
import { z } from "zod";

const amqpConfigSchema = z.object({
  url: z.string().url().default("amqp://localhost:5672"),
});

export type AmqpConfig = z.infer<typeof amqpConfigSchema>;

export const amqpConfig = registerAs("amqp", () => {
  return amqpConfigSchema.parse({
    url: process.env["AMQP_URL"],
  });
});
