/* eslint-disable sort-imports */
import type { CompressionAlgorithm } from "@amqp-contract/contract";
import { deflate, gzip } from "node:zlib";
import { promisify } from "node:util";
import { match } from "ts-pattern";

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
  return match(algorithm)
    .with("gzip", () => gzipAsync(buffer))
    .with("deflate", () => deflateAsync(buffer))
    .exhaustive();
}
