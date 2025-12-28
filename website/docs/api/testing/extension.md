[**@amqp-contract/testing**](index.md)

---

[@amqp-contract/testing](index.md) / extension

# extension

Vitest extension module for AMQP testing utilities

This module provides a Vitest test extension that adds AMQP-specific fixtures
to your tests. Each test gets an isolated virtual host (vhost) with pre-configured
connections, channels, and helper functions for publishing and consuming messages.

## Variables

### it

```ts
const it: TestAPI<{
  amqpChannel: Channel;
  amqpConnection: ChannelModel;
  amqpConnectionUrl: string;
  initConsumer: (exchange, routingKey) => Promise<(options?) => Promise<ConsumeMessage[]>>;
  publishMessage: (exchange, routingKey, content) => void;
  vhost: string;
}>;
```

Defined in: [packages/testing/src/extension.ts:16](https://github.com/btravers/amqp-contract/blob/bff99da7b8d508cc2a06fc32ae467809417b267c/packages/testing/src/extension.ts#L16)
