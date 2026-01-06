# @amqp-contract/worker-nestjs

**NestJS integration for [@amqp-contract/worker](../worker). Type-safe AMQP message consumption with automatic lifecycle management.**

[![CI](https://github.com/btravers/amqp-contract/actions/workflows/ci.yml/badge.svg)](https://github.com/btravers/amqp-contract/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@amqp-contract/worker-nestjs.svg?logo=npm)](https://www.npmjs.com/package/@amqp-contract/worker-nestjs)
[![npm downloads](https://img.shields.io/npm/dm/@amqp-contract/worker-nestjs.svg)](https://www.npmjs.com/package/@amqp-contract/worker-nestjs)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

📖 **[Full documentation →](https://btravers.github.io/amqp-contract/guide/worker-nestjs-usage)**

## Installation

```bash
pnpm add @amqp-contract/worker-nestjs @amqp-contract/worker @amqp-contract/contract amqplib
```

## Usage

```typescript
import { Module } from "@nestjs/common";
import { AmqpWorkerModule } from "@amqp-contract/worker-nestjs";
import { contract } from "./contract";

@Module({
  imports: [
    AmqpWorkerModule.forRoot({
      contract,
      handlers: {
        processOrder: async (message) => {
          console.log("Processing order:", message.orderId);
        },
      },
      connection: "amqp://localhost",
    }),
  ],
})
export class AppModule {}
```

The worker automatically starts consuming messages when the module initializes and cleans up on shutdown.

## Documentation

📖 **[Read the full documentation →](https://btravers.github.io/amqp-contract)**

## License

MIT
