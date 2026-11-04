import { convert } from './conversion/index.js';
import { convertTool } from './conversion/everyday.js';
const controller = new AbortController();
process.once('message', async (args) => {
  try {
    const run = args.operation ? convertTool : convert;
    const result = await run({
      ...args,
      signal: controller.signal,
      onProgress: (p) => process.send?.({ type: 'progress', ...p }),
    });
    process.send?.({ type: 'result', result }, () => process.exit(0));
  } catch (error) {
    process.send?.({ type: 'error', error: String(error.message || error) }, () => process.exit(1));
  }
});
process.on('disconnect', () => {
  controller.abort();
  process.exit(1);
});
