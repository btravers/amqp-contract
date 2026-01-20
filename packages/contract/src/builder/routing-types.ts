// ============================================================================
// Routing Key and Binding Pattern Validation Types
// ============================================================================

/**
 * Type-safe routing key that validates basic format.
 *
 * Validates that a routing key follows basic AMQP routing key rules:
 * - Must not contain wildcards (* or #)
 * - Must not be empty
 * - Should contain alphanumeric characters, dots, hyphens, and underscores
 *
 * Note: Full character-by-character validation is not performed to avoid TypeScript
 * recursion depth limits. Runtime validation is still recommended.
 *
 * @public
 * @template S - The routing key string to validate
 * @example
 * ```typescript
 * type Valid = RoutingKey<"order.created">; // "order.created"
 * type Invalid = RoutingKey<"order.*">; // never (contains wildcard)
 * type Invalid2 = RoutingKey<"">; // never (empty string)
 * ```
 */
export type RoutingKey<S extends string> = S extends ""
  ? never // Empty string not allowed
  : S extends `${string}*${string}` | `${string}#${string}`
    ? never // Wildcards not allowed in routing keys
    : S; // Accept the routing key as-is

/**
 * Type-safe binding pattern that validates basic format and wildcards.
 *
 * Validates that a binding pattern follows basic AMQP binding pattern rules:
 * - Can contain wildcards (* for one word, # for zero or more words)
 * - Must not be empty
 * - Should contain alphanumeric characters, dots, hyphens, underscores, and wildcards
 *
 * Note: Full character-by-character validation is not performed to avoid TypeScript
 * recursion depth limits. Runtime validation is still recommended.
 *
 * @public
 * @template S - The binding pattern string to validate
 * @example
 * ```typescript
 * type ValidPattern = BindingPattern<"order.*">; // "order.*"
 * type ValidHash = BindingPattern<"order.#">; // "order.#"
 * type ValidConcrete = BindingPattern<"order.created">; // "order.created"
 * type Invalid = BindingPattern<"">; // never (empty string)
 * ```
 */
export type BindingPattern<S extends string> = S extends "" ? never : S;

/**
 * Helper type for pattern matching with # in the middle
 * Handles backtracking to match # with zero or more segments
 * @internal
 */
type MatchesAfterHash<Key extends string, PatternRest extends string> =
  MatchesPattern<Key, PatternRest> extends true
    ? true // # matches zero segments
    : Key extends `${string}.${infer KeyRest}`
      ? MatchesAfterHash<KeyRest, PatternRest> // # matches one or more segments
      : false;

/**
 * Check if a routing key matches a binding pattern
 * Implements AMQP topic exchange pattern matching:
 * - * matches exactly one word
 * - # matches zero or more words
 * @internal
 */
type MatchesPattern<
  Key extends string,
  Pattern extends string,
> = Pattern extends `${infer PatternPart}.${infer PatternRest}`
  ? PatternPart extends "#"
    ? MatchesAfterHash<Key, PatternRest> // # in the middle: backtrack over all possible segment lengths
    : Key extends `${infer KeyPart}.${infer KeyRest}`
      ? PatternPart extends "*"
        ? MatchesPattern<KeyRest, PatternRest> // * matches one segment
        : PatternPart extends KeyPart
          ? MatchesPattern<KeyRest, PatternRest> // Exact match
          : false
      : false
  : Pattern extends "#"
    ? true // # matches everything (including empty)
    : Pattern extends "*"
      ? Key extends `${string}.${string}`
        ? false // * matches exactly 1 segment, not multiple
        : true
      : Pattern extends Key
        ? true // Exact match
        : false;

/**
 * Validate that a routing key matches a binding pattern.
 *
 * This is a utility type provided for users who want compile-time validation
 * that a routing key matches a specific pattern. It's not enforced internally
 * in the API to avoid TypeScript recursion depth issues with complex routing keys.
 *
 * Returns the routing key if it's valid and matches the pattern, `never` otherwise.
 *
 * @example
 * ```typescript
 * type ValidKey = MatchingRoutingKey<"order.*", "order.created">; // "order.created"
 * type InvalidKey = MatchingRoutingKey<"order.*", "user.created">; // never
 * ```
 *
 * @template Pattern - The binding pattern (can contain * and # wildcards)
 * @template Key - The routing key to validate
 */
export type MatchingRoutingKey<Pattern extends string, Key extends string> =
  RoutingKey<Key> extends never
    ? never // Invalid routing key
    : BindingPattern<Pattern> extends never
      ? never // Invalid pattern
      : MatchesPattern<Key, Pattern> extends true
        ? Key
        : never;
