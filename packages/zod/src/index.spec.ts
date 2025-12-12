import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineContract, definePublisher, defineExchange } from "@amqp-contract/contract";
import { zodToJsonSchema } from "./index.js";

describe("@amqp-contract/zod", () => {
  it("should export zodToJsonSchema converter", () => {
    expect(zodToJsonSchema).toBeDefined();
  });

  it("should work with zod schemas", () => {
    const schema = z.object({
      id: z.string(),
      name: z.string(),
    });

    const contract = defineContract({
      exchanges: {
        test: defineExchange("test", "topic"),
      },
      publishers: {
        testPublisher: definePublisher("test", schema),
      },
    });

    expect(contract.publishers?.testPublisher.message).toBe(schema);
  });
});
