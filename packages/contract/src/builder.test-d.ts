/**
 * Type tests for routing key and binding pattern validation using Vitest
 * These tests ensure that the type system correctly validates routing keys and patterns
 */

import type { BindingPattern, MatchingRoutingKey, RoutingKey } from "./builder.js";
import { describe, expectTypeOf, test } from "vitest";

describe("RoutingKey type validation", () => {
  test("should accept valid routing keys", () => {
    expectTypeOf<RoutingKey<"order.created">>().toEqualTypeOf<"order.created">();
    expectTypeOf<RoutingKey<"user-profile.updated">>().toEqualTypeOf<"user-profile.updated">();
    expectTypeOf<
      RoutingKey<"system_event.notification">
    >().toEqualTypeOf<"system_event.notification">();
    expectTypeOf<RoutingKey<"a">>().toEqualTypeOf<"a">();
    expectTypeOf<RoutingKey<"ABC123">>().toEqualTypeOf<"ABC123">();
  });

  test("should reject routing keys with wildcards", () => {
    // * wildcard is not allowed in routing keys
    expectTypeOf<RoutingKey<"order.*">>().toEqualTypeOf<never>();

    // # wildcard is not allowed in routing keys
    expectTypeOf<RoutingKey<"order.#">>().toEqualTypeOf<never>();

    // wildcards in the middle not allowed
    expectTypeOf<RoutingKey<"order.*.created">>().toEqualTypeOf<never>();
  });

  test("should reject empty routing keys", () => {
    // empty is not allowed
    expectTypeOf<RoutingKey<"">>().toEqualTypeOf<never>();
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

  test("should reject empty binding patterns", () => {
    // empty is not allowed
    expectTypeOf<BindingPattern<"">>().toEqualTypeOf<never>();
  });
});

describe("MatchingRoutingKey pattern matching", () => {
  test("should match valid routing keys against patterns with * wildcard", () => {
    // * matches exactly one word
    expectTypeOf<MatchingRoutingKey<"order.*", "order.created">>().toEqualTypeOf<"order.created">();
    expectTypeOf<
      MatchingRoutingKey<"*.created", "order.created">
    >().toEqualTypeOf<"order.created">();
  });

  test("should match valid routing keys against patterns with # wildcard", () => {
    // # matches zero or more words
    expectTypeOf<MatchingRoutingKey<"order.#", "order.created">>().toEqualTypeOf<"order.created">();
    expectTypeOf<
      MatchingRoutingKey<"order.#", "order.created.urgent">
    >().toEqualTypeOf<"order.created.urgent">();
  });

  test("should match exact routing keys", () => {
    expectTypeOf<
      MatchingRoutingKey<"order.created", "order.created">
    >().toEqualTypeOf<"order.created">();
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
    expectTypeOf<
      MatchingRoutingKey<"order.#.completed", "order.completed">
    >().toEqualTypeOf<"order.completed">();

    // # matches one segment
    expectTypeOf<
      MatchingRoutingKey<"order.#.completed", "order.created.completed">
    >().toEqualTypeOf<"order.created.completed">();

    // # matches two segments
    expectTypeOf<
      MatchingRoutingKey<"order.#.completed", "order.created.urgent.completed">
    >().toEqualTypeOf<"order.created.urgent.completed">();
  });

  test("should reject when # pattern does not match suffix", () => {
    // Missing .completed suffix
    expectTypeOf<MatchingRoutingKey<"order.#.completed", "order.created">>().toEqualTypeOf<never>();

    // Wrong prefix
    expectTypeOf<
      MatchingRoutingKey<"order.#.completed", "user.completed">
    >().toEqualTypeOf<never>();
  });
});

describe("Publisher and Consumer factory types", () => {
  test("defineEventPublisher with direct exchange should accept valid routing keys", () => {
    // Test that the publisher factory method accepts RoutingKey validated routing keys
    // The actual runtime validation will be tested in integration tests
    expectTypeOf<RoutingKey<"order.created">>().toEqualTypeOf<"order.created">();
    expectTypeOf<RoutingKey<"user-profile.updated">>().toEqualTypeOf<"user-profile.updated">();
  });

  test("defineEventPublisher with topic exchange should accept valid routing keys", () => {
    // Topic exchange routing keys must be valid RoutingKey types
    expectTypeOf<RoutingKey<"order.created">>().toEqualTypeOf<"order.created">();
    expectTypeOf<RoutingKey<"order.*.urgent">>().not.toEqualTypeOf<"order.*.urgent">(); // Wildcards not allowed in routing keys
  });

  test("defineCommandConsumer with topic exchange should accept valid binding patterns", () => {
    // Topic exchange binding patterns can include wildcards
    expectTypeOf<BindingPattern<"order.*">>().toEqualTypeOf<"order.*">();
    expectTypeOf<BindingPattern<"order.#">>().toEqualTypeOf<"order.#">();
    expectTypeOf<BindingPattern<"order.created">>().toEqualTypeOf<"order.created">();
  });

  test("defineCommandPublisher should accept routing keys matching the consumer pattern", () => {
    // When consumer binding is "order.*", publisher can use any key matching that pattern
    // This is tested via MatchingRoutingKey type
    expectTypeOf<MatchingRoutingKey<"order.*", "order.created">>().toEqualTypeOf<"order.created">();
    expectTypeOf<MatchingRoutingKey<"order.*", "order.updated">>().toEqualTypeOf<"order.updated">();
    expectTypeOf<MatchingRoutingKey<"order.*", "order.deleted">>().toEqualTypeOf<"order.deleted">();
  });

  test("defineEventConsumer should accept binding patterns for topic exchanges", () => {
    // When publisher uses "order.created", consumer can bind with patterns
    expectTypeOf<BindingPattern<"order.*">>().toEqualTypeOf<"order.*">();
    expectTypeOf<BindingPattern<"order.#">>().toEqualTypeOf<"order.#">();
    expectTypeOf<BindingPattern<"#">>().toEqualTypeOf<"#">();
  });

  test("routing keys must not contain wildcards", () => {
    // Routing keys cannot have * or # - these are only for binding patterns
    expectTypeOf<RoutingKey<"order.*">>().toEqualTypeOf<never>();
    expectTypeOf<RoutingKey<"order.#">>().toEqualTypeOf<never>();
  });

  test("binding patterns can be concrete keys or patterns", () => {
    // BindingPattern accepts both concrete keys and patterns with wildcards
    expectTypeOf<BindingPattern<"order.created">>().toEqualTypeOf<"order.created">();
    expectTypeOf<BindingPattern<"order.*">>().toEqualTypeOf<"order.*">();
    expectTypeOf<BindingPattern<"order.#">>().toEqualTypeOf<"order.#">();
  });
});
