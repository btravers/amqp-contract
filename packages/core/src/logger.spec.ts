import { describe, expect, it, vi } from "vitest";
import type { Logger } from "./logger.js";

describe("Logger", () => {
  it("should call debug method with message and context", () => {
    // GIVEN
    const logger: Logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // WHEN
    logger.debug("test debug", { key: "value" });

    // THEN
    expect(logger.debug).toHaveBeenCalledWith("test debug", { key: "value" });
  });

  it("should call info method with message and context", () => {
    // GIVEN
    const logger: Logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // WHEN
    logger.info("test info", { key: "value" });

    // THEN
    expect(logger.info).toHaveBeenCalledWith("test info", { key: "value" });
  });

  it("should call warn method with message and context", () => {
    // GIVEN
    const logger: Logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // WHEN
    logger.warn("test warn", { key: "value" });

    // THEN
    expect(logger.warn).toHaveBeenCalledWith("test warn", { key: "value" });
  });

  it("should call error method with message and context", () => {
    // GIVEN
    const logger: Logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // WHEN
    logger.error("test error", { key: "value" });

    // THEN
    expect(logger.error).toHaveBeenCalledWith("test error", { key: "value" });
  });
});
