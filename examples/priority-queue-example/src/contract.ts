import {
  defineConsumer,
  defineContract,
  defineExchange,
  defineMessage,
  definePublisher,
  defineQueue,
  defineQueueBinding,
} from "@amqp-contract/contract";
import { z } from "zod";

/**
 * Message schema for task processing
 */
const taskSchema = z.object({
  taskId: z.string(),
  title: z.string(),
  priority: z.number().int().min(0).max(10),
  createdAt: z.string().datetime(),
});

// Define exchange for task routing
const tasksExchange = defineExchange("tasks", "direct", { durable: true });

// Define a priority queue with maximum priority of 10
// Messages with higher priority (0-10) will be processed first
// Note: Priority queues require classic queue type (quorum queues don't support priorities)
const taskQueue = defineQueue("task-processing", {
  type: "classic",
  durable: true,
  maxPriority: 10,
});

// Define message with task schema
const taskMessage = defineMessage(taskSchema, {
  summary: "Task to be processed",
  description: "A task that should be processed according to its priority level",
});

/**
 * Priority queue contract for task processing
 *
 * This contract demonstrates:
 * 1. Priority queue creation using maxPriority option in defineQueue
 * 2. Publishing messages with different priority levels
 * 3. Consuming messages in priority order (high to low)
 *
 * Priority levels:
 * - 10: Critical (processed first)
 * - 5-9: High priority
 * - 3-4: Medium priority
 * - 1-2: Low priority
 * - 0: Default (processed last)
 */
export const priorityQueueContract = defineContract({
  exchanges: {
    tasks: tasksExchange,
  },
  queues: {
    taskProcessing: taskQueue,
  },
  bindings: {
    taskBinding: defineQueueBinding(taskQueue, tasksExchange, {
      routingKey: "task",
    }),
  },
  publishers: {
    submitTask: definePublisher(tasksExchange, taskMessage, {
      routingKey: "task",
    }),
  },
  consumers: {
    processTask: defineConsumer(taskQueue, taskMessage),
  },
});
