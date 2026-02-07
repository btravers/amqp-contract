# amqp-contract

Type-safe contracts for AMQP/RabbitMQ messaging with automatic runtime validation.

## Rules

| Rule                                                    | Description                                                               |
| ------------------------------------------------------- | ------------------------------------------------------------------------- |
| [Project Overview](.agents/rules/project-overview.md)   | Architecture, packages, monorepo structure                                |
| [Commands](.agents/rules/commands.md)                   | Dev, quality, test, versioning commands                                   |
| [Contract Patterns](.agents/rules/contract-patterns.md) | Contract composition, event/command, retry, type inference                |
| [Handlers](.agents/rules/handlers.md)                   | Handler signatures, Future/Result, boxed API, error types, worker exports |
| [Code Style](.agents/rules/code-style.md)               | TypeScript rules, imports, anti-patterns, best practices                  |
| [Testing](.agents/rules/testing.md)                     | Testing strategy, integration tests, fixtures, assertions                 |
| [Dependencies](.agents/rules/dependencies.md)           | Key deps, catalog management, monorepo tooling                            |
| [NestJS](.agents/rules/nestjs.md)                       | NestJS module integration                                                 |

## Key Constraints

- No `any` types — use `unknown` and narrow
- Type aliases over interfaces — `type Foo = {}` not `interface Foo {}`
- `.js` extensions required in all imports (ESM)
- Handlers return `Future<Result<void, HandlerError>>` — not async/await
- Standard Schema v1 for validation (Zod, Valibot, ArkType)
- Catalog dependencies via `pnpm-workspace.yaml` — not hardcoded versions
- Conventional commits required (e.g. feat, fix, docs, chore, test, refactor — full set per Conventional Commits spec)
- Quorum queues by default — classic queues only for special cases
- Composition pattern — define resources first, then reference
- Git hooks: lefthook runs format, lint, sort-package-json on `pre-commit`, and commitlint on `commit-msg`
