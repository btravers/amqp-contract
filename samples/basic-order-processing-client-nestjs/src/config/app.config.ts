import { registerAs } from "@nestjs/config";
import { z } from "zod";

const envSchema = z.object({
  AMQP_URL: z.string().url().default("amqp://localhost:5672"),
});

export const appConfig = registerAs("app", () => {
  const parsed = envSchema.parse(process.env);
  return parsed;
});

export type AppConfig = z.infer<typeof envSchema>;
