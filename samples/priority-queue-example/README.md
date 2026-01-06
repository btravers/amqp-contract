# Priority Queue Example

This example demonstrates how to use **priority queues** with `amqp-contract` to process messages based on their priority level.

## Features Demonstrated

- ✅ Creating priority queues using `definePriorityQueue`
- ✅ Publishing messages with different priority levels (0-10)
- ✅ Consuming messages in priority order (highest first)
- ✅ Type-safe message handling with Zod schemas

## How Priority Queues Work

Priority queues in RabbitMQ allow messages to be consumed based on their priority level rather than just their arrival order:

- Messages with **higher priority** values are delivered first
- Priority range: **0-255** (typically use 0-10 for better performance)
- Messages without explicit priority default to **priority 0**
- Within the same priority level, messages follow FIFO order

## Running the Example

### Prerequisites

- RabbitMQ server running on `localhost:5672` (or set `AMQP_URL` environment variable)
- Dependencies installed: `pnpm install`

### Step 1: Start the Worker

In one terminal, start the worker to consume tasks:

```bash
pnpm --filter @amqp-contract-samples/priority-queue-example start:worker
```

The worker will:

- Connect to RabbitMQ
- Create the priority queue with max priority of 10
- Wait for tasks to process

### Step 2: Publish Tasks

In another terminal, publish tasks with different priorities:

```bash
pnpm --filter @amqp-contract-samples/priority-queue-example start:client
```

The client will publish 5 tasks in this order:

1. Low priority backup (priority: 1)
2. Critical security patch (priority: 10)
3. Medium priority update (priority: 5)
4. Default priority cleanup (priority: 0)
5. Normal maintenance (priority: 3)

### Expected Output

The worker will process tasks in **priority order**, not publication order:

```
📥 Processing: task-2 - "Critical security patch" (priority: 10)
✅ Completed: task-2

📥 Processing: task-3 - "Medium priority update" (priority: 5)
✅ Completed: task-3

📥 Processing: task-5 - "Normal maintenance" (priority: 3)
✅ Completed: task-5

📥 Processing: task-1 - "Low priority backup" (priority: 1)
✅ Completed: task-1

📥 Processing: task-4 - "Default priority cleanup" (priority: 0)
✅ Completed: task-4
```

## Code Structure

### Contract Definition (`src/contract.ts`)

```typescript
// Create a priority queue with max priority of 10
const taskQueue = definePriorityQueue("task-processing", 10, {
  durable: true,
});
```

### Publishing with Priority (`src/client.ts`)

```typescript
// Publish a message with priority 10 (critical)
await client.publish(
  "submitTask",
  { taskId: "task-1", title: "Critical task", priority: 10, createdAt: now },
  {
    priority: 10, // Set RabbitMQ message priority
  },
);
```

### Worker Configuration (`src/worker.ts`)

```typescript
// Worker automatically processes messages in priority order
const worker = await TypedAmqpWorker.create({
  contract: priorityQueueContract,
  urls: [env.AMQP_URL],
  handlers: {
    processTask: async (task) => {
      console.log(`Processing: ${task.title} (priority: ${task.priority})`);
    },
  },
});
```

## Key Concepts

### 1. Queue Definition

Use `definePriorityQueue` to create a queue with priority support:

```typescript
const queue = definePriorityQueue("my-queue", maxPriority, options);
```

- `maxPriority`: Maximum priority level (1-255, recommended: 1-10)
- Lower values have better performance
- Automatically sets `x-max-priority` argument

### 2. Message Priority

Set priority when publishing messages:

```typescript
client.publish("publisherName", message, {
  priority: 10, // Higher = processed first
});
```

### 3. Performance Considerations

- Priority queues have overhead compared to regular queues
- Use lower max priority values (1-10) for better performance
- Only use priority queues when message ordering by priority is required
- Consider using separate queues for drastically different priorities

## Learn More

- [RabbitMQ Priority Queue Documentation](https://www.rabbitmq.com/docs/priority)
- [amqp-contract Documentation](https://btravers.github.io/amqp-contract)
- [API Reference](https://btravers.github.io/amqp-contract/api/)
