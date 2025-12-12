# Contributing to amqp-contract

Thank you for your interest in contributing to amqp-contract!

## Development Setup

1. Install dependencies:

```bash
pnpm install
```

2. Build all packages:

```bash
pnpm build
```

3. Run tests:

```bash
pnpm test
```

## Project Structure

- `packages/contract` - Contract definition builder
- `packages/client` - Type-safe AMQP client
- `packages/worker` - Type-safe AMQP worker
- `packages/asyncapi` - AsyncAPI specification generator
- `samples/` - Example implementations

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `chore:` - Maintenance tasks
- `test:` - Test changes
- `refactor:` - Code refactoring

## Pull Request Process

1. Create a feature branch
2. Make your changes
3. Add tests for new functionality
4. Ensure all tests pass: `pnpm test`
5. Ensure code is formatted: `pnpm format`
6. Ensure code passes linting: `pnpm lint`
7. Submit a pull request

## Questions?

Feel free to open an issue for any questions or concerns.
