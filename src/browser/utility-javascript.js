// Terser's ESM minifier without its Node command-line entrypoint.
import '../../node_modules/terser/lib/transform.js';
import '../../node_modules/terser/lib/mozilla-ast.js';
export { minify } from '../../node_modules/terser/lib/minify.js';
