import { gunzip, inflate } from "node:zlib";
import { promisify } from "node:util";
import { compressBuffer, getContentEncoding } from "./compression.js";
import { describe, expect, it } from "vitest";

const gunzipAsync = promisify(gunzip);
const inflateAsync = promisify(inflate);

describe("Compression utilities", () => {
  describe("compressBuffer", () => {
    it("should compress data with gzip algorithm", async () => {
      const testData = Buffer.from(JSON.stringify({ message: "Hello, World!" }));
      const compressed = await compressBuffer(testData, "gzip");

      // Compressed data should be different from original
      expect(compressed).not.toEqual(testData);

      // Should be decompressible
      const decompressed = await gunzipAsync(compressed);
      expect(decompressed).toEqual(testData);
    });

    it("should compress data with deflate algorithm", async () => {
      const testData = Buffer.from(JSON.stringify({ message: "Hello, World!" }));
      const compressed = await compressBuffer(testData, "deflate");

      // Compressed data should be different from original
      expect(compressed).not.toEqual(testData);

      // Should be decompressible
      const decompressed = await inflateAsync(compressed);
      expect(decompressed).toEqual(testData);
    });

    it("should compress large data efficiently", async () => {
      // Create a large JSON object with repetitive data
      const largeData = Buffer.from(
        JSON.stringify({
          items: Array.from({ length: 1000 }, (_, i) => ({
            id: i,
            name: "Item " + i,
            description: "This is a test item with some repetitive text",
          })),
        }),
      );

      const compressed = await compressBuffer(largeData, "gzip");

      // Compressed data should be significantly smaller
      expect(compressed.length).toBeLessThan(largeData.length);
    });
  });

  describe("getContentEncoding", () => {
    it("should return 'gzip' for gzip algorithm", () => {
      expect(getContentEncoding("gzip")).toBe("gzip");
    });

    it("should return 'deflate' for deflate algorithm", () => {
      expect(getContentEncoding("deflate")).toBe("deflate");
    });
  });
});
