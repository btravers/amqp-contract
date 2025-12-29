import { gunzip, inflate } from "node:zlib";
import { promisify } from "node:util";

const gunzipAsync = promisify(gunzip);
const inflateAsync = promisify(inflate);

/**
 * Decompress a buffer based on the content-encoding header.
 *
 * @param buffer - The buffer to decompress
 * @param contentEncoding - The content-encoding header value (e.g., 'gzip', 'deflate')
 * @returns A promise that resolves to the decompressed buffer
 * @throws Error if decompression fails or the encoding is unsupported
 *
 * @internal
 */
export async function decompressBuffer(
  buffer: Buffer,
  contentEncoding: string | undefined,
): Promise<Buffer> {
  if (!contentEncoding) {
    return buffer; // No compression
  }

  switch (contentEncoding.toLowerCase()) {
    case "gzip":
      return gunzipAsync(buffer);
    case "deflate":
      return inflateAsync(buffer);
    default:
      // If we encounter an unknown encoding, return the buffer as-is
      // This maintains backward compatibility
      return buffer;
  }
}
