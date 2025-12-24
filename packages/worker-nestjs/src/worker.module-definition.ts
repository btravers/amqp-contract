/**
 * Injection token for AMQP worker module options
 * Used by NestJS DI system to inject configuration into AmqpWorkerService
 */
export const MODULE_OPTIONS_TOKEN = Symbol("AMQP_WORKER_MODULE_OPTIONS");
