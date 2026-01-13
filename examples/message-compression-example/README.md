# Message Compression Example

This example demonstrates how to use message compression with `@amqp-contract` to reduce bandwidth and improve performance for large AMQP payloads.

## Overview

This sample shows:

- Publishing messages with and without compression
- Comparing GZIP vs DEFLATE compression algorithms
- Conditional compression based on message size
- Automatic decompression on the consumer side
- Performance considerations and best practices

## Prerequisites

- Node.js 18+ installed
- RabbitMQ server running on `localhost:5672` (or set `AMQP_URL` environment variable)
- pnpm installed (`npm install -g pnpm`)

## Installation

From the repository root:

```bash
pnpm install
```

## Running the Example

### 1. Start the Consumer (Terminal 1)

The consumer will automatically decompress any compressed messages:

```bash
cd examples/message-compression-example
pnpm dev:consumer
```

The consumer will:

- Connect to RabbitMQ
- Wait for messages
- Automatically decompress compressed payloads
- Log received message details

### 2. Run the Publisher (Terminal 2)

The publisher demonstrates various compression scenarios:

```bash
cd examples/message-compression-example
pnpm dev:publisher
```

The publisher will send 5 examples:

1. **Small message without compression** - Shows that small messages don't benefit from compression
2. **Large message without compression** - Baseline for comparison
3. **Large message with GZIP** - Demonstrates GZIP compression (better ratio)
4. **Large message with DEFLATE** - Demonstrates DEFLATE compression (faster)
5. **Conditional compression** - Shows size-based compression decision

## What to Observe

### In the Publisher Output

You'll see:

- Original message sizes in bytes
- Publishing duration for each message
- Compression algorithm used (if any)
- Estimated compression ratios

### In the Consumer Output

You'll see:

- Received messages are automatically decompressed
- No compression-specific configuration needed
- All messages arrive with the same data structure

## Key Concepts

### Compression is a Runtime Decision

Compression is chosen when publishing, not when defining the contract:

```typescript
// No compression
await client.publish("largeData", payload).resultToPromise();

// With GZIP compression
await client
  .publish("largeData", payload, {
    compression: "gzip",
  })
  .resultToPromise();

// With DEFLATE compression
await client
  .publish("largeData", payload, {
    compression: "deflate",
  })
  .resultToPromise();
```

### Automatic Decompression

Consumers automatically handle decompression:

```typescript
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processData: async ({ payload }) => {
      // Message is already decompressed here!
      console.log(payload.items.length);
    },
  },
  urls: ["amqp://localhost"],
});
```

### When to Use Compression

✅ Use compression for:

- Large messages (>1KB)
- Text-heavy payloads (JSON, XML)
- High-volume messaging
- Bandwidth-constrained environments

❌ Skip compression for:

- Small messages (<500 bytes)
- Already compressed data (images, videos)
- CPU-constrained systems
- Real-time sensitive messages

### Choosing an Algorithm

**GZIP** (recommended):

- Better compression ratio (~70-80% for text)
- Slightly slower
- Best for bandwidth optimization

**DEFLATE**:

- Faster compression
- Good compression ratio (~65-75% for text)
- Best for CPU-constrained environments

## Code Structure

```
examples/message-compression-example/
├── src/
│   ├── contract.ts      # Contract definition
│   ├── publisher.ts     # Publishes messages with various compression options
│   └── consumer.ts      # Consumes and automatically decompresses messages
├── package.json         # Dependencies and scripts
└── README.md           # This file
```

## Customization

### Change RabbitMQ URL

```bash
AMQP_URL=amqp://user:pass@remote-host:5672 pnpm dev:consumer
AMQP_URL=amqp://user:pass@remote-host:5672 pnpm dev:publisher
```

### Adjust Logging

```bash
LOG_LEVEL=debug pnpm dev:consumer
LOG_LEVEL=debug pnpm dev:publisher
```

### Modify Message Size

Edit `publisher.ts` and change the `itemCount` parameter in `generateLargePayload()`:

```typescript
// Smaller messages
const payload = generateLargePayload("id", 10); // ~10KB

// Larger messages
const payload = generateLargePayload("id", 200); // ~200KB
```

## Performance Tips

1. **Measure First**: Test compression with your actual data before deploying
2. **Set a Threshold**: Only compress messages above a certain size (e.g., 1KB)
3. **Monitor CPU**: Compression adds CPU overhead - monitor your application
4. **Choose the Right Algorithm**: GZIP for bandwidth, DEFLATE for speed
5. **Consider Network Conditions**: Compression is more beneficial on slow networks

## Next Steps

- Read the [Message Compression Guide](/guide/message-compression)
- Explore [Client Usage](/guide/client-usage)
- Learn about [Worker Usage](/guide/worker-usage)
- See [Testing Strategies](/guide/testing)

## Troubleshooting

### Messages Not Received

Ensure:

- RabbitMQ is running
- Consumer started before publisher
- AMQP_URL is correct for both publisher and consumer

### High CPU Usage

- Reduce compression frequency
- Use DEFLATE instead of GZIP
- Increase size threshold for compression

### Poor Compression Ratio

- Verify data is text-based (JSON compresses well)
- Check if data is already compressed
- Try different compression algorithms

## Learn More

- [Message Compression Documentation](/guide/message-compression)
- [AMQP Contract Documentation](https://btravers.github.io/amqp-contract)
