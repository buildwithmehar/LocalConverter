import { createWriteStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { pipeline, Transform } from 'node:stream';

// Share one byte budget across all parts, before oversized batches fill staging.
export function toolUploadStorage(directory, maxBytes) {
  return {
    _handleFile(req, file, callback) {
      const filename = randomUUID(),
        filePath = join(directory, filename);
      let size = 0;
      const budget = new Transform({
        transform(chunk, _encoding, done) {
          size += chunk.length;
          req.toolUploadBytes = (req.toolUploadBytes || 0) + chunk.length;
          if (req.toolUploadBytes > maxBytes)
            return done(
              Object.assign(
                new Error(
                  `Selected files together must fit within ${Math.round(maxBytes / 1024 / 1024)} MB.`,
                ),
                { status: 413 },
              ),
            );
          done(null, chunk);
        },
      });
      pipeline(file.stream, budget, createWriteStream(filePath, { flags: 'wx' }), async (error) => {
        if (error) {
          await rm(filePath, { force: true }).catch(() => {});
          callback(error);
        } else callback(null, { destination: directory, filename, path: filePath, size });
      });
    },
    _removeFile(_req, file, callback) {
      rm(file.path, { force: true }).then(() => callback(null), callback);
    },
  };
}
