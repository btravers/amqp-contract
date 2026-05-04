import { TechnicalError } from "@amqp-contract/core";
import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { gunzip, inflate } from "node:zlib";
import { promisify } from "node:util";

const gunzipAsync = promisify(gunzip);
const inflateAsync = promisify(inflate);

/**
 * Supported content encodings for message decompression.
 */
const SUPPORTED_ENCODINGS = ["gzip", "deflate"] as const;

/**
 * Type for supported content encodings.
 */
type SupportedEncoding = (typeof SUPPORTED_ENCODINGS)[number];

/**
 * Type guard to check if a string is a supported encoding.
 */
function isSupportedEncoding(encoding: string): encoding is SupportedEncoding {
  return SUPPORTED_ENCODINGS.includes(encoding.toLowerCase() as SupportedEncoding);
}

/**
 * Decompress a buffer based on the content-encoding header.
 *
 * @param buffer - The buffer to decompress
 * @param contentEncoding - The content-encoding header value (e.g., 'gzip', 'deflate')
 * @returns A ResultAsync resolving to the decompressed buffer or a TechnicalError
 *
 * @internal
 */
export function decompressBuffer(
  buffer: Buffer,
  contentEncoding: string | undefined,
): ResultAsync<Buffer, TechnicalError> {
  if (!contentEncoding) {
    return okAsync(buffer);
  }

  const normalizedEncoding = contentEncoding.toLowerCase();

  if (!isSupportedEncoding(normalizedEncoding)) {
    return errAsync(
      new TechnicalError(
        `Unsupported content-encoding: "${contentEncoding}". ` +
          `Supported encodings are: ${SUPPORTED_ENCODINGS.join(", ")}. ` +
          `Please check your publisher configuration.`,
      ),
    );
  }

  switch (normalizedEncoding) {
    case "gzip":
      return ResultAsync.fromPromise(
        gunzipAsync(buffer),
        (error) => new TechnicalError("Failed to decompress gzip", error),
      );
    case "deflate":
      return ResultAsync.fromPromise(
        inflateAsync(buffer),
        (error) => new TechnicalError("Failed to decompress deflate", error),
      );
  }
}
