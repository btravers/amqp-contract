import { ClientInstrumentation, WorkerInstrumentation } from "./instrumentation.js";
import { type Span, SpanKind, SpanStatusCode, type Tracer } from "@opentelemetry/api";
import { describe, expect, it, vi } from "vitest";

describe("ClientInstrumentation", () => {
  describe("constructor", () => {
    it("should create instance with default config", () => {
      const instrumentation = new ClientInstrumentation();
      expect(instrumentation).toBeDefined();
    });

    it("should create instance with custom tracer", () => {
      const mockTracer = { startSpan: vi.fn() };
      const instrumentation = new ClientInstrumentation({
        tracer: mockTracer as unknown as Tracer,
      });
      expect(instrumentation).toBeDefined();
    });
  });

  describe("startPublishSpan", () => {
    it("should create span with correct attributes", () => {
      const mockSpan = {
        setStatus: vi.fn(),
        setAttribute: vi.fn(),
        recordException: vi.fn(),
        end: vi.fn(),
      };
      const mockTracer = { startSpan: vi.fn().mockReturnValue(mockSpan) };
      const instrumentation = new ClientInstrumentation({
        tracer: mockTracer as unknown as Tracer,
        enableTracing: true,
      });

      const span = instrumentation.startPublishSpan(
        "testPublisher",
        "test-exchange",
        "test.routing.key",
        "topic",
      );

      expect(mockTracer.startSpan).toHaveBeenCalledWith(
        "test-exchange publish",
        expect.objectContaining({
          kind: SpanKind.PRODUCER,
          attributes: expect.objectContaining({
            "messaging.system": "rabbitmq",
            "messaging.operation": "publish",
          }),
        }),
      );
      expect(span).toBe(mockSpan);
    });
  });

  describe("recordSuccess", () => {
    it("should set success status", () => {
      const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn() } as unknown as Span;
      const instrumentation = new ClientInstrumentation();

      instrumentation.recordSuccess(mockSpan);

      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
    });
  });
});

describe("WorkerInstrumentation", () => {
  describe("constructor", () => {
    it("should create instance with default config", () => {
      const instrumentation = new WorkerInstrumentation();
      expect(instrumentation).toBeDefined();
    });
  });

  describe("startConsumeSpan", () => {
    it("should create span with correct attributes", () => {
      const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
      const mockTracer = { startSpan: vi.fn().mockReturnValue(mockSpan) };
      const instrumentation = new WorkerInstrumentation({
        tracer: mockTracer as unknown as Tracer,
        enableTracing: true,
      });

      const span = instrumentation.startConsumeSpan("testConsumer", "test-queue");

      expect(mockTracer.startSpan).toHaveBeenCalledWith(
        "test-queue receive",
        expect.objectContaining({
          kind: SpanKind.CONSUMER,
          attributes: expect.objectContaining({
            "messaging.system": "rabbitmq",
            "messaging.operation": "receive",
          }),
        }),
        undefined,
      );
      expect(span).toBe(mockSpan);
    });
  });
});
