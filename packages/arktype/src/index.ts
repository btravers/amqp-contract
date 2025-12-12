/**
 * ArkType integration for amqp-contract
 *
 * This package provides ArkType integration for amqp-contract.
 * Users should import contract builders from @amqp-contract/contract directly
 * and arktype from 'arktype'.
 *
 * @example
 * ```ts
 * import { type } from 'arktype';
 * import { defineContract, definePublisher } from '@amqp-contract/contract';
 *
 * const schema = type({ id: 'string' });
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
