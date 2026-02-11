import type { QueueDefinition, QueueEntry, QueueWithTtlBackoffInfrastructure } from "../types.js";

/**
 * Type guard to check if a queue entry is a QueueWithTtlBackoffInfrastructure.
 * @internal
 */
export function isQueueWithTtlBackoffInfrastructure(
  entry: QueueEntry,
): entry is QueueWithTtlBackoffInfrastructure {
  return (
    typeof entry === "object" &&
    entry !== null &&
    "__brand" in entry &&
    entry.__brand === "QueueWithTtlBackoffInfrastructure"
  );
}

/**
 * Extract the plain QueueDefinition from a QueueEntry.
 * @internal
 */
export function extractQueueFromEntry(entry: QueueEntry): QueueDefinition {
  if (isQueueWithTtlBackoffInfrastructure(entry)) {
    return entry.queue;
  }
  return entry;
}
