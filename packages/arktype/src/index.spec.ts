import { describe, expect, it } from "vitest";
import { type } from "arktype";
import { defineContract, definePublisher, defineExchange } from "@amqp-contract/contract";

describe("@amqp-contract/arktype", () => {
  it("should work with arktype schemas", () => {
    const schema = type({
      id: "string",
      name: "string",
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
