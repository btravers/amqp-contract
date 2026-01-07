# ADR-002: Separate Client and Worker Packages

**Status**: Accepted  
**Date**: 2025-12-25  
**Deciders**: Project Maintainers

## Context

In the amqp-contract project, we need to decide how to structure the packages for publishing (client) and consuming (worker) functionality. The core question is:

**Should client (publisher) and worker (consumer) functionality be:**

1. Combined in a single package?
2. Separated into distinct packages?
3. Offered both ways?

This decision affects:

- Bundle size for applications
- Developer experience and clarity
- Maintenance burden
- Modularity and testability
- Deployment flexibility

## Decision

We have decided to **keep client and worker as separate packages**:

- **@amqp-contract/client** - For publishing messages
- **@amqp-contract/worker** - For consuming messages

Additionally, we will create a **@amqp-contract/unified** package for applications that need both publishing and consuming with optimized connection sharing (see ADR-003).

## Rationale

### 1. Modularity and Single Responsibility

Each package has a clear, focused purpose:

- Client package: Send messages
- Worker package: Receive and process messages

This follows the Single Responsibility Principle and makes the codebase easier to understand and maintain.

### 2. Tree Shaking and Bundle Size

Separate packages allow applications to import only what they need:

```typescript
// Microservice that only publishes
import { TypedAmqpClient } from "@amqp-contract/client";
// Does NOT include worker code in bundle ✅

// Microservice that only consumes
import { TypedAmqpWorker } from "@amqp-contract/worker";
// Does NOT include client code in bundle ✅
```

This results in smaller bundle sizes for specialized services.

### 3. Clear Dependencies

The dependency graph is explicit:

```
@amqp-contract/client  →  @amqp-contract/contract  →  @standard-schema/spec
                       →  @amqp-contract/core

@amqp-contract/worker  →  @amqp-contract/contract  →  @standard-schema/spec
                       →  @amqp-contract/core
```

No circular dependencies, and each package declares exactly what it needs.

### 4. Independent Evolution

Packages can evolve independently:

- Client-specific features (e.g., message batching, compression)
- Worker-specific features (e.g., concurrent handlers, prefetch tuning)
- Different release cycles if needed
- Easier to test in isolation

### 5. Microservices Architecture

Many real-world applications use a microservices architecture where services have specialized roles:

- **API Services**: Only publish events (client package)
- **Worker Services**: Only consume and process (worker package)
- **Hybrid Services**: Both publish and consume (both packages, or unified package)

Separate packages align perfectly with this architecture.

### 6. NestJS Integration

Having separate packages allows separate NestJS modules:

```typescript
// Publisher microservice
@Module({
  imports: [AmqpClientModule.forRoot({ ... })],
})
export class AppModule {}

// Consumer microservice
@Module({
  imports: [AmqpWorkerModule.forRoot({ ... })],
})
export class AppModule {}

// Hybrid service
@Module({
  imports: [
    AmqpClientModule.forRoot({ ... }),
    AmqpWorkerModule.forRoot({ ... }),
  ],
})
export class AppModule {}
```

This provides maximum flexibility for NestJS applications.

### 7. Testing and Development

Separate packages make it easier to:

- Test publishing logic independently
- Test consuming logic independently
- Mock one side while testing the other
- Develop features in isolation

## Consequences

### Positive

1. **Smaller Bundle Sizes**: Applications only bundle what they use
2. **Clear Separation**: Each package has a single, well-defined purpose
3. **Flexible Deployment**: Services can use only what they need
4. **Independent Evolution**: Features can be added to one package without affecting the other
5. **Better Testing**: Easier to test each package in isolation
6. **Explicit Dependencies**: Clear dependency graph, no hidden coupling

### Negative

1. **Multiple Installations**: Applications using both need to install two packages

   ```json
   {
     "dependencies": {
       "@amqp-contract/client": "^0.3.5",
       "@amqp-contract/worker": "^0.3.5"
     }
   }
   ```

2. **Documentation Overhead**: Need to document both packages and their relationship

3. **Connection Management**: By default, each package creates its own connection (addressed in ADR-003)

### Mitigation

To address the drawbacks:

1. **Unified Package**: Create `@amqp-contract/unified` for convenience (see ADR-003)
2. **Clear Documentation**: Provide guidance on when to use each package
3. **Connection Sharing**: Implement connection sharing in unified package
4. **Example Projects**: Show all three patterns (client-only, worker-only, unified)

## Alternatives Considered

### Alternative 1: Single Combined Package

**Structure:**

```typescript
// @amqp-contract/amqp (single package)
export { TypedAmqpClient } from "./client";
export { TypedAmqpWorker } from "./worker";
```

**Pros:**

- Single installation
- Simpler for applications using both
- Less documentation needed

**Cons:**

- Larger bundle size for specialized services
- Less modular
- Client and worker code always bundled together
- Harder to tree-shake
- Mixed responsibilities

**Why not chosen**: Forces all applications to bundle both client and worker code, even if they only use one. This violates modularity principles and increases bundle sizes unnecessarily.

### Alternative 2: Monolithic Package with Tree-Shakeable Exports

**Structure:**

```typescript
// @amqp-contract/amqp (single package)
export { TypedAmqpClient } from "./client/index";
export { TypedAmqpWorker } from "./worker/index";
```

With separate entry points for tree shaking.

**Pros:**

- Single installation
- Potentially tree-shakeable
- Unified versioning

**Cons:**

- Requires careful build configuration
- Tree shaking not guaranteed (depends on bundler)
- Still bundles both in package
- Less clear separation
- Harder to maintain

**Why not chosen**: While technically possible, this approach is fragile and doesn't provide the same clear separation as truly independent packages.

### Alternative 3: Core Package with Plugin Architecture

**Structure:**

```typescript
// @amqp-contract/core (base)
export { AmqpConnection } from "./connection";

// @amqp-contract/client-plugin
export { ClientPlugin } from "./plugin";

// @amqp-contract/worker-plugin
export { WorkerPlugin } from "./plugin";
```

**Pros:**

- Maximum flexibility
- Extensible architecture
- Clear plugin boundaries

**Cons:**

- Overly complex for the problem
- Steeper learning curve
- More boilerplate
- Harder to type-check

**Why not chosen**: This adds unnecessary complexity. The client/worker functionality is fundamental, not optional plugins.

## Implementation Notes

### Package Structure

Each package follows this structure:

```
packages/client/
├── src/
│   ├── client.ts          # TypedAmqpClient implementation
│   ├── types.ts           # Type definitions
│   ├── errors.ts          # Error classes
│   └── index.ts           # Public API exports
├── package.json
└── README.md

packages/worker/
├── src/
│   ├── worker.ts          # TypedAmqpWorker implementation
│   ├── handlers.ts        # Handler utilities
│   ├── types.ts           # Type definitions
│   ├── errors.ts          # Error classes
│   └── index.ts           # Public API exports
├── package.json
└── README.md
```

### Shared Code

Common functionality is extracted to shared packages:

- **@amqp-contract/contract**: Contract definitions and types
- **@amqp-contract/core**: AmqpClient and connection management
- **@amqp-contract/testing**: Testing utilities

This avoids code duplication while maintaining separation.

### NestJS Packages

NestJS integration follows the same pattern:

- **@amqp-contract/client-nestjs**: Client module for NestJS
- **@amqp-contract/worker-nestjs**: Worker module for NestJS

Each can be used independently or together.

## Usage Patterns

### Pattern 1: Client-Only Service

```typescript
import { TypedAmqpClient } from '@amqp-contract/client';

const client = await TypedAmqpClient.create({ contract, urls }).resultToPromise();

await client.publish('orderCreated', { ... }).resultToPromise();
```

**Use case**: API services, webhook handlers, event publishers

### Pattern 2: Worker-Only Service

```typescript
import { TypedAmqpWorker } from '@amqp-contract/worker';

const worker = await TypedAmqpWorker.create({
  contract,
  handlers: { processOrder: async (msg) => { ... } },
  urls,
});
```

**Use case**: Background job processors, event handlers, queue consumers

### Pattern 3: Hybrid Service (Both Packages)

```typescript
import { TypedAmqpClient } from "@amqp-contract/client";
import { TypedAmqpWorker } from "@amqp-contract/worker";

const client = await TypedAmqpClient.create({ contract, urls });
const worker = await TypedAmqpWorker.create({ contract, handlers, urls });

// Note: Creates two connections (see ADR-003 for optimized version)
```

**Use case**: Full-featured services, saga orchestrators, event processors

### Pattern 4: Unified Package (Recommended for Hybrid)

```typescript
import { TypedAmqpUnifiedClient } from '@amqp-contract/unified';

const unified = await TypedAmqpUnifiedClient.create({
  contract,
  publishers: true,
  consumers: { handlers },
  urls,
});

await unified.publisher.publish('orderCreated', { ... });

// Note: Shares single connection ✅
```

**Use case**: Services that both publish and consume, optimized for resource usage

## Future Considerations

### Maintain Separation

We commit to maintaining separate packages for the foreseeable future. This architecture has proven successful in other ecosystems:

- RabbitMQ official libraries (separate publisher/consumer modules)
- Kafka clients (separate producer/consumer)
- Redis clients (separate publisher/subscriber in many libraries)

### Potential Additions

Future packages that might be added:

- **@amqp-contract/rpc**: Request-reply pattern
- **@amqp-contract/streams**: Streaming message handling
- **@amqp-contract/testing-advanced**: Advanced testing utilities
- **@amqp-contract/observability**: Metrics and tracing

Each would be a separate package following the same modular principles.

## References

- [ADR-001: Client and Worker Terminology](001-client-worker-terminology.md)
- [ADR-003: Connection Sharing Strategy](003-connection-sharing.md)
- [Modular Package Design](https://nodejs.org/api/packages.html)
- [Tree Shaking in Modern Bundlers](https://webpack.js.org/guides/tree-shaking/)

## Related ADRs

- [ADR-001: Client and Worker Terminology](001-client-worker-terminology.md)
- [ADR-003: Connection Sharing Strategy](003-connection-sharing.md)
