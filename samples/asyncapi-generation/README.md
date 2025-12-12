# AsyncAPI Generation Sample

This sample demonstrates generating AsyncAPI 3.0.0 specifications from AMQP contracts.

## Running the Sample

1. Build the packages:

```bash
pnpm build
```

2. Generate the AsyncAPI specification:

```bash
pnpm --filter @amqp-contract-samples/asyncapi-generation generate
```

This will create two files:
- `asyncapi.json` - Full AsyncAPI 3.0.0 specification in JSON format
- `asyncapi.yaml` - Simplified YAML format with reference to JSON

## What It Does

The sample:
1. Defines a complete AMQP contract with exchanges, queues, bindings, publishers, and consumers
2. Generates an AsyncAPI 3.0.0 specification from the contract
3. Includes server configurations for different environments
4. Outputs the specification in JSON and YAML formats

## Generated Specification

The AsyncAPI specification includes:
- **Channels**: AMQP exchanges and queues
- **Operations**: Send (publish) and receive (consume) operations
- **Messages**: Message schemas with validation rules
- **Servers**: Multiple environment configurations
- **Bindings**: AMQP-specific protocol bindings

## Using the Specification

The generated AsyncAPI specification can be used with:
- [AsyncAPI Studio](https://studio.asyncapi.com/) - Visual editor and documentation
- [AsyncAPI Generator](https://github.com/asyncapi/generator) - Generate client/server code
- [AsyncAPI CLI](https://github.com/asyncapi/cli) - Command-line tools
- API documentation portals and tools

## Example Output

```json
{
  "asyncapi": "3.0.0",
  "info": {
    "title": "Order Processing API",
    "version": "1.0.0",
    "description": "Type-safe AMQP messaging API..."
  },
  "channels": { ... },
  "operations": { ... },
  "components": {
    "messages": { ... }
  }
}
```
