import { randomUUID } from 'node:crypto';

import { fork, spawn } from 'node:child_process';

import { mkdir, mkdtemp, rename, rm, stat, readdir, open, readFile } from 'node:fs/promises';

import { join, resolve, sep } from 'node:path';

import { fileURLToPath } from 'node:url';

const terminal = new Set(['completed', 'failed', 'cancelled']);

export function safeName(name) {
  return (
    String(name || 'file')
      .split(/[\\/]/)
      .pop()
      .normalize('NFKC')
      .replace(/[\x00-\x1f<>:"|?*]/g, '_')
      .replace(/^\.+/, '')
      .slice(0, 160) || 'file'
  );
}

export class JobStore {
  constructor({
    dataRoot,
    maxBytes = 100 * 1024 * 1024,
    maxJobs = 20,
    jobTimeoutMs = 180000,
    ttlMs = 1800000,
  }) {
    Object.assign(this, { dataRoot, maxBytes, maxJobs, jobTimeoutMs, ttlMs });

    this.jobs = new Map();
    this.reservations = new Map();
    this.queue = [];
    this.active = null;
    this.closed = false;
  }

  async init() {
    await mkdir(this.dataRoot, { recursive: true });

    this.lockPath = join(this.dataRoot, 'instance.lock');

    let wroteLock = false;

    try {
      this.lock = await open(this.lockPath, 'wx');
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;

      const recoveryPath = join(this.dataRoot, 'recovery.lock');
      let recovery;

      try {
        recovery = await open(recoveryPath, 'wx');
      } catch (e) {
        if (e.code === 'EEXIST')
          throw new Error(
            'The local data directory is already recovering. Retry startup. If recovery was interrupted, stop all instances before removing .local-data/recovery.lock.',
          );
        throw e;
      }

      try {
        await recovery.writeFile(JSON.stringify({ pid: process.pid }));

        let previous;
        try {
          previous = JSON.parse(await readFile(this.lockPath, 'utf8'));
        } catch {}

        let alive = true;

        if (Number.isInteger(previous?.pid))
          try {
            process.kill(previous.pid, 0);
          } catch (e) {
            if (e.code === 'ESRCH') alive = false;
          }

        if (alive)
          throw new Error('This local data directory is already running in another app instance.');

        await rm(this.lockPath, { force: true });
        this.lock = await open(this.lockPath, 'wx');

        await this.lock.writeFile(JSON.stringify({ pid: process.pid, createdAt: Date.now() }));

        wroteLock = true;
      } finally {
        await recovery.close();
        await rm(recoveryPath, { force: true });
      }
    }

    if (!wroteLock)
      await this.lock.writeFile(JSON.stringify({ pid: process.pid, createdAt: Date.now() }));

    this.jobsDir = join(this.dataRoot, 'jobs');
    this.stagingDir = join(this.dataRoot, 'staging');

    await mkdir(this.jobsDir, { recursive: true });
    await mkdir(this.stagingDir, { recursive: true });

    // This directory is dedicated to this app. A fresh process has no valid previous-session handles.

    for (const dir of [this.jobsDir, this.stagingDir])
      for (const name of await readdir(dir))
        await rm(join(dir, name), { recursive: true, force: true });

    this.sweeper = setInterval(() => this.expire().catch(() => {}), Math.min(this.ttlMs, 60000));
    this.sweeper.unref();
  }

  public(job) {
    const {
      id,
      name,
      size,
      source,
      target,
      status,
      stage,
      progress,
      error,
      outputName,
      outputSize,
      options,
      createdAt,
      operation,
      inputCount,
      details,
    } = job;

    return {
      id,
      name,
      size,
      source,
      target,
      status,
      stage,
      progress,
      error,
      outputName,
      outputSize,
      options: Object.fromEntries(
        Object.entries(options || {}).filter(([key]) => !/password|secret/i.test(key)),
      ),
      createdAt,
      ...(operation ? { operation, inputCount, details } : {}),
    };
  }

  owned(id, session) {
    const j = this.jobs.get(id);
    return j?.session === session ? j : null;
  }

  list(session) {
    return [...this.jobs.values()].filter((j) => j.session === session).map((j) => this.public(j));
  }

  async add({ session, file, files, source, target, options, operation, label }) {
    const inputFiles = files || [file],
      weight = inputFiles.length;

    const reserved = this.reservations.get(session) || 0;

    if (this.closed)
      throw Object.assign(new Error('The local server is stopping.'), { status: 503 });

    if (
      this.list(session).reduce((count, job) => count + (job.inputCount || 1), 0) +
        reserved +
        weight >
      this.maxJobs
    )
      throw Object.assign(new Error(`Maximum ${this.maxJobs} files. Clear completed jobs first.`), {
        status: 429,
      });

    this.reservations.set(session, reserved + weight);
    let dir;

    try {
      dir = await mkdtemp(join(this.jobsDir, 'job-'));
      const id = randomUUID();

      const inputs = [];

      for (const [index, input] of inputFiles.entries()) {
        const inputPath = join(
          dir,
          operation ? `input-${index}.${input.source}` : 'input.' + source,
        );
        await rename(input.path, inputPath);

        inputs.push({
          path: inputPath,
          source: input.source || source,
          name: safeName(input.originalname),
          size: input.size,
        });
      }

      const inputPath = inputs[0].path;

      if (this.closed) throw new Error('The local server is stopping.');

      const job = {
        id,
        session,
        dir,
        inputPath,
        ...(operation ? { operation, inputs, inputCount: weight } : {}),
        name:
          operation && weight > 1
            ? `${label || operation} (${weight} files)`
            : safeName(inputFiles[0].originalname),
        size: inputFiles.reduce((sum, input) => sum + input.size, 0),
        source,
        target,
        options,
        status: 'queued',
        stage: 'Waiting to convert',
        progress: null,
        error: null,
        outputName: null,
        outputSize: null,
        createdAt: Date.now(),
        touchedAt: Date.now(),
      };

      this.jobs.set(id, job);
      this.queue.push(id);
      queueMicrotask(() => this.pump());
      return job;
    } catch (error) {
      if (dir) await rm(dir, { recursive: true, force: true });
      throw error;
    } finally {
      this.reservations.set(
        session,
        Math.max(0, (this.reservations.get(session) || weight) - weight),
      );
    }
  }

  pump() {
    if (this.active || this.closed) return;

    let job;

    while (this.queue.length) {
      const candidate = this.jobs.get(this.queue.shift());
      if (candidate?.status === 'queued') {
        job = candidate;
        break;
      }
    }

    if (!job) return;

    this.active = job.id;
    job.status = 'processing';
    job.stage = 'Starting local engine';
    job.progress = null;

    const child = fork(fileURLToPath(new URL('./worker.js', import.meta.url)), [], {
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
      execArgv: ['--max-old-space-size=512'],
      windowsHide: true,
      env: { ...process.env, NODE_OPTIONS: '' },
    });

    job.child = child;
    job.done = new Promise((r) => {
      job.resolveDone = r;
    });

    let settled = false,
      diagnostic = '';

    child.stderr.on('data', (d) => {
      diagnostic = (diagnostic + d.toString()).slice(-2000);
    });

    const finish = async (message) => {
      if (settled) return;
      settled = true;
      clearTimeout(job.timer);

      try {
        if (job.status === 'cancelled') return;

        if (message.type === 'result') {
          const output = resolve(message.result.path),
            base = resolve(job.dir) + sep;

          if (
            !output.startsWith(base) ||
            (job.inputs || [{ path: job.inputPath }]).some(
              (input) => output === resolve(input.path),
            )
          )
            throw new Error('Engine returned an invalid output path.');

          const info = await stat(output);

          if (job.status === 'cancelled') return;

          if (!info.isFile() || !info.size || info.size > 200 * 1024 * 1024)
            throw new Error('Output is empty or exceeds the 200 MB output limit.');

          job.outputPath = output;
          job.outputName = safeName(
            (job.operation ? job.operation : job.name.replace(/\.[^.]+$/, '')) +
              '.' +
              (message.result.filename?.match(/\.(tar\.(?:gz|bz2|xz)|[^.]+)$/)?.[1] || job.target),
          );

          if (job.operation) job.details = message.result.details;

          job.outputMime = message.result.mime || 'application/octet-stream';
          job.outputSize = info.size;

          job.status = 'completed';
          job.stage = 'Finished';
          job.progress = 100;
        } else {
          job.status = 'failed';
          job.stage = 'Conversion failed';
          job.error = String(
            message.error || 'Local conversion process stopped unexpectedly.',
          ).slice(0, 600);
          job.progress = null;
        }
      } catch (error) {
        job.status = 'failed';
        job.stage = 'Output validation failed';
        job.error = error.message;
        job.progress = null;
      } finally {
        if (job.status !== 'completed') await this.cleanOutputs(job);

        job.touchedAt = Date.now();
        job.child = null;
        this.active = null;
        job.resolveDone?.();
        queueMicrotask(() => this.pump());
      }
    };

    child.on('message', (message) => {
      if (message.type === 'progress' && job.status === 'processing') {
        job.stage = String(message.stage || 'Converting locally').slice(0, 120);
        job.progress = Number.isFinite(message.progress)
          ? Math.min(99, Math.max(0, message.progress))
          : null;
      }

      if (message.type === 'result' || message.type === 'error') void finish(message);
    });

    child.on('error', (e) => void finish({ type: 'error', error: e.message }));

    child.on('exit', (code) => {
      if (!settled)
        void finish({
          type: 'error',
          error:
            job.error ||
            (diagnostic.includes('heap out of memory')
              ? 'Insufficient memory. Try a smaller file.'
              : `Local conversion process exited (${code ?? 'terminated'}).`),
        });
    });

    job.timer = setTimeout(async () => {
      job.error = 'Conversion timed out. Try a smaller file or simpler settings.';
      await this.stopProcess(job);
      void finish({ type: 'error', error: job.error });
    }, this.jobTimeoutMs);

    child.send({
      inputPath: job.inputPath,
      outputDir: job.dir,
      source: job.source,
      target: job.target,
      options: job.options,
      ...(job.operation ? { operation: job.operation, inputs: job.inputs } : {}),
    });
  }

  async cleanOutputs(job) {
    const keep = new Set(
      (job.inputs || [{ path: job.inputPath }]).map((input) => resolve(input.path)),
    );

    for (const name of await readdir(job.dir).catch(() => []))
      if (!keep.has(resolve(join(job.dir, name))))
        await rm(join(job.dir, name), { recursive: true, force: true }).catch(() => {});

    job.outputPath = null;
    job.outputName = null;
    job.outputSize = null;

    if (job.operation) job.details = null;
  }

  async stopProcess(job) {
    const child = job.child;
    if (!child?.pid) return;

    if (process.platform === 'win32')
      await new Promise((r) => {
        const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
          windowsHide: true,
          shell: false,
          stdio: 'ignore',
        });
        killer.on('error', () => {
          child.kill();
          r();
        });
        killer.on('exit', r);
      });
    else {
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 1500).unref();
    }
  }

  async cancel(job) {
    if (job.cancelling) return job.cancelling;

    if (terminal.has(job.status)) return job;

    job.cancelling = (async () => {
      job.status = 'cancelled';
      job.stage = 'Cancelled';
      job.progress = null;
      clearTimeout(job.timer);

      this.queue = this.queue.filter((id) => id !== job.id);

      if (job.child) {
        await this.stopProcess(job);
        await job.done;
      } else await this.cleanOutputs(job);

      job.touchedAt = Date.now();
      return job;
    })().finally(() => {
      job.cancelling = null;
    });

    return job.cancelling;
  }

  async remove(job) {
    if (job.removal) return job.removal;

    job.removing = true;

    return (job.removal = (async () => {
      await this.cancel(job);
      await rm(job.dir, { recursive: true, force: true });
      this.jobs.delete(job.id);
    })());
  }

  async retry(job) {
    if (job.child || job.cancelling || job.removing || job.retrying)
      throw Object.assign(new Error('Wait for cancellation or file removal to finish.'), {
        status: 409,
      });

    if (!['failed', 'cancelled'].includes(job.status))
      throw Object.assign(new Error('Only failed or cancelled files can be retried.'), {
        status: 409,
      });

    job.retrying = true;

    try {
      for (const input of job.inputs || [{ path: job.inputPath }]) await stat(input.path);
      await this.cleanOutputs(job);

      if (job.removing || !this.jobs.has(job.id))
        throw Object.assign(new Error('This file is being removed.'), { status: 409 });

      Object.assign(job, {
        status: 'queued',
        stage: 'Waiting to retry',
        progress: null,
        error: null,
        touchedAt: Date.now(),
      });
      this.queue.push(job.id);
      queueMicrotask(() => this.pump());
      return job;
    } finally {
      job.retrying = false;
    }
  }

  async clear(session) {
    for (const job of [...this.jobs.values()]) if (job.session === session) await this.remove(job);
  }

  async expire() {
    for (const job of [...this.jobs.values()])
      if (terminal.has(job.status) && Date.now() - job.touchedAt > this.ttlMs)
        await this.remove(job);
  }

  async close() {
    this.closed = true;
    clearInterval(this.sweeper);
    for (const job of [...this.jobs.values()]) await this.remove(job);
    await this.lock?.close();
    if (this.lock) await rm(this.lockPath, { force: true });
    this.lock = null;
  }
}
