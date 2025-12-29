import {
  AMQP_ATTRIBUTES,
  AMQP_OPERATIONS,
  MESSAGING_SYSTEM_AMQP,
  TRACE_CONTEXT_HEADERS,
} from "./constants.js";
import { describe, expect, it } from "vitest";

describe("Constants", () => {
  describe("AMQP_ATTRIBUTES", () => {
    it("should define all required messaging attributes", () => {
      expect(AMQP_ATTRIBUTES.MESSAGING_DESTINATION_NAME).toBe("messaging.destination.name");
      expect(AMQP_ATTRIBUTES.MESSAGING_OPERATION).toBe("messaging.operation");
      expect(AMQP_ATTRIBUTES.MESSAGING_SYSTEM).toBe("messaging.system");
      expect(AMQP_ATTRIBUTES.MESSAGING_RABBITMQ_ROUTING_KEY).toBe("messaging.rabbitmq.routing_key");
    });
  });

  describe("AMQP_OPERATIONS", () => {
    it("should define all operation types", () => {
      expect(AMQP_OPERATIONS.PUBLISH).toBe("publish");
      expect(AMQP_OPERATIONS.RECEIVE).toBe("receive");
      expect(AMQP_OPERATIONS.PROCESS).toBe("process");
    });
  });

  describe("MESSAGING_SYSTEM_AMQP", () => {
    it("should define the messaging system identifier", () => {
      expect(MESSAGING_SYSTEM_AMQP).toBe("rabbitmq");
    });
  });

  describe("TRACE_CONTEXT_HEADERS", () => {
    it("should define W3C trace context headers", () => {
      expect(TRACE_CONTEXT_HEADERS.TRACEPARENT).toBe("traceparent");
      expect(TRACE_CONTEXT_HEADERS.TRACESTATE).toBe("tracestate");
    });
  });
});
