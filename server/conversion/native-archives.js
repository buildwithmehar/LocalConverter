import fs from 'node:fs/promises';

import path from 'node:path';

import { spawn } from 'node:child_process';

import { zipSync } from 'fflate';

import { inspectZip } from './packaging.js';

import { checkAbort, fail, LIMITS, runProcess } from './common.js';

let detection;

export async function detectArchiver() {
  return (detection ??= (async () => {
    const candidates = [
      process.env.LOCAL_CONVERTER_7ZIP,
      process.platform === 'win32'
        ? path.join(process.env.ProgramFiles || 'C:\\Program Files', '7-Zip', '7z.exe')
        : null,
      '7z',
    ].filter(Boolean);

    for (const executable of candidates)
      try {
        const output = await runProcess(executable, ['i'], { timeout: 10000 });

        if (!/7-Zip/.test(output)) continue;

        return {
          available: true,
          executable,
          version: output
            .split(/\r?\n/)
            .find((line) => line.startsWith('7-Zip'))
            ?.trim(),
        };
      } catch {}

    return { available: false };
  })());
}

export function safeEntry(raw) {
  const name = raw.replaceAll('\\', '/');

  if (
    !name ||
    name.length > 240 ||
    /[\x00-\x1f<>:"|?*]/.test(name) ||
    name.startsWith('/') ||
    name
      .split('/')
      .some(
        (part) =>
          !part ||
          part === '.' ||
          part === '..' ||
          /[. ]$/.test(part) ||
          /^[-@]/.test(part) ||
          /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part),
      )
  )
    fail('Unsafe archive path.');

  return name;
}

// Extract to a bounded memory pipe, never directly onto the user's filesystem.

export function readMember(executable, args, size, signal) {
  return new Promise((resolve, reject) => {
    checkAbort(signal);

    const child = spawn(executable, args, {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const chunks = [];
    let bytes = 0,
      error = '',
      failure;

    const stop = () => child.kill('SIGKILL');

    const timer = setTimeout(() => {
      failure = new Error('Archive extraction timed out.');
      stop();
    }, 20000);

    signal?.addEventListener('abort', stop, { once: true });

    child.stdout.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > size || bytes > LIMITS.archiveBytes) {
        failure = new Error('Archive exceeds expansion limits.');
        stop();
      } else chunks.push(chunk);
    });

    child.stderr.on('data', (chunk) => {
      error = (error + chunk.toString()).slice(-1000);
    });

    child.on('error', (e) => {
      failure = e;
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', stop);

      if (signal?.aborted) return reject(new Error('Conversion cancelled.'));

      if (failure || code !== 0 || (size !== undefined && bytes !== size))
        return reject(failure || new Error(`Invalid archive member: ${error}`));

      resolve(Buffer.concat(chunks, bytes));
    });
  });
}

export async function readArchiveFiles({ inputPath, buffer, source, signal }) {
  const tool = await detectArchiver();
  if (!tool.available) fail('7-Zip is not installed.');

  let files;

  if (source === 'zip') files = inspectZip(buffer);
  else {
    if (
      source === '7z' &&
      !buffer.subarray(0, 6).equals(Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]))
    )
      fail('Invalid 7Z signature.');

    if (
      source === 'rar' &&
      !buffer.subarray(0, 6).equals(Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07]))
    )
      fail('Invalid RAR signature.');

    if (
      source === 'tar' &&
      (buffer.length < 512 || buffer.subarray(257, 262).toString() !== 'ustar')
    )
      fail('Invalid TAR signature.');

    const listing = await runProcess(
      tool.executable,
      ['l', `-t${source}`, '-slt', '-ba', '-sccUTF-8', '-p-', inputPath],
      { signal, timeout: 20000 },
    );

    const entries = listing
      .trim()
      .split(/\r?\n\s*\r?\n/)
      .map((block) =>
        Object.fromEntries(
          block
            .split(/\r?\n/)
            .map((line) => {
              const at = line.indexOf(' = ');
              return at < 0 ? [] : [line.slice(0, at), line.slice(at + 3)];
            })
            .filter((parts) => parts.length === 2),
        ),
      );

    if (!entries.length || entries.length > LIMITS.archiveEntries)
      fail('Archive entry limit exceeded or archive is empty.');

    files = Object.create(null);
    let expanded = 0;
    const paths = new Set();

    for (const entry of entries) {
      checkAbort(signal);

      if (
        entry.Encrypted === '+' ||
        entry['Symbolic Link'] ||
        entry['Hard Link'] ||
        entry['Alternate Stream'] === '+' ||
        /l|reparse/i.test(entry.Attributes || '') ||
        !['0', '5', ''].includes(entry['Type'] || '')
      )
        fail('Encrypted archives, links and special entries are unsupported.');

      const name = safeEntry((entry.Path || '').replace(/[/\\]$/, ''));

      if (paths.has(name.toLowerCase())) fail('Duplicate archive path.');
      paths.add(name.toLowerCase());

      if (entry.Folder === '+' || /^D/.test(entry.Attributes || '')) {
        files[`${name}/`] = Buffer.alloc(0);
        continue;
      }

      const size = Number(entry.Size);

      if (!Number.isSafeInteger(size) || size < 0 || (expanded += size) > LIMITS.archiveBytes)
        fail('Archive exceeds expansion limits.');

      const data = await readMember(
        tool.executable,
        ['e', `-t${source}`, '-so', '-spd', '-y', '-p-', '-bsp0', inputPath, '--', entry.Path],
        size,
        signal,
      );

      files[name] = data;
    }
  }

  return files;
}

export async function convertNativeArchive({
  inputPath,
  outputPath,
  buffer,
  source,
  target,
  options,
  signal,
  onProgress,
}) {
  const tool = await detectArchiver();
  if (!tool.available) fail('7-Zip is not installed.');

  const files = await readArchiveFiles({ inputPath, buffer, source, signal });

  const seen = new Set();
  let total = 0;

  for (const [raw, data] of Object.entries(files)) {
    const name = safeEntry(raw.replace(/\/$/, ''));
    const key = name.toLowerCase();

    if (seen.has(key)) fail('Duplicate archive path.');
    seen.add(key);
    total += data.length;

    if (total > LIMITS.archiveBytes || seen.size > LIMITS.archiveEntries)
      fail('Archive exceeds expansion limits.');
  }

  if (!Object.keys(files).some((name) => !name.endsWith('/')))
    fail('Archive contains no regular files.');

  onProgress?.({ stage: 'Repacking archive', progress: null });

  if (target === 'zip') return zipSync(files, { level: options.compression ?? 5 });

  const outputDir = path.dirname(outputPath);

  const stage = await fs.mkdtemp(path.join(outputDir, '.archive-'));

  if (!path.resolve(stage).startsWith(path.resolve(outputDir) + path.sep))
    fail('Invalid archive staging directory.');

  try {
    for (const [raw, data] of Object.entries(files)) {
      const name = raw.replace(/\/$/, '');
      const destination = path.resolve(stage, ...name.split('/'));

      if (!destination.startsWith(path.resolve(stage) + path.sep)) fail('Unsafe archive path.');

      if (raw.endsWith('/')) await fs.mkdir(destination, { recursive: true });
      else {
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.writeFile(destination, data, { flag: 'wx' });
      }
    }

    await runProcess(
      tool.executable,
      [
        'a',
        `-t${target}`,
        '-y',
        '-bd',
        '-bso0',
        '-bsp0',
        ...(target === '7z' ? [`-mx=${options.compression ?? 5}`] : []),
        outputPath,
        '.',
      ],
      { signal, cwd: stage, timeout: 60000 },
    );

    await runProcess(tool.executable, ['t', `-t${target}`, '-p-', '-bd', outputPath], {
      signal,
      timeout: 20000,
    });
  } finally {
    await fs.rm(stage, { recursive: true, force: true });
  }
}
