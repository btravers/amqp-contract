/**
 * Type tests for routing key and binding pattern validation using Vitest
 * These tests ensure that the type system correctly validates routing keys and patterns
 */

import { describe, expectTypeOf, test } from "vitest";
import type { BindingPattern, MatchingRoutingKey, RoutingKey } from "./builder.js";

describe("RoutingKey type validation", () => {
  test("should accept valid routing keys", () => {
    expectTypeOf<RoutingKey<"order.created">>().toEqualTypeOf<"order.created">();
    expectTypeOf<RoutingKey<"user-profile.updated">>().toEqualTypeOf<"user-profile.updated">();
    expectTypeOf<RoutingKey<"system_event.notification">>().toEqualTypeOf<"system_event.notification">();
    expectTypeOf<RoutingKey<"a">>().toEqualTypeOf<"a">();
    expectTypeOf<RoutingKey<"ABC123">>().toEqualTypeOf<"ABC123">();
  });

  test("should reject invalid routing keys with special characters", () => {
    // @ is not allowed
    expectTypeOf<RoutingKey<"order@created">>().toEqualTypeOf<never>();
    
    // ! is not allowed
    expectTypeOf<RoutingKey<"order.created!">>().toEqualTypeOf<never>();
    
    // space is not allowed
    expectTypeOf<RoutingKey<"order created">>().toEqualTypeOf<never>();
  });

  test("should reject empty or malformed routing keys", () => {
    // empty is not allowed
    expectTypeOf<RoutingKey<"">>().toEqualTypeOf<never>();
    
    // cannot start with dot
    expectTypeOf<RoutingKey<".order">>().toEqualTypeOf<never>();
    
    // cannot end with dot
    expectTypeOf<RoutingKey<"order.">>().toEqualTypeOf<never>();
  });
});

describe("BindingPattern type validation", () => {
  test("should accept valid binding patterns with wildcards", () => {
    expectTypeOf<BindingPattern<"order.*">>().toEqualTypeOf<"order.*">();
    expectTypeOf<BindingPattern<"order.#">>().toEqualTypeOf<"order.#">();
    expectTypeOf<BindingPattern<"*.created">>().toEqualTypeOf<"*.created">();
    expectTypeOf<BindingPattern<"#">>().toEqualTypeOf<"#">();
    expectTypeOf<BindingPattern<"*">>().toEqualTypeOf<"*">();
    expectTypeOf<BindingPattern<"order.*.urgent">>().toEqualTypeOf<"order.*.urgent">();
    expectTypeOf<BindingPattern<"order.#.completed">>().toEqualTypeOf<"order.#.completed">();
  });

  test("should accept exact match patterns (concrete routing keys)", () => {
    expectTypeOf<BindingPattern<"order.created">>().toEqualTypeOf<"order.created">();
  });

  test("should reject invalid binding patterns", () => {
    // @ is not allowed
    expectTypeOf<BindingPattern<"order.@">>().toEqualTypeOf<never>();
    
    // ! is not allowed
    expectTypeOf<BindingPattern<"order.*!">>().toEqualTypeOf<never>();
    
    // space is not allowed
    expectTypeOf<BindingPattern<"order created">>().toEqualTypeOf<never>();
    
    // empty is not allowed
    expectTypeOf<BindingPattern<"">>().toEqualTypeOf<never>();
  });
});

describe("MatchingRoutingKey pattern matching", () => {
  test("should match valid routing keys against patterns with * wildcard", () => {
    // * matches exactly one word
    expectTypeOf<MatchingRoutingKey<"order.*", "order.created">>().toEqualTypeOf<"order.created">();
    expectTypeOf<MatchingRoutingKey<"*.created", "order.created">>().toEqualTypeOf<"order.created">();
  });

  test("should match valid routing keys against patterns with # wildcard", () => {
    // # matches zero or more words
    expectTypeOf<MatchingRoutingKey<"order.#", "order.created">>().toEqualTypeOf<"order.created">();
    expectTypeOf<MatchingRoutingKey<"order.#", "order.created.urgent">>().toEqualTypeOf<"order.created.urgent">();
  });

  test("should match exact routing keys", () => {
    expectTypeOf<MatchingRoutingKey<"order.created", "order.created">>().toEqualTypeOf<"order.created">();
  });

  test("should reject non-matching routing keys", () => {
    // Wrong prefix
    expectTypeOf<MatchingRoutingKey<"order.*", "user.created">>().toEqualTypeOf<never>();
    
    // * matches only one word, not multiple
    expectTypeOf<MatchingRoutingKey<"order.*", "order.created.urgent">>().toEqualTypeOf<never>();
    
    // Wrong suffix
    expectTypeOf<MatchingRoutingKey<"*.created", "order.updated">>().toEqualTypeOf<never>();
  });

  test("should handle # wildcard in the middle of patterns", () => {
    // # matches zero segments
    expectTypeOf<MatchingRoutingKey<"order.#.completed", "order.completed">>().toEqualTypeOf<"order.completed">();
    
    // # matches one segment
    expectTypeOf<MatchingRoutingKey<"order.#.completed", "order.created.completed">>().toEqualTypeOf<"order.created.completed">();
    
    // # matches two segments
    expectTypeOf<MatchingRoutingKey<"order.#.completed", "order.created.urgent.completed">>().toEqualTypeOf<"order.created.urgent.completed">();
  });

  test("should reject when # pattern does not match suffix", () => {
    // Missing .completed suffix
    expectTypeOf<MatchingRoutingKey<"order.#.completed", "order.created">>().toEqualTypeOf<never>();
    
    // Wrong prefix
    expectTypeOf<MatchingRoutingKey<"order.#.completed", "user.completed">>().toEqualTypeOf<never>();
  });
});
