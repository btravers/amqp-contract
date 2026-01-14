import { Future, Result } from "@swan-io/boxed";
import {
  defineConsumer,
  defineContract,
  defineExchange,
  defineMessage,
  defineQueue,
} from "@amqp-contract/contract";
import { describe, expect, it } from "vitest";
import { TechnicalError } from "./errors.js";
import { TypedAmqpWorker } from "./worker.js";
import { defineHandlers } from "./handlers.js";
import { z } from "zod";

describe("TypedAmqpWorker.create validation", () => {
  // Setup test contract
  const testExchange = defineExchange("test-exchange", "topic", { durable: true });
  const testQueue = defineQueue("test-queue", { durable: true });
  const testMessage = defineMessage(
    z.object({
      id: z.string(),
      data: z.string(),
    }),
  );

  const testContract = defineContract({
    exchanges: { test: testExchange },
    queues: { testQueue },
    consumers: {
      testConsumer: defineConsumer(testQueue, testMessage),
    },
  });

  const validHandlers = defineHandlers(testContract, {
    testConsumer: ({ payload }) => {
      console.log(payload.id);
      return Future.value(Result.Ok(undefined));
    },
  });

  it("should return error when contract is missing", async () => {
    // WHEN
    const result = await TypedAmqpWorker.create({
      // oxlint-disable-next-line no-explicit-any
      contract: undefined as any,
      handlers: validHandlers,
      urls: ["amqp://localhost"],
    }).toPromise();

    // THEN
    expect(result.isError()).toBe(true);
    if (result.isError()) {
      expect(result.getError()).toBeInstanceOf(TechnicalError);
      expect(result.getError().message).toBe("Contract is required");
    }
  });

  it("should return error when handlers is missing", async () => {
    // WHEN
    const result = await TypedAmqpWorker.create({
      contract: testContract,
      // oxlint-disable-next-line no-explicit-any
      handlers: undefined as any,
      urls: ["amqp://localhost"],
    }).toPromise();

    // THEN
    expect(result.isError()).toBe(true);
    if (result.isError()) {
      expect(result.getError()).toBeInstanceOf(TechnicalError);
      expect(result.getError().message).toContain("expected record");
    }
  });

  it("should return error when handlers is not an object", async () => {
    // WHEN
    const result = await TypedAmqpWorker.create({
      contract: testContract,
      // oxlint-disable-next-line no-explicit-any
      handlers: "not-an-object" as any,
      urls: ["amqp://localhost"],
    }).toPromise();

    // THEN
    expect(result.isError()).toBe(true);
    if (result.isError()) {
      expect(result.getError()).toBeInstanceOf(TechnicalError);
      expect(result.getError().message).toContain("expected record");
    }
  });

  it("should return error when handlers is empty", async () => {
    // WHEN
    const result = await TypedAmqpWorker.create({
      contract: testContract,
      // oxlint-disable-next-line no-explicit-any
      handlers: {} as any,
      urls: ["amqp://localhost"],
    }).toPromise();

    // THEN
    expect(result.isError()).toBe(true);
    if (result.isError()) {
      expect(result.getError()).toBeInstanceOf(TechnicalError);
      expect(result.getError().message).toBe("At least one handler must be provided");
    }
  });

  it("should return error when urls is missing", async () => {
    // WHEN
    const result = await TypedAmqpWorker.create({
      contract: testContract,
      handlers: validHandlers,
      // oxlint-disable-next-line no-explicit-any
      urls: undefined as any,
    }).toPromise();

    // THEN
    expect(result.isError()).toBe(true);
    if (result.isError()) {
      expect(result.getError()).toBeInstanceOf(TechnicalError);
      expect(result.getError().message).toContain("expected array");
    }
  });

  it("should return error when urls is empty array", async () => {
    // WHEN
    const result = await TypedAmqpWorker.create({
      contract: testContract,
      handlers: validHandlers,
      urls: [],
    }).toPromise();

    // THEN
    expect(result.isError()).toBe(true);
    if (result.isError()) {
      expect(result.getError()).toBeInstanceOf(TechnicalError);
      expect(result.getError().message).toBe("At least one AMQP URL must be provided");
    }
  });
});
