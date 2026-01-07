# @amqp-contract/client-nestjs

**NestJS integration for [@amqp-contract/client](../client). Type-safe AMQP message publishing with automatic lifecycle management.**

[![CI](https://github.com/btravers/amqp-contract/actions/workflows/ci.yml/badge.svg)](https://github.com/btravers/amqp-contract/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@amqp-contract/client-nestjs.svg?logo=npm)](https://www.npmjs.com/package/@amqp-contract/client-nestjs)
[![npm downloads](https://img.shields.io/npm/dm/@amqp-contract/client-nestjs.svg)](https://www.npmjs.com/package/@amqp-contract/client-nestjs)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

📖 **[Full documentation →](https://btravers.github.io/amqp-contract/guide/client-nestjs-usage)**

## Installation

```bash
pnpm add @amqp-contract/client-nestjs @amqp-contract/client @amqp-contract/contract amqplib
```

## Usage

```typescript
import { Injectable, Module } from "@nestjs/common";
import { AmqpClientModule, AmqpClientService } from "@amqp-contract/client-nestjs";
import { contract } from "./contract";

@Module({
  imports: [
    AmqpClientModule.forRoot({
      contract,
      urls: ["amqp://localhost"],
    }),
  ],
})
export class AppModule {}

@Injectable()
export class OrderService {
  constructor(private readonly client: AmqpClientService<typeof contract>) {}

  async createOrder(orderId: string, amount: number) {
    const result = await this.client
      .publish("orderCreated", { orderId, amount })
      .resultToPromise();

    if (result.isError()) {
      throw new Error(`Failed to publish: ${result.error.message}`);
    }
  }
}
```

The client automatically connects when the module initializes and cleans up on shutdown.

## Documentation

📖 **[Read the full documentation →](https://btravers.github.io/amqp-contract)**

## License

MIT
