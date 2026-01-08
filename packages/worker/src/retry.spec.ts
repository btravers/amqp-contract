import {
  RETRY_COUNT_HEADER,
  calculateBackoffDelay,
  getRetryCount,
  isNonRetryableError,
  shouldRetry,
} from "./retry.js";
import { describe, expect, it } from "vitest";
import type { Message } from "amqplib";
import type { RetryPolicy } from "./types.js";

describe("Retry utilities", () => {
  describe("getRetryCount", () => {
    it("should return 0 when retry count header is not present", () => {
      const msg: Message = {
        properties: {
          headers: {},
        },
      } as Message;

      expect(getRetryCount(msg)).toBe(0);
    });

    it("should return 0 when headers are undefined", () => {
      const msg: Message = {
        properties: {},
      } as Message;

      expect(getRetryCount(msg)).toBe(0);
    });

    it("should return retry count from header", () => {
      const msg: Message = {
        properties: {
          headers: {
            [RETRY_COUNT_HEADER]: 3,
          },
        },
      } as Message;

      expect(getRetryCount(msg)).toBe(3);
    });

    it("should return 0 for invalid retry count values", () => {
      const msg: Message = {
        properties: {
          headers: {
            [RETRY_COUNT_HEADER]: "invalid",
          },
        },
      } as Message;

      expect(getRetryCount(msg)).toBe(0);
    });

    it("should return 0 for negative retry count values", () => {
      const msg: Message = {
        properties: {
          headers: {
            [RETRY_COUNT_HEADER]: -1,
          },
        },
      } as Message;

      expect(getRetryCount(msg)).toBe(0);
    });
  });

  describe("calculateBackoffDelay", () => {
    it("should return default delay when no backoff configured", () => {
      const policy: RetryPolicy = {
        maxAttempts: 3,
      };

      expect(calculateBackoffDelay(0, policy)).toBe(1_000);
    });

    it("should return initial delay for fixed backoff", () => {
      const policy: RetryPolicy = {
        maxAttempts: 3,
        backoff: {
          type: "fixed",
          initialInterval: 2_000,
        },
      };

      expect(calculateBackoffDelay(0, policy)).toBe(2_000);
      expect(calculateBackoffDelay(1, policy)).toBe(2_000);
      expect(calculateBackoffDelay(5, policy)).toBe(2_000);
    });

    it("should calculate exponential backoff correctly", () => {
      const policy: RetryPolicy = {
        maxAttempts: 5,
        backoff: {
          type: "exponential",
          initialInterval: 1_000,
          coefficient: 2,
        },
      };

      expect(calculateBackoffDelay(0, policy)).toBe(1_000); // 1000 * 2^0 = 1000
      expect(calculateBackoffDelay(1, policy)).toBe(2_000); // 1000 * 2^1 = 2000
      expect(calculateBackoffDelay(2, policy)).toBe(4_000); // 1000 * 2^2 = 4000
      expect(calculateBackoffDelay(3, policy)).toBe(8_000); // 1000 * 2^3 = 8000
    });

    it("should respect max delay for exponential backoff", () => {
      const policy: RetryPolicy = {
        maxAttempts: 10,
        backoff: {
          type: "exponential",
          initialInterval: 1_000,
          maxInterval: 5_000,
          coefficient: 2,
        },
      };

      expect(calculateBackoffDelay(0, policy)).toBe(1_000);
      expect(calculateBackoffDelay(1, policy)).toBe(2_000);
      expect(calculateBackoffDelay(2, policy)).toBe(4_000);
      expect(calculateBackoffDelay(3, policy)).toBe(5_000); // Capped at maxInterval
      expect(calculateBackoffDelay(10, policy)).toBe(5_000); // Still capped
    });

    it("should use default values when not specified", () => {
      const policy: RetryPolicy = {
        maxAttempts: 3,
        backoff: {
          type: "exponential",
        },
      };

      // Default: initialInterval=1_000, coefficient=2, maxInterval=60_000
      expect(calculateBackoffDelay(0, policy)).toBe(1_000);
      expect(calculateBackoffDelay(1, policy)).toBe(2_000);
    });
  });

  describe("shouldRetry", () => {
    it("should default to no retries when no policy configured", () => {
      const msg: Message = {
        properties: {
          headers: {
            [RETRY_COUNT_HEADER]: 0,
          },
        },
      } as Message;

      const result = shouldRetry(msg, undefined);

      // When no policy is configured, default to 1 attempt (no retries)
      expect(result).toEqual({
        shouldRetry: false,
        delay: 0,
        currentRetryCount: 0,
      });
    });

    it("should allow retry when under max retries", () => {
      const policy: RetryPolicy = {
        maxAttempts: 3,
        backoff: {
          type: "fixed",
          initialInterval: 1_000,
        },
      };

      const msg: Message = {
        properties: {
          headers: {
            [RETRY_COUNT_HEADER]: 1,
          },
        },
      } as Message;

      const result = shouldRetry(msg, policy);

      expect(result).toEqual({
        shouldRetry: true,
        delay: 1_000,
        currentRetryCount: 1,
      });
    });

    it("should disallow retry when max attempts reached", () => {
      const policy: RetryPolicy = {
        maxAttempts: 3,
      };

      // After 2 attempts (count 0, 1), we're about to do attempt 3
      // With maxAttempts=3, this should be the last attempt
      // So after it fails (count 2), we should NOT retry
      const msg: Message = {
        properties: {
          headers: {
            [RETRY_COUNT_HEADER]: 2,
          },
        },
      } as Message;

      const result = shouldRetry(msg, policy);

      expect(result).toEqual({
        shouldRetry: false,
        delay: 0,
        currentRetryCount: 2,
      });
    });

    it("should disallow retry when max retries exceeded", () => {
      const policy: RetryPolicy = {
        maxAttempts: 3,
      };

      const msg: Message = {
        properties: {
          headers: {
            [RETRY_COUNT_HEADER]: 5,
          },
        },
      } as Message;

      const result = shouldRetry(msg, policy);

      expect(result).toEqual({
        shouldRetry: false,
        delay: 0,
        currentRetryCount: 5,
      });
    });

    it("should calculate exponential backoff delay", () => {
      const policy: RetryPolicy = {
        maxAttempts: 5,
        backoff: {
          type: "exponential",
          initialInterval: 1_000,
          coefficient: 2,
        },
      };

      const msg: Message = {
        properties: {
          headers: {
            [RETRY_COUNT_HEADER]: 2,
          },
        },
      } as Message;

      const result = shouldRetry(msg, policy);

      expect(result).toEqual({
        shouldRetry: true,
        delay: 4_000, // 1000 * 2^2 = 4000
        currentRetryCount: 2,
      });
    });

    it("should handle zero max retries (fail fast)", () => {
      const policy: RetryPolicy = {
        maxAttempts: 0,
      };

      const msg: Message = {
        properties: {
          headers: {},
        },
      } as Message;

      const result = shouldRetry(msg, policy);

      expect(result).toEqual({
        shouldRetry: false,
        delay: 0,
        currentRetryCount: 0,
      });
    });
  });

  describe("isNonRetryableError", () => {
    it("should return false when no policy configured", () => {
      const error = new Error("Test error");
      expect(isNonRetryableError(error, undefined)).toBe(false);
    });

    it("should return false when nonRetryableErrors not configured", () => {
      const error = new Error("Test error");
      const policy: RetryPolicy = { maxAttempts: 3 };
      expect(isNonRetryableError(error, policy)).toBe(false);
    });

    it("should return false when nonRetryableErrors is empty", () => {
      const error = new Error("Test error");
      const policy: RetryPolicy = { maxAttempts: 3, nonRetryableErrors: [] };
      expect(isNonRetryableError(error, policy)).toBe(false);
    });

    it("should match by error constructor name", () => {
      class ValidationError extends Error {
        constructor(message: string) {
          super(message);
          this.name = "ValidationError";
        }
      }
      const error = new ValidationError("Invalid input");
      const policy: RetryPolicy = {
        maxAttempts: 3,
        nonRetryableErrors: ["ValidationError"],
      };
      expect(isNonRetryableError(error, policy)).toBe(true);
    });

    it("should match by error message substring (case-insensitive)", () => {
      const error = new Error("Invalid format provided");
      const policy: RetryPolicy = {
        maxAttempts: 3,
        nonRetryableErrors: ["invalid format"],
      };
      expect(isNonRetryableError(error, policy)).toBe(true);
    });

    it("should match by error message substring with different casing", () => {
      const error = new Error("AUTHENTICATION FAILED");
      const policy: RetryPolicy = {
        maxAttempts: 3,
        nonRetryableErrors: ["authentication failed"],
      };
      expect(isNonRetryableError(error, policy)).toBe(true);
    });

    it("should match multiple patterns", () => {
      class AuthError extends Error {
        constructor(message: string) {
          super(message);
          this.name = "AuthError";
        }
      }
      const error = new AuthError("Unauthorized access");
      const policy: RetryPolicy = {
        maxAttempts: 3,
        nonRetryableErrors: ["ValidationError", "AuthError", "timeout"],
      };
      expect(isNonRetryableError(error, policy)).toBe(true);
    });

    it("should return false when no patterns match", () => {
      const error = new Error("Connection timeout");
      const policy: RetryPolicy = {
        maxAttempts: 3,
        nonRetryableErrors: ["ValidationError", "AuthenticationError"],
      };
      expect(isNonRetryableError(error, policy)).toBe(false);
    });

    it("should handle non-Error objects", () => {
      const error = "string error";
      const policy: RetryPolicy = {
        maxAttempts: 3,
        nonRetryableErrors: ["string error"],
      };
      expect(isNonRetryableError(error, policy)).toBe(true);
    });

    it("should handle non-Error objects that don't match", () => {
      const error = "network failure";
      const policy: RetryPolicy = {
        maxAttempts: 3,
        nonRetryableErrors: ["ValidationError"],
      };
      expect(isNonRetryableError(error, policy)).toBe(false);
    });

    it("should match partial error message substring", () => {
      const error = new Error("The provided email format is invalid");
      const policy: RetryPolicy = {
        maxAttempts: 3,
        nonRetryableErrors: ["invalid"],
      };
      expect(isNonRetryableError(error, policy)).toBe(true);
    });
  });
});
