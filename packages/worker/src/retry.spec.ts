import { describe, expect, it } from "vitest";
import type { Message } from "amqplib";
import type { RetryPolicy } from "@amqp-contract/contract";
import {
  RETRY_COUNT_HEADER,
  calculateBackoffDelay,
  getRetryCount,
  shouldRetry,
} from "./retry.js";

describe("Retry utilities", () => {
  describe("getRetryCount", () => {
    it("should return 0 when retry count header is not present", () => {
      const msg = {
        properties: {
          headers: {},
        },
      } as Message;

      expect(getRetryCount(msg)).toBe(0);
    });

    it("should return 0 when headers are undefined", () => {
      const msg = {
        properties: {},
      } as Message;

      expect(getRetryCount(msg)).toBe(0);
    });

    it("should return retry count from header", () => {
      const msg = {
        properties: {
          headers: {
            [RETRY_COUNT_HEADER]: 3,
          },
        },
      } as Message;

      expect(getRetryCount(msg)).toBe(3);
    });

    it("should return 0 for invalid retry count values", () => {
      const msg = {
        properties: {
          headers: {
            [RETRY_COUNT_HEADER]: "invalid",
          },
        },
      } as Message;

      expect(getRetryCount(msg)).toBe(0);
    });

    it("should return 0 for negative retry count values", () => {
      const msg = {
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
        maxRetries: 3,
      };

      expect(calculateBackoffDelay(0, policy)).toBe(1000);
    });

    it("should return initial delay for fixed backoff", () => {
      const policy: RetryPolicy = {
        maxRetries: 3,
        backoff: {
          type: "fixed",
          initialDelay: 2000,
        },
      };

      expect(calculateBackoffDelay(0, policy)).toBe(2000);
      expect(calculateBackoffDelay(1, policy)).toBe(2000);
      expect(calculateBackoffDelay(5, policy)).toBe(2000);
    });

    it("should calculate exponential backoff correctly", () => {
      const policy: RetryPolicy = {
        maxRetries: 5,
        backoff: {
          type: "exponential",
          initialDelay: 1000,
          multiplier: 2,
        },
      };

      expect(calculateBackoffDelay(0, policy)).toBe(1000); // 1000 * 2^0 = 1000
      expect(calculateBackoffDelay(1, policy)).toBe(2000); // 1000 * 2^1 = 2000
      expect(calculateBackoffDelay(2, policy)).toBe(4000); // 1000 * 2^2 = 4000
      expect(calculateBackoffDelay(3, policy)).toBe(8000); // 1000 * 2^3 = 8000
    });

    it("should respect max delay for exponential backoff", () => {
      const policy: RetryPolicy = {
        maxRetries: 10,
        backoff: {
          type: "exponential",
          initialDelay: 1000,
          maxDelay: 5000,
          multiplier: 2,
        },
      };

      expect(calculateBackoffDelay(0, policy)).toBe(1000);
      expect(calculateBackoffDelay(1, policy)).toBe(2000);
      expect(calculateBackoffDelay(2, policy)).toBe(4000);
      expect(calculateBackoffDelay(3, policy)).toBe(5000); // Capped at maxDelay
      expect(calculateBackoffDelay(10, policy)).toBe(5000); // Still capped
    });

    it("should use default values when not specified", () => {
      const policy: RetryPolicy = {
        maxRetries: 3,
        backoff: {
          type: "exponential",
        },
      };

      // Default: initialDelay=1000, multiplier=2, maxDelay=60000
      expect(calculateBackoffDelay(0, policy)).toBe(1000);
      expect(calculateBackoffDelay(1, policy)).toBe(2000);
    });
  });

  describe("shouldRetry", () => {
    it("should allow infinite retries when no policy configured", () => {
      const msg = {
        properties: {
          headers: {
            [RETRY_COUNT_HEADER]: 100,
          },
        },
      } as Message;

      const result = shouldRetry(msg, undefined);

      // When no policy is configured, we use legacy behavior (infinite retries)
      // and don't track retry count
      expect(result).toEqual({
        shouldRetry: true,
        delay: 0,
        currentRetryCount: 0,
      });
    });

    it("should allow retry when under max retries", () => {
      const policy: RetryPolicy = {
        maxRetries: 3,
        backoff: {
          type: "fixed",
          initialDelay: 1000,
        },
      };

      const msg = {
        properties: {
          headers: {
            [RETRY_COUNT_HEADER]: 1,
          },
        },
      } as Message;

      const result = shouldRetry(msg, policy);

      expect(result).toEqual({
        shouldRetry: true,
        delay: 1000,
        currentRetryCount: 1,
      });
    });

    it("should disallow retry when max retries reached", () => {
      const policy: RetryPolicy = {
        maxRetries: 3,
      };

      const msg = {
        properties: {
          headers: {
            [RETRY_COUNT_HEADER]: 3,
          },
        },
      } as Message;

      const result = shouldRetry(msg, policy);

      expect(result).toEqual({
        shouldRetry: false,
        delay: 0,
        currentRetryCount: 3,
      });
    });

    it("should disallow retry when max retries exceeded", () => {
      const policy: RetryPolicy = {
        maxRetries: 3,
      };

      const msg = {
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
        maxRetries: 5,
        backoff: {
          type: "exponential",
          initialDelay: 1000,
          multiplier: 2,
        },
      };

      const msg = {
        properties: {
          headers: {
            [RETRY_COUNT_HEADER]: 2,
          },
        },
      } as Message;

      const result = shouldRetry(msg, policy);

      expect(result).toEqual({
        shouldRetry: true,
        delay: 4000, // 1000 * 2^2 = 4000
        currentRetryCount: 2,
      });
    });

    it("should handle zero max retries (fail fast)", () => {
      const policy: RetryPolicy = {
        maxRetries: 0,
      };

      const msg = {
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
});
