import { registerAs } from "@nestjs/config";
import { z } from "zod";

export const amqpConfig = registerAs("amqp", () =>
  z
    .object({
      url: z.string().url().default("amqp://localhost:5672"),
    })
    .parse({
      url: process.env["AMQP_URL"],
    }),
);
