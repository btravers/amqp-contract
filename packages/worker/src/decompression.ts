/* eslint-disable eslint/sort-imports */
import { gunzip, inflate } from "node:zlib";
import { promisify } from "node:util";
import { Future, Result } from "@swan-io/boxed";
import { TechnicalError } from "@amqp-contract/core";

const gunzipAsync = promisify(gunzip);
const inflateAsync = promisify(inflate);

/**
 * Decompress a buffer based on the content-encoding header.
 *
 * @param buffer - The buffer to decompress
 * @param contentEncoding - The content-encoding header value (e.g., 'gzip', 'deflate')
 * @returns A Future with the decompressed buffer or a TechnicalError
 *
 * @internal
 */
export function decompressBuffer(
  buffer: Buffer,
  contentEncoding: string | undefined,
): Future<Result<Buffer, TechnicalError>> {
  if (!contentEncoding) {
    return Future.value(Result.Ok(buffer));
  }

  switch (contentEncoding.toLowerCase()) {
    case "gzip":
      return Future.fromPromise(gunzipAsync(buffer)).mapError(
        (error) => new TechnicalError("Failed to decompress gzip", error),
      );
    case "deflate":
      return Future.fromPromise(inflateAsync(buffer)).mapError(
        (error) => new TechnicalError("Failed to decompress deflate", error),
      );
    default:
      return Future.value(
        Result.Error(new TechnicalError(`Unsupported content-encoding: ${contentEncoding}`)),
      );
  }
}
