/**
 * Injection token for AMQP client module options
 * Used by NestJS DI system to inject configuration into AmqpClientService
 */
export const MODULE_OPTIONS_TOKEN = Symbol("AMQP_CLIENT_MODULE_OPTIONS");
