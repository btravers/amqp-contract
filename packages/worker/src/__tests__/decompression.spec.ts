import { deflate, gzip } from "node:zlib";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

import { decompressBuffer } from "../decompression.js";

const gzipAsync = promisify(gzip);
const deflateAsync = promisify(deflate);

describe("Decompression utilities", () => {
  describe("decompressBuffer", () => {
    it("should return buffer as-is when no content-encoding is provided", async () => {
      const testData = Buffer.from(JSON.stringify({ message: "Hello, World!" }));
      const result = await decompressBuffer(testData, undefined);

      expect(result).toEqual(testData);
    });

    it("should decompress gzip-compressed data", async () => {
      const testData = Buffer.from(JSON.stringify({ message: "Hello, World!" }));
      const compressed = await gzipAsync(testData);

      const decompressed = await decompressBuffer(compressed, "gzip");

      expect(decompressed).toEqual(testData);
    });

    it("should decompress deflate-compressed data", async () => {
      const testData = Buffer.from(JSON.stringify({ message: "Hello, World!" }));
      const compressed = await deflateAsync(testData);

      const decompressed = await decompressBuffer(compressed, "deflate");

      expect(decompressed).toEqual(testData);
    });

    it("should handle case-insensitive content-encoding", async () => {
      const testData = Buffer.from(JSON.stringify({ message: "Hello, World!" }));
      const compressed = await gzipAsync(testData);

      const decompressed = await decompressBuffer(compressed, "GZIP");

      expect(decompressed).toEqual(testData);
    });

    it("should throw error for unknown content-encoding", async () => {
      const testData = Buffer.from(JSON.stringify({ message: "Hello, World!" }));

      await expect(decompressBuffer(testData, "unknown-encoding")).rejects.toThrow(
        "Unsupported content-encoding: unknown-encoding",
      );
    });

    it("should decompress large data correctly", async () => {
      const largeData = Buffer.from(
        JSON.stringify({
          items: Array.from({ length: 1000 }, (_, i) => ({
            id: i,
            name: "Item " + i,
            description: "This is a test item with some repetitive text",
          })),
        }),
      );

      const compressed = await gzipAsync(largeData);
      const decompressed = await decompressBuffer(compressed, "gzip");

      expect(decompressed).toEqual(largeData);
    });
  });
});
