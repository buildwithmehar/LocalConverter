import { gunzipSync } from 'fflate';
export async function loadPandocWasm(fetcher = fetch) {
  const response = await fetcher('/tool-runtime/pandoc.wasm.gz');
  if (!response.ok)
    throw new Error(
      'The browser document engine could not load. Refresh after the site finishes deploying.',
    );
  const encoded = new Uint8Array(await response.arrayBuffer());
  let bytes;
  try {
    bytes = encoded[0] === 0x1f && encoded[1] === 0x8b ? gunzipSync(encoded) : encoded;
  } catch {
    throw new Error('The browser document engine download is damaged. Refresh and try again.');
  }
  if (
    bytes.length < 8 ||
    bytes[0] !== 0 ||
    bytes[1] !== 0x61 ||
    bytes[2] !== 0x73 ||
    bytes[3] !== 0x6d
  )
    throw new Error('The browser document engine is not a valid WebAssembly file.');
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
