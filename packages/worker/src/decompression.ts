import { brotliDecompress, gunzip, inflate } from "node:zlib";
import { promisify } from "node:util";

const gunzipAsync = promisify(gunzip);
const inflateAsync = promisify(inflate);
const brotliDecompressAsync = promisify(brotliDecompress);

/**
 * Supported compression encodings.
 * These values correspond to the HTTP Content-Encoding header values.
 */
const SUPPORTED_ENCODINGS = ["gzip", "deflate", "br"] as const;

/**
 * Decompress a buffer based on the content-encoding header.
 *
 * Supported encodings:
 * - `gzip`: GNU zip compression
 * - `deflate`: DEFLATE compression
 * - `br`: Brotli compression
 *
 * @param buffer - The buffer to decompress
 * @param contentEncoding - The content-encoding header value (e.g., 'gzip', 'deflate', 'br')
 * @returns A promise that resolves to the decompressed buffer
 * @throws Error if decompression fails or if the encoding is unsupported
 *
 * @internal
 */
export async function decompressBuffer(
  buffer: Buffer,
  contentEncoding: string | undefined,
): Promise<Buffer> {
  // No compression - return original buffer
  if (!contentEncoding) {
    return buffer;
  }

  // Empty buffer - nothing to decompress
  if (buffer.length === 0) {
    return buffer;
  }

  const encoding = contentEncoding.toLowerCase();

  switch (encoding) {
    case "gzip":
      return gunzipAsync(buffer);
    case "deflate":
      return inflateAsync(buffer);
    case "br":
      return brotliDecompressAsync(buffer);
    default:
      throw new Error(
        `Unsupported content-encoding: "${contentEncoding}". ` +
          `Supported encodings: ${SUPPORTED_ENCODINGS.join(", ")}`,
      );
  }
}
