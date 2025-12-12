import { describe, expect, it } from "vitest";
import * as v from "valibot";
import { defineContract, definePublisher, defineExchange } from "@amqp-contract/contract";

describe("@amqp-contract/valibot", () => {
  it("should work with valibot schemas", () => {
    const schema = v.object({
      id: v.string(),
      name: v.string(),
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
