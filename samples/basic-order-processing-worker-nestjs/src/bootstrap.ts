import { AppModule } from "./app.module.js";
import { NestFactory } from "@nestjs/core";

/**
 * Bootstrap the NestJS application
 * This function creates and initializes the application context
 */
export async function bootstrap() {
  return await NestFactory.createApplicationContext(AppModule, {
    logger: ["log", "error", "warn", "debug", "verbose"],
  });
}
