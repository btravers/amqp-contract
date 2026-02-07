# Project Overview

**amqp-contract** is a TypeScript monorepo providing type-safe contracts for AMQP/RabbitMQ messaging with automatic runtime validation.

## Key Technologies

- **TypeScript 5.9+** — strict type safety
- **Standard Schema v1** — universal schema validation interface (Zod, Valibot, ArkType)
- **amqplib** — AMQP 0.9.1 client for Node.js
- **@swan-io/boxed** — Future/Result functional error handling
- **Vitest** — test framework
- **Turbo** — monorepo build system
- **pnpm** — package manager
- **oxlint / oxfmt** — linter and formatter

## Packages

| Package                        | Purpose                                                      |
| ------------------------------ | ------------------------------------------------------------ |
| `@amqp-contract/contract`      | Contract definition builder and types (foundation)           |
| `@amqp-contract/core`          | AMQP connection management, topology setup, telemetry        |
| `@amqp-contract/client`        | Type-safe publishing via `TypedAmqpClient`                   |
| `@amqp-contract/worker`        | Type-safe consumption via `TypedAmqpWorker` with retry logic |
| `@amqp-contract/client-nestjs` | NestJS module for client                                     |
| `@amqp-contract/worker-nestjs` | NestJS module for worker                                     |
| `@amqp-contract/asyncapi`      | AsyncAPI 3.0 specification generator                         |
| `@amqp-contract/testing`       | Testcontainers setup and vitest fixtures                     |

## Monorepo Structure

```
amqp-contract/
├── docs/                  # Documentation site
├── packages/
│   ├── contract/          # Core contract builder
│   ├── core/              # Core utilities for AMQP setup and management
│   ├── client/            # Type-safe AMQP client
│   ├── worker/            # Type-safe AMQP worker
│   ├── client-nestjs/     # NestJS integration for client
│   ├── worker-nestjs/     # NestJS integration for worker
│   ├── asyncapi/          # AsyncAPI 3.0 generator
│   └── testing/           # Testing utilities
├── samples/               # Example implementations
└── tools/                 # Development tools
```

## Package Structure

Each package follows this layout:

```
packages/[package-name]/
├── src/
│   ├── index.ts           # Public API exports
│   ├── [feature].ts       # Implementation
│   └── [feature].spec.ts  # Tests alongside code
├── package.json
├── tsconfig.json
└── vitest.config.ts
```
