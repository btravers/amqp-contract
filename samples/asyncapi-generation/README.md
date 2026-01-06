# AsyncAPI Generation Sample

Demonstrates generating AsyncAPI 3.0 specifications from AMQP contracts with validation and tooling integration.

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

## AsyncAPI Tooling Integration

### Validation

Validate the generated AsyncAPI specification:

```bash
pnpm --filter @amqp-contract-samples/asyncapi-generation validate
```

This ensures the spec is compliant with AsyncAPI 3.0 and properly formatted.

### Bundling

Bundle multiple AsyncAPI documents into one:

```bash
pnpm --filter @amqp-contract-samples/asyncapi-generation bundle
```

## Features

The generated AsyncAPI specification includes:

- **Proper AMQP Bindings**: Compliant with AsyncAPI 3.0 AMQP bindings specification
  - `bindingVersion: "0.3.0"` for all bindings
  - Virtual host (`vhost`) configuration
  - Queue and exchange properties (durable, autoDelete, exclusive)
- **Operation-Level Bindings**:
  - Publishers: Routing keys (`cc`), delivery mode (persistent)
  - Consumers: Acknowledgment settings

- **Complete Schema Validation**: Full JSON Schema conversion from Zod/Valibot/ArkType schemas

- **Metadata**: Summaries, descriptions, and documentation for all operations and messages

## Using the Specification

Use the generated spec with:

- [AsyncAPI Studio](https://studio.asyncapi.com/) - Visual editor and documentation generator
- [AsyncAPI CLI](https://github.com/asyncapi/cli) - Command-line validation and tooling
- [AsyncAPI Generator](https://github.com/asyncapi/generator) - Code generation
- [AsyncAPI Diff](https://github.com/asyncapi/diff) - Breaking change detection

### Visualization

You can visualize the AsyncAPI spec using:

1. **AsyncAPI Studio** (https://studio.asyncapi.com/):
   - Upload or paste your `asyncapi.json`
   - Get an interactive documentation view
   - Edit and validate in real-time

2. **Local HTML Generation**:
   ```bash
   npx @asyncapi/cli generate fromTemplate asyncapi.json @asyncapi/html-template -o ./html-docs
   ```

For detailed documentation, visit the **[website](https://btravers.github.io/amqp-contract/examples/asyncapi-generation)**.
