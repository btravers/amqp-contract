import type { CompressionAlgorithm } from "@amqp-contract/contract";
import { deflate, gzip } from "node:zlib";
import { promisify } from "node:util";

const gzipAsync = promisify(gzip);
const deflateAsync = promisify(deflate);

/**
 * Compress a buffer using the specified compression algorithm.
 *
 * @param buffer - The buffer to compress
 * @param algorithm - The compression algorithm to use
 * @returns A promise that resolves to the compressed buffer
 * @throws Error if compression fails
 *
 * @internal
 */
export async function compressBuffer(
  buffer: Buffer,
  algorithm: CompressionAlgorithm,
): Promise<Buffer> {
  switch (algorithm) {
    case "gzip":
      return gzipAsync(buffer);
    case "deflate":
      return deflateAsync(buffer);
    default:
      // TypeScript exhaustiveness check
      const _exhaustive: never = algorithm;
      throw new Error(`Unsupported compression algorithm: ${String(_exhaustive)}`);
  }
}

/**
 * Get the content-encoding value for the specified compression algorithm.
 *
 * @param algorithm - The compression algorithm
 * @returns The content-encoding header value
 *
 * @internal
 */
export function getContentEncoding(algorithm: CompressionAlgorithm): string {
  return algorithm;
}
