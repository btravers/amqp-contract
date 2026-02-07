# Commands

## Development

```bash
pnpm install              # Install dependencies
pnpm build                # Build all packages
pnpm dev                  # Watch mode for development
```

## Code Quality

```bash
pnpm typecheck            # Type check without emitting
pnpm lint                 # Run oxlint (no any types, type aliases)
pnpm lint --fix           # Auto-fix linting issues
pnpm format               # Format with oxfmt (import sorting)
pnpm format --check       # Check formatting only
pnpm sort-package-json    # Sort package.json files
```

## Testing

```bash
pnpm test                 # Run unit tests (no Docker required)
pnpm test:integration     # Run integration tests (requires Docker)

# Run specific package tests
pnpm test:integration --filter @amqp-contract/core
pnpm test:integration --filter @amqp-contract/client
pnpm test:integration --filter @amqp-contract/worker
```

## Versioning

```bash
pnpm changeset            # Create changeset entry for version bumps
pnpm version              # Version packages
pnpm release              # Publish packages
```

## Pre-Commit Checklist

Before submitting code, ensure:

- TypeScript compiles without errors (`pnpm typecheck`)
- All tests pass (`pnpm test`)
- Code is properly formatted (`pnpm format`)
- No linting errors (`pnpm lint`)
- Package.json files are sorted (`pnpm sort-package-json --check`)
- Commit message follows conventional commits format
