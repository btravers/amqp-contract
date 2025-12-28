/**
 * Type tests for routing key and binding pattern validation
 * These tests ensure that the type system correctly validates routing keys and patterns
 */

import type { BindingPattern, MatchingRoutingKey, RoutingKey } from "./builder.js";

// ============================================================================
// RoutingKey Type Tests
// ============================================================================

// Valid routing keys should pass
type ValidKey1 = RoutingKey<"order.created">;
type ValidKey2 = RoutingKey<"user-profile.updated">;
type ValidKey3 = RoutingKey<"system_event.notification">;
type ValidKey4 = RoutingKey<"a">;
type ValidKey5 = RoutingKey<"ABC123">;

// Invalid routing keys should be never
type InvalidKey1 = RoutingKey<"order@created">; // @ is not allowed
type InvalidKey2 = RoutingKey<"order.created!">; // ! is not allowed
type InvalidKey3 = RoutingKey<"order created">; // space is not allowed
type InvalidKey4 = RoutingKey<"">; // empty is not allowed
type InvalidKey5 = RoutingKey<".order">; // cannot start with dot
type InvalidKey6 = RoutingKey<"order.">; // cannot end with dot

// Type assertions to verify the types
const _validKey1: "order.created" = "" as ValidKey1;
const _validKey2: "user-profile.updated" = "" as ValidKey2;
const _validKey3: "system_event.notification" = "" as ValidKey3;
const _validKey4: "a" = "" as ValidKey4;
const _validKey5: "ABC123" = "" as ValidKey5;

// These should be never types - they won't compile if assigned to anything other than never
const _invalidKey1: never = "" as InvalidKey1;
const _invalidKey2: never = "" as InvalidKey2;
const _invalidKey3: never = "" as InvalidKey3;
const _invalidKey4: never = "" as InvalidKey4;
const _invalidKey5: never = "" as InvalidKey5;
const _invalidKey6: never = "" as InvalidKey6;

// ============================================================================
// BindingPattern Type Tests
// ============================================================================

// Valid binding patterns should pass
type ValidPattern1 = BindingPattern<"order.*">;
type ValidPattern2 = BindingPattern<"order.#">;
type ValidPattern3 = BindingPattern<"*.created">;
type ValidPattern4 = BindingPattern<"#">;
type ValidPattern5 = BindingPattern<"*">;
type ValidPattern6 = BindingPattern<"order.*.urgent">;
type ValidPattern7 = BindingPattern<"order.#.completed">;
type ValidPattern8 = BindingPattern<"order.created">; // Exact match is also valid

// Invalid binding patterns should be never
type InvalidPattern1 = BindingPattern<"order.@">; // @ is not allowed
type InvalidPattern2 = BindingPattern<"order.*!">; // ! is not allowed
type InvalidPattern3 = BindingPattern<"order created">; // space is not allowed
type InvalidPattern4 = BindingPattern<"">; // empty is not allowed

// Type assertions for valid patterns
const _validPattern1: "order.*" = "" as ValidPattern1;
const _validPattern2: "order.#" = "" as ValidPattern2;
const _validPattern3: "*.created" = "" as ValidPattern3;
const _validPattern4: "#" = "" as ValidPattern4;
const _validPattern5: "*" = "" as ValidPattern5;
const _validPattern6: "order.*.urgent" = "" as ValidPattern6;
const _validPattern7: "order.#.completed" = "" as ValidPattern7;
const _validPattern8: "order.created" = "" as ValidPattern8;

// Type assertions for invalid patterns
const _invalidPattern1: never = "" as InvalidPattern1;
const _invalidPattern2: never = "" as InvalidPattern2;
const _invalidPattern3: never = "" as InvalidPattern3;
const _invalidPattern4: never = "" as InvalidPattern4;

// ============================================================================
// MatchingRoutingKey Type Tests
// ============================================================================

// Valid matches
type Match1 = MatchingRoutingKey<"order.*", "order.created">;
type Match2 = MatchingRoutingKey<"order.#", "order.created">;
type Match3 = MatchingRoutingKey<"order.#", "order.created.urgent">;
type Match4 = MatchingRoutingKey<"*.created", "order.created">;
type Match5 = MatchingRoutingKey<"order.created", "order.created">; // Exact match

// Invalid matches (should be never)
type NoMatch1 = MatchingRoutingKey<"order.*", "user.created">; // Wrong prefix
type NoMatch2 = MatchingRoutingKey<"order.*", "order.created.urgent">; // * matches only one word
type NoMatch3 = MatchingRoutingKey<"*.created", "order.updated">; // Wrong suffix

// Type assertions for valid matches
const _match1: "order.created" = "" as Match1;
const _match2: "order.created" = "" as Match2;
const _match3: "order.created.urgent" = "" as Match3;
const _match4: "order.created" = "" as Match4;
const _match5: "order.created" = "" as Match5;

// Type assertions for invalid matches
const _noMatch1: never = "" as NoMatch1;
const _noMatch2: never = "" as NoMatch2;
const _noMatch3: never = "" as NoMatch3;

// ============================================================================
// Complex Pattern Matching Tests
// ============================================================================

// Test # in the middle of patterns
type ComplexMatch1 = MatchingRoutingKey<"order.#.completed", "order.completed">; // # matches zero
type ComplexMatch2 = MatchingRoutingKey<"order.#.completed", "order.created.completed">; // # matches one
type ComplexMatch3 = MatchingRoutingKey<"order.#.completed", "order.created.urgent.completed">; // # matches two

// Should not match
type ComplexNoMatch1 = MatchingRoutingKey<"order.#.completed", "order.created">; // Missing .completed
type ComplexNoMatch2 = MatchingRoutingKey<"order.#.completed", "user.completed">; // Wrong prefix

// Type assertions
const _complexMatch1: "order.completed" = "" as ComplexMatch1;
const _complexMatch2: "order.created.completed" = "" as ComplexMatch2;
const _complexMatch3: "order.created.urgent.completed" = "" as ComplexMatch3;
const _complexNoMatch1: never = "" as ComplexNoMatch1;
const _complexNoMatch2: never = "" as ComplexNoMatch2;

// Export to prevent unused variable errors
export type {
  ValidKey1,
  ValidKey2,
  ValidKey3,
  ValidKey4,
  ValidKey5,
  InvalidKey1,
  InvalidKey2,
  InvalidKey3,
  InvalidKey4,
  InvalidKey5,
  InvalidKey6,
  ValidPattern1,
  ValidPattern2,
  ValidPattern3,
  ValidPattern4,
  ValidPattern5,
  ValidPattern6,
  ValidPattern7,
  ValidPattern8,
  InvalidPattern1,
  InvalidPattern2,
  InvalidPattern3,
  InvalidPattern4,
  Match1,
  Match2,
  Match3,
  Match4,
  Match5,
  NoMatch1,
  NoMatch2,
  NoMatch3,
  ComplexMatch1,
  ComplexMatch2,
  ComplexMatch3,
  ComplexNoMatch1,
  ComplexNoMatch2,
};
