# @amqp-contract/worker-nestjs

NestJS integration for [@amqp-contract/worker](../worker). Type-safe AMQP message consumption with automatic lifecycle management.

## Installation

```bash
pnpm add @amqp-contract/worker-nestjs @amqp-contract/worker @amqp-contract/contract amqplib
```

## Usage

```typescript
import { Module } from '@nestjs/common';
import { AmqpWorkerModule } from '@amqp-contract/worker-nestjs';
import { contract } from './contract';
import { connect } from 'amqplib';

const connection = await connect('amqp://localhost');

@Module({
  imports: [
    AmqpWorkerModule.forRoot({
      contract,
      handlers: {
        processOrder: async (message) => {
          console.log('Processing order:', message.orderId);
        },
      },
      connection,
    }),
  ],
})
export class AppModule {}
```

The worker automatically starts consuming messages when the module initializes and cleans up on shutdown.

## License

MIT
