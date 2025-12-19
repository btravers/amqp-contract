# AsyncAPI Generation Sample

Demonstrates generating AsyncAPI 3.0 specifications from AMQP contracts.

📖 **[Full documentation →](https://btravers.github.io/amqp-contract/examples/asyncapi-generation)**

## Quick Start

```bash
# Build packages
pnpm build

# Generate AsyncAPI specification
pnpm --filter @amqp-contract-samples/asyncapi-generation generate
```

This generates:

- `asyncapi.json` - AsyncAPI 3.0.0 specification in JSON
- `asyncapi.yaml` - YAML format

## Using the Specification

Use the generated spec with:

- [AsyncAPI Studio](https://studio.asyncapi.com/) - Visual editor
- [AsyncAPI Generator](https://github.com/asyncapi/generator) - Code generation
- [AsyncAPI CLI](https://github.com/asyncapi/cli) - Command-line tools

For detailed documentation, visit the **[website](https://btravers.github.io/amqp-contract/examples/asyncapi-generation)**.
