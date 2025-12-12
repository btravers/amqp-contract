/**
 * Valibot integration for amqp-contract
 *
 * This package provides Valibot integration for amqp-contract.
 * Users should import contract builders from @amqp-contract/contract directly
 * and valibot from 'valibot'.
 *
 * @example
 * ```ts
 * import * as v from 'valibot';
 * import { defineContract, definePublisher } from '@amqp-contract/contract';
 *
 * const schema = v.object({ id: v.string() });
 * const contract = defineContract({
 *   publishers: {
 *     test: definePublisher('exchange', schema),
 *   },
 * });
 * ```
 */

// This file intentionally exports nothing.
// The package exists to declare peer dependencies and provide documentation.
export {};
