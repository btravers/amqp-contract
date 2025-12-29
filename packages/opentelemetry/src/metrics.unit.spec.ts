import { ClientMetrics, WorkerMetrics } from "./metrics.js";
import { describe, expect, it, vi } from "vitest";
import type { Meter } from "@opentelemetry/api";

describe("ClientMetrics", () => {
  describe("constructor", () => {
    it("should create instance with default config", () => {
      const metrics = new ClientMetrics();
      expect(metrics).toBeDefined();
    });

    it("should create instance with custom meter", () => {
      const mockMeter = {
        createCounter: vi.fn().mockReturnValue({ add: vi.fn() }),
        createHistogram: vi.fn().mockReturnValue({ record: vi.fn() }),
      };

      const _metrics = new ClientMetrics({ meter: mockMeter as unknown as Meter });

      expect(mockMeter.createCounter).toHaveBeenCalled();
      expect(mockMeter.createHistogram).toHaveBeenCalled();
    });
  });

  describe("recordPublish", () => {
    it("should record publish metrics with correct attributes", () => {
      const mockCounter = { add: vi.fn() };
      const mockHistogram = { record: vi.fn() };
      const mockMeter = {
        createCounter: vi.fn().mockReturnValue(mockCounter),
        createHistogram: vi.fn().mockReturnValue(mockHistogram),
      };
      const metrics = new ClientMetrics({ meter: mockMeter as unknown as Meter });

      metrics.recordPublish("testPublisher", "test-exchange", 150);

      expect(mockCounter.add).toHaveBeenCalledWith(1, expect.objectContaining({
        "amqp_contract.publisher.name": "testPublisher",
        "messaging.system": "rabbitmq",
      }));
      expect(mockHistogram.record).toHaveBeenCalledWith(150, expect.anything());
    });
  });
});

describe("WorkerMetrics", () => {
  describe("constructor", () => {
    it("should create instance with default config", () => {
      const metrics = new WorkerMetrics();
      expect(metrics).toBeDefined();
    });
  });

  describe("recordConsume", () => {
    it("should record consume metrics with correct attributes", () => {
      const mockCounter = { add: vi.fn() };
      const mockHistogram = { record: vi.fn() };
      const mockMeter = {
        createCounter: vi.fn().mockReturnValue(mockCounter),
        createHistogram: vi.fn().mockReturnValue(mockHistogram),
      };
      const metrics = new WorkerMetrics({ meter: mockMeter as unknown as Meter });

      metrics.recordConsume("testConsumer", "test-queue", 200);

      expect(mockCounter.add).toHaveBeenCalledWith(1, expect.objectContaining({
        "amqp_contract.consumer.name": "testConsumer",
        "messaging.system": "rabbitmq",
      }));
      expect(mockHistogram.record).toHaveBeenCalledWith(200, expect.anything());
    });
  });
});
