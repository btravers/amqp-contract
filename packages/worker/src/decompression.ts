import { brotliDecompress, gunzip, inflate } from "node:zlib";
import { match } from "ts-pattern";
import { promisify } from "node:util";
import { z } from "zod";

const gunzipAsync = promisify(gunzip);
const inflateAsync = promisify(inflate);
const brotliDecompressAsync = promisify(brotliDecompress);

/**
 * Supported compression encodings.
 * These values correspond to the HTTP Content-Encoding header values.
 */
const SupportedEncodingSchema = z.enum(["gzip", "deflate", "br"]);

type SupportedEncoding = z.infer<typeof SupportedEncodingSchema>;

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

  const normalizedEncoding = contentEncoding.toLowerCase();
  const parseResult = SupportedEncodingSchema.safeParse(normalizedEncoding);

  if (!parseResult.success) {
    throw new Error(
      `Unsupported content-encoding: "${contentEncoding}". ` +
        `Supported encodings: ${SupportedEncodingSchema.options.join(", ")}`,
    );
  }

  const encoding: SupportedEncoding = parseResult.data;

  return match(encoding)
    .with("gzip", () => gunzipAsync(buffer))
    .with("deflate", () => inflateAsync(buffer))
    .with("br", () => brotliDecompressAsync(buffer))
    .exhaustive();
}
