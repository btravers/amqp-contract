import {
  type TelemetryProvider,
  _resetTelemetryCacheForTesting,
  defaultTelemetryProvider,
  endSpanError,
  endSpanSuccess,
  recordConsumeMetric,
  recordPublishMetric,
  startConsumeSpan,
  startPublishSpan,
} from "./telemetry.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Telemetry", () => {
  beforeEach(() => {
    _resetTelemetryCacheForTesting();
  });

  afterEach(() => {
    _resetTelemetryCacheForTesting();
  });

  describe("defaultTelemetryProvider", () => {
    it("should return a TelemetryProvider object", () => {
      expect(defaultTelemetryProvider).toBeDefined();
      expect(typeof defaultTelemetryProvider.getTracer).toBe("function");
      expect(typeof defaultTelemetryProvider.getPublishCounter).toBe("function");
      expect(typeof defaultTelemetryProvider.getConsumeCounter).toBe("function");
      expect(typeof defaultTelemetryProvider.getPublishLatencyHistogram).toBe("function");
      expect(typeof defaultTelemetryProvider.getConsumeLatencyHistogram).toBe("function");
    });

    it("should return tracer when OpenTelemetry is available", () => {
      // Since @opentelemetry/api is installed as a dev dependency,
      // the provider should return a tracer
      const tracer = defaultTelemetryProvider.getTracer();
      expect(tracer).toBeDefined();
    });
  });

  describe("startPublishSpan", () => {
    it("should return undefined when tracer is not available", () => {
      const mockProvider: TelemetryProvider = {
        getTracer: () => undefined,
        getPublishCounter: () => undefined,
        getConsumeCounter: () => undefined,
        getPublishLatencyHistogram: () => undefined,
        getConsumeLatencyHistogram: () => undefined,
      };

      const span = startPublishSpan(mockProvider, "test-exchange", "test.key");
      expect(span).toBeUndefined();
    });

    it("should create span with correct attributes when tracer is available", () => {
      const mockSpan = {
        end: vi.fn(),
        setStatus: vi.fn(),
        recordException: vi.fn(),
        setAttribute: vi.fn(),
      };

      const mockTracer = {
        startSpan: vi.fn().mockReturnValue(mockSpan),
      };

      const mockProvider: TelemetryProvider = {
        getTracer: () => mockTracer as unknown as ReturnType<TelemetryProvider["getTracer"]>,
        getPublishCounter: () => undefined,
        getConsumeCounter: () => undefined,
        getPublishLatencyHistogram: () => undefined,
        getConsumeLatencyHistogram: () => undefined,
      };

      const span = startPublishSpan(mockProvider, "test-exchange", "test.key", {
        "amqp.publisher.name": "testPublisher",
      });

      expect(span).toBe(mockSpan);
      expect(mockTracer.startSpan).toHaveBeenCalledTimes(1);
      expect(mockTracer.startSpan).toHaveBeenCalledWith("test-exchange publish", {
        kind: 3, // SpanKind.PRODUCER
        attributes: expect.objectContaining({
          "messaging.system": "rabbitmq",
          "messaging.destination.name": "test-exchange",
          "messaging.destination.kind": "exchange",
          "messaging.operation": "publish",
          "messaging.rabbitmq.destination.routing_key": "test.key",
          "amqp.publisher.name": "testPublisher",
        }),
      });
    });

    it("should not include routing key when undefined", () => {
      const mockSpan = {
        end: vi.fn(),
        setStatus: vi.fn(),
        recordException: vi.fn(),
        setAttribute: vi.fn(),
      };

      const mockTracer = {
        startSpan: vi.fn().mockReturnValue(mockSpan),
      };

      const mockProvider: TelemetryProvider = {
        getTracer: () => mockTracer as unknown as ReturnType<TelemetryProvider["getTracer"]>,
        getPublishCounter: () => undefined,
        getConsumeCounter: () => undefined,
        getPublishLatencyHistogram: () => undefined,
        getConsumeLatencyHistogram: () => undefined,
      };

      startPublishSpan(mockProvider, "test-exchange", undefined);

      expect(mockTracer.startSpan).toHaveBeenCalledWith("test-exchange publish", {
        kind: 3,
        attributes: expect.not.objectContaining({
          "messaging.rabbitmq.destination.routing_key": expect.anything(),
        }),
      });
    });
  });

  describe("startConsumeSpan", () => {
    it("should return undefined when tracer is not available", () => {
      const mockProvider: TelemetryProvider = {
        getTracer: () => undefined,
        getPublishCounter: () => undefined,
        getConsumeCounter: () => undefined,
        getPublishLatencyHistogram: () => undefined,
        getConsumeLatencyHistogram: () => undefined,
      };

      const span = startConsumeSpan(mockProvider, "test-queue", "testConsumer");
      expect(span).toBeUndefined();
    });

    it("should create span with correct attributes when tracer is available", () => {
      const mockSpan = {
        end: vi.fn(),
        setStatus: vi.fn(),
        recordException: vi.fn(),
        setAttribute: vi.fn(),
      };

      const mockTracer = {
        startSpan: vi.fn().mockReturnValue(mockSpan),
      };

      const mockProvider: TelemetryProvider = {
        getTracer: () => mockTracer as unknown as ReturnType<TelemetryProvider["getTracer"]>,
        getPublishCounter: () => undefined,
        getConsumeCounter: () => undefined,
        getPublishLatencyHistogram: () => undefined,
        getConsumeLatencyHistogram: () => undefined,
      };

      const span = startConsumeSpan(mockProvider, "test-queue", "testConsumer", {
        "messaging.rabbitmq.message.delivery_tag": 1,
      });

      expect(span).toBe(mockSpan);
      expect(mockTracer.startSpan).toHaveBeenCalledTimes(1);
      expect(mockTracer.startSpan).toHaveBeenCalledWith("test-queue process", {
        kind: 4, // SpanKind.CONSUMER
        attributes: expect.objectContaining({
          "messaging.system": "rabbitmq",
          "messaging.destination.name": "test-queue",
          "messaging.destination.kind": "queue",
          "messaging.operation": "process",
          "amqp.consumer.name": "testConsumer",
          "messaging.rabbitmq.message.delivery_tag": 1,
        }),
      });
    });
  });

  describe("endSpanSuccess", () => {
    it("should do nothing when span is undefined", () => {
      // Should not throw
      expect(() => endSpanSuccess(undefined)).not.toThrow();
    });

    it("should end span without status when OpenTelemetry is not available", () => {
      const mockSpan = {
        end: vi.fn(),
        setStatus: vi.fn(),
      };

      // Without OpenTelemetry loaded, it just calls end
      endSpanSuccess(mockSpan as unknown as Parameters<typeof endSpanSuccess>[0]);

      expect(mockSpan.end).toHaveBeenCalledTimes(1);
    });
  });

  describe("endSpanError", () => {
    it("should do nothing when span is undefined", () => {
      const error = new Error("Test error");
      // Should not throw
      expect(() => endSpanError(undefined, error)).not.toThrow();
    });

    it("should end span when called with error", () => {
      const mockSpan = {
        end: vi.fn(),
        setStatus: vi.fn(),
        recordException: vi.fn(),
        setAttribute: vi.fn(),
      };

      const error = new Error("Test error");
      endSpanError(mockSpan as unknown as Parameters<typeof endSpanError>[0], error);

      expect(mockSpan.end).toHaveBeenCalledTimes(1);
    });
  });

  describe("recordPublishMetric", () => {
    it("should do nothing when counter and histogram are undefined", () => {
      const mockProvider: TelemetryProvider = {
        getTracer: () => undefined,
        getPublishCounter: () => undefined,
        getConsumeCounter: () => undefined,
        getPublishLatencyHistogram: () => undefined,
        getConsumeLatencyHistogram: () => undefined,
      };

      // Should not throw
      expect(() =>
        recordPublishMetric(mockProvider, "test-exchange", "test.key", true, 100),
      ).not.toThrow();
    });

    it("should record counter and histogram when available", () => {
      const mockCounter = { add: vi.fn() };
      const mockHistogram = { record: vi.fn() };

      const mockProvider: TelemetryProvider = {
        getTracer: () => undefined,
        getPublishCounter: () =>
          mockCounter as unknown as ReturnType<TelemetryProvider["getPublishCounter"]>,
        getConsumeCounter: () => undefined,
        getPublishLatencyHistogram: () =>
          mockHistogram as unknown as ReturnType<TelemetryProvider["getPublishLatencyHistogram"]>,
        getConsumeLatencyHistogram: () => undefined,
      };

      recordPublishMetric(mockProvider, "test-exchange", "test.key", true, 150);

      expect(mockCounter.add).toHaveBeenCalledTimes(1);
      expect(mockCounter.add).toHaveBeenCalledWith(1, {
        "messaging.system": "rabbitmq",
        "messaging.destination.name": "test-exchange",
        "messaging.rabbitmq.destination.routing_key": "test.key",
        success: true,
      });

      expect(mockHistogram.record).toHaveBeenCalledTimes(1);
      expect(mockHistogram.record).toHaveBeenCalledWith(150, {
        "messaging.system": "rabbitmq",
        "messaging.destination.name": "test-exchange",
        "messaging.rabbitmq.destination.routing_key": "test.key",
        success: true,
      });
    });
  });

  describe("recordConsumeMetric", () => {
    it("should do nothing when counter and histogram are undefined", () => {
      const mockProvider: TelemetryProvider = {
        getTracer: () => undefined,
        getPublishCounter: () => undefined,
        getConsumeCounter: () => undefined,
        getPublishLatencyHistogram: () => undefined,
        getConsumeLatencyHistogram: () => undefined,
      };

      // Should not throw
      expect(() =>
        recordConsumeMetric(mockProvider, "test-queue", "testConsumer", false, 200),
      ).not.toThrow();
    });

    it("should record counter and histogram when available", () => {
      const mockCounter = { add: vi.fn() };
      const mockHistogram = { record: vi.fn() };

      const mockProvider: TelemetryProvider = {
        getTracer: () => undefined,
        getPublishCounter: () => undefined,
        getConsumeCounter: () =>
          mockCounter as unknown as ReturnType<TelemetryProvider["getConsumeCounter"]>,
        getPublishLatencyHistogram: () => undefined,
        getConsumeLatencyHistogram: () =>
          mockHistogram as unknown as ReturnType<TelemetryProvider["getConsumeLatencyHistogram"]>,
      };

      recordConsumeMetric(mockProvider, "test-queue", "testConsumer", false, 250);

      expect(mockCounter.add).toHaveBeenCalledTimes(1);
      expect(mockCounter.add).toHaveBeenCalledWith(1, {
        "messaging.system": "rabbitmq",
        "messaging.destination.name": "test-queue",
        "amqp.consumer.name": "testConsumer",
        success: false,
      });

      expect(mockHistogram.record).toHaveBeenCalledTimes(1);
      expect(mockHistogram.record).toHaveBeenCalledWith(250, {
        "messaging.system": "rabbitmq",
        "messaging.destination.name": "test-queue",
        "amqp.consumer.name": "testConsumer",
        success: false,
      });
    });
  });
});
