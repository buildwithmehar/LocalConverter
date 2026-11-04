import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';

export const LIMITS = {
  inputBytes: 100 * 1024 * 1024,
  outputBytes: 200 * 1024 * 1024,
  pixels: 40_000_000,
  pages: 100,
  cells: 100_000,
  archiveBytes: 100 * 1024 * 1024,
  archiveEntries: 1000,
};
export function checkAbort(signal) {
  signal?.throwIfAborted();
}
export function fail(message) {
  throw new Error(message);
}
export async function readInput(inputPath) {
  const stat = await fs.stat(inputPath);
  if (!stat.isFile() || !stat.size || stat.size > LIMITS.inputBytes)
    fail('Input must be a nonempty file of at most 100 MB.');
  return fs.readFile(inputPath);
}
export function textInput(buffer) {
  if (buffer.includes(0)) fail('Binary content is not valid text.');
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^\uFEFF/, '');
  } catch {
    fail('Text must use UTF-8 encoding.');
  }
}
export function safeSvg(buffer) {
  const text = textInput(buffer);
  if (
    !/<svg\b/i.test(text) ||
    /<!DOCTYPE|<!ENTITY|<script\b|<foreignObject\b|<\?xml-stylesheet|\\|\bon\w+\s*=|\b(?:href|src)\s*=\s*["']\s*(?!#)|url\s*\(\s*(?!#)|@import|@font-face/i.test(
      text,
    )
  )
    fail('SVG must be self-contained, without scripts, CSS escapes or external resources.');
  return text;
}
export function runProcess(command, args, { signal, timeout = 180000, onLine, cwd } = {}) {
  return new Promise((resolve, reject) => {
    checkAbort(signal);
    const child = spawn(command, args, {
      cwd,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '',
      stderr = '',
      settled = false;
    const stop = () => child.kill('SIGKILL');
    const timer = setTimeout(stop, timeout);
    signal?.addEventListener('abort', stop, { once: true });
    const finish = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', stop);
      if (signal?.aborted) return reject(new Error('Conversion cancelled.'));
      err ? reject(err) : resolve(stdout);
    };
    child.stdout.on('data', (d) => {
      stdout += d.toString();
      if (stdout.length > 2_000_000) {
        stop();
        finish(new Error('Process output limit exceeded.'));
      }
      onLine?.(d.toString());
    });
    child.stderr.on('data', (d) => {
      stderr = (stderr + d.toString()).slice(-10000);
    });
    child.on('error', finish);
    child.on('close', (code, sig) =>
      finish(
        code === 0
          ? null
          : new Error(
              sig
                ? 'Conversion timed out or was cancelled.'
                : `Conversion failed: ${stderr.slice(-700)}`,
            ),
      ),
    );
  });
}
export function validateOptions(pair, values) {
  if (!values || typeof values !== 'object' || Array.isArray(values))
    fail('Options must be an object.');
  const allowed = new Map(pair.options.map((o) => [o.key, o]));
  for (const [key, v] of Object.entries(values)) {
    const def = allowed.get(key);
    if (!def) fail(`Unsupported option: ${key}`);
    if (
      def.type === 'number' &&
      (!Number.isFinite(v) ||
        !Number.isInteger(v) ||
        (def.min !== undefined && v < def.min) ||
        (def.max !== undefined && v > def.max))
    )
      fail(`Invalid option: ${key}`);
    if (def.choices && !def.choices.includes(v)) fail(`Invalid option: ${key}`);
  }
  return Object.fromEntries(pair.options.map((o) => [o.key, values[o.key] ?? o.default]));
}
