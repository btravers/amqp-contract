import { Future, Result } from "@swan-io/boxed";
import { deflate, gzip } from "node:zlib";
import type { CompressionAlgorithm } from "@amqp-contract/contract";
import { TechnicalError } from "@amqp-contract/core";
import { match } from "ts-pattern";
import { promisify } from "node:util";

const gzipAsync = promisify(gzip);
const deflateAsync = promisify(deflate);

/**
 * Compress a buffer using the specified compression algorithm.
 *
 * @param buffer - The buffer to compress
 * @param algorithm - The compression algorithm to use
 * @returns A Future with the compressed buffer or a TechnicalError
 *
 * @internal
 */
export function compressBuffer(
  buffer: Buffer,
  algorithm: CompressionAlgorithm,
): Future<Result<Buffer, TechnicalError>> {
  return match(algorithm)
    .with("gzip", () =>
      Future.fromPromise(gzipAsync(buffer)).mapError(
        (error) => new TechnicalError("Failed to compress with gzip", error),
      ),
    )
    .with("deflate", () =>
      Future.fromPromise(deflateAsync(buffer)).mapError(
        (error) => new TechnicalError("Failed to compress with deflate", error),
      ),
    )
    .exhaustive();
}
