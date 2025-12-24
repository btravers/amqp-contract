# @amqp-contract/asyncapi

**AsyncAPI 3.0.0 specification generator for amqp-contract.**

[![CI](https://github.com/btravers/amqp-contract/actions/workflows/ci.yml/badge.svg)](https://github.com/btravers/amqp-contract/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@amqp-contract/asyncapi.svg?logo=npm)](https://www.npmjs.com/package/@amqp-contract/asyncapi)
[![npm downloads](https://img.shields.io/npm/dm/@amqp-contract/asyncapi.svg)](https://www.npmjs.com/package/@amqp-contract/asyncapi)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

📖 **[Full documentation →](https://btravers.github.io/amqp-contract/api/asyncapi)**

## Installation

```bash
pnpm add @amqp-contract/asyncapi
```

## Usage

```typescript
import { generateAsyncAPI } from '@amqp-contract/asyncapi';
import { contract } from './contract';

// Generate AsyncAPI specification
const asyncAPISpec = generateAsyncAPI(contract, {
  info: {
    title: 'My AMQP API',
    version: '1.0.0',
    description: 'Type-safe AMQP messaging API',
  },
  servers: {
    development: {
      host: 'localhost:5672',
      protocol: 'amqp',
      description: 'Development RabbitMQ server',
    },
    production: {
      host: 'rabbitmq.example.com:5672',
      protocol: 'amqp',
      description: 'Production RabbitMQ server',
    },
  },
});

// Output as JSON
console.log(JSON.stringify(asyncAPISpec, null, 2));

// Or write to file
import { writeFileSync } from 'fs';
writeFileSync('asyncapi.json', JSON.stringify(asyncAPISpec, null, 2));
```

## API

### `generateAsyncAPI(contract, options)`

Generate an AsyncAPI 3.0.0 specification from an AMQP contract.

**Parameters:**

- `contract`: The AMQP contract definition
- `options`: Configuration options
  - `info`: API information (title, version, description, etc.)
  - `servers`: Server configurations (optional)

**Returns:** AsyncAPI 3.0.0 document

## Features

- ✅ Full AsyncAPI 3.0.0 support
- ✅ Channels from exchanges and queues
- ✅ Operations for publishers and consumers
- ✅ Message schemas from Zod schemas
- ✅ AMQP protocol bindings

## Documentation

📖 **[Read the full documentation →](https://btravers.github.io/amqp-contract)**

## License

MIT
