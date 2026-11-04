import { canvas, checkAbort, result } from './image-common.js';
import { decodeImage, encodeCanvas } from './image-engine.js';
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function pageCorners(data, width, height) {
  const bright = new Uint8Array(width * height),
    seen = new Uint8Array(width * height);
  for (let p = 0; p < bright.length; p++)
    bright[p] = Math.min(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]) > 180 ? 1 : 0;
  let best;
  for (let start = 0; start < bright.length; start++) {
    if (!bright[start] || seen[start]) continue;
    const queue = [start];
    seen[start] = 1;
    let tl = { score: Infinity },
      tr = { score: -Infinity },
      br = { score: -Infinity },
      bl = { score: Infinity };
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i],
        x = p % width,
        y = Math.floor(p / width),
        sum = x + y,
        diff = x - y;
      if (sum < tl.score) tl = { x, y, score: sum };
      if (sum > br.score) br = { x, y, score: sum };
      if (diff > tr.score) tr = { x, y, score: diff };
      if (diff < bl.score) bl = { x, y, score: diff };
      for (const next of [
        x ? p - 1 : -1,
        x < width - 1 ? p + 1 : -1,
        y ? p - width : -1,
        y < height - 1 ? p + width : -1,
      ])
        if (next >= 0 && bright[next] && !seen[next]) {
          seen[next] = 1;
          queue.push(next);
        }
    }
    if (!best || queue.length > best.count)
      best = { corners: [tl, tr, br, bl], count: queue.length };
  }
  if (!best || best.count < width * height * 0.2) return null;
  const q = best.corners,
    area =
      Math.abs(q.reduce((sum, p, i) => sum + p.x * q[(i + 1) % 4].y - p.y * q[(i + 1) % 4].x, 0)) /
      2;
  if (
    area < width * height * 0.2 ||
    best.count / area < 0.65 ||
    q.some((p, i) => distance(p, q[(i + 1) % 4]) < 20)
  )
    return null;
  if (
    q.every(
      (p, i) =>
        distance(
          p,
          [
            { x: 0, y: 0 },
            { x: width - 1, y: 0 },
            { x: width - 1, y: height - 1 },
            { x: 0, y: height - 1 },
          ][i],
        ) < 3,
    )
  )
    return null;
  return q;
}
function homography(width, height, q) {
  const corners = [
      [0, 0],
      [width - 1, 0],
      [width - 1, height - 1],
      [0, height - 1],
    ],
    a = [];
  for (let i = 0; i < 4; i++) {
    const [u, v] = corners[i],
      { x, y } = q[i];
    a.push([u, v, 1, 0, 0, 0, -x * u, -x * v, x]);
    a.push([0, 0, 0, u, v, 1, -y * u, -y * v, y]);
  }
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let row = col + 1; row < 8; row++)
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const divisor = a[col][col];
    if (Math.abs(divisor) < 1e-10) throw new Error('Detected document corners are degenerate.');
    for (let j = col; j < 9; j++) a[col][j] /= divisor;
    for (let row = 0; row < 8; row++)
      if (row !== col) {
        const factor = a[row][col];
        for (let j = col; j < 9; j++) a[row][j] -= factor * a[col][j];
      }
  }
  return a.map((row) => row[8]);
}
function warp(source, q) {
  const width = Math.max(1, Math.round(Math.max(distance(q[0], q[1]), distance(q[2], q[3])))),
    height = Math.max(1, Math.round(Math.max(distance(q[0], q[3]), distance(q[1], q[2])))),
    { canvas: c, ctx } = canvas(width, height),
    src = source.getContext('2d').getImageData(0, 0, source.width, source.height),
    out = ctx.createImageData(width, height),
    m = homography(width, height, q);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const den = m[6] * x + m[7] * y + 1,
        sx = (m[0] * x + m[1] * y + m[2]) / den,
        sy = (m[3] * x + m[4] * y + m[5]) / den,
        x0 = Math.max(0, Math.min(source.width - 1, Math.floor(sx))),
        y0 = Math.max(0, Math.min(source.height - 1, Math.floor(sy))),
        x1 = Math.min(source.width - 1, x0 + 1),
        y1 = Math.min(source.height - 1, y0 + 1),
        fx = Math.max(0, Math.min(1, sx - x0)),
        fy = Math.max(0, Math.min(1, sy - y0)),
        at = (y * width + x) * 4;
      for (let k = 0; k < 3; k++) {
        const p00 = src.data[(y0 * source.width + x0) * 4 + k],
          p10 = src.data[(y0 * source.width + x1) * 4 + k],
          p01 = src.data[(y1 * source.width + x0) * 4 + k],
          p11 = src.data[(y1 * source.width + x1) * 4 + k];
        out.data[at + k] =
          p00 * (1 - fx) * (1 - fy) + p10 * fx * (1 - fy) + p01 * (1 - fx) * fy + p11 * fx * fy;
      }
      out.data[at + 3] = 255;
    }
  ctx.putImageData(out, 0, 0);
  return c;
}
function skewAngle(c) {
  const ratio = Math.min(1, 800 / Math.max(c.width, c.height)),
    { canvas: small, ctx } = canvas(
      Math.max(1, Math.round(c.width * ratio)),
      Math.max(1, Math.round(c.height * ratio)),
    );
  ctx.drawImage(c, 0, 0, small.width, small.height);
  const data = ctx.getImageData(0, 0, small.width, small.height).data,
    points = [];
  for (let y = 0; y < small.height; y += 2)
    for (let x = 0; x < small.width; x += 2) {
      const p = (y * small.width + x) * 4;
      if (data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114 < 110) points.push([x, y]);
    }
  if (points.length < 100) return 0;
  let best = 0,
    bestScore = 0,
    zeroScore = 0;
  for (let half = -16; half <= 16; half++) {
    const radians = (half * 0.5 * Math.PI) / 180,
      sin = Math.sin(radians),
      cos = Math.cos(radians),
      hist = new Uint32Array(small.width * 2 + small.height * 2);
    for (const [x, y] of points) {
      const row = Math.round(y * cos - x * sin) + small.width;
      hist[row]++;
    }
    let score = 0;
    for (const count of hist) score += count * count;
    if (half === 0) zeroScore = score;
    if (score > bestScore) {
      bestScore = score;
      best = half * 0.5;
    }
  }
  return bestScore > zeroScore * 1.12 ? best : 0;
}
export async function cleanScan(input, o, signal, onProgress) {
  const image = await decodeImage(input.file, input.source);
  try {
    if (image.width * image.height > 16_000_000)
      throw new Error('Scan cleanup accepts at most 16 million pixels.');
    let { canvas: c, ctx } = canvas(image.width, image.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(image, 0, 0);
    let perspectiveDetected = false,
      angle = 0;
    checkAbort(signal);
    if (o.perspective) {
      onProgress?.({ stage: 'Detecting document borders', progress: 12 });
      const ratio = Math.min(1, 800 / Math.max(c.width, c.height)),
        { canvas: small, ctx: sc } = canvas(
          Math.max(1, Math.round(c.width * ratio)),
          Math.max(1, Math.round(c.height * ratio)),
        );
      sc.drawImage(c, 0, 0, small.width, small.height);
      const q = pageCorners(
        sc.getImageData(0, 0, small.width, small.height).data,
        small.width,
        small.height,
      );
      if (q) {
        c = warp(
          c,
          q.map((p) => ({ x: p.x / ratio, y: p.y / ratio })),
        );
        ctx = c.getContext('2d');
        perspectiveDetected = true;
      }
    }
    checkAbort(signal);
    if (o.deskew) {
      onProgress?.({ stage: 'Measuring text-line skew', progress: 35 });
      angle = skewAngle(c);
      if (angle) {
        const { canvas: rotated, ctx: rc } = canvas(c.width, c.height);
        rc.fillStyle = 'white';
        rc.fillRect(0, 0, c.width, c.height);
        rc.translate(c.width / 2, c.height / 2);
        rc.rotate((-angle * Math.PI) / 180);
        rc.drawImage(c, -c.width / 2, -c.height / 2);
        c = rotated;
        ctx = rc;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
    }
    const imageData = ctx.getImageData(0, 0, c.width, c.height),
      data = imageData.data,
      width = c.width,
      height = c.height,
      gray = new Float32Array(width * height),
      integral = new Float64Array((width + 1) * (height + 1));
    for (let y = 0; y < height; y++) {
      let row = 0;
      for (let x = 0; x < width; x++) {
        const p = y * width + x,
          i = p * 4;
        gray[p] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        row += gray[p];
        integral[(y + 1) * (width + 1) + x + 1] = integral[y * (width + 1) + x + 1] + row;
      }
    }
    const mean = (x, y, r) => {
      const x0 = Math.max(0, x - r),
        y0 = Math.max(0, y - r),
        x1 = Math.min(width, x + r + 1),
        y1 = Math.min(height, y + r + 1),
        stride = width + 1;
      return (
        (integral[y1 * stride + x1] -
          integral[y1 * stride + x0] -
          integral[y0 * stride + x1] +
          integral[y0 * stride + x0]) /
        ((x1 - x0) * (y1 - y0))
      );
    };
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const p = y * width + x,
          i = p * 4,
          bg = Math.max(1, mean(x, y, 25)),
          corrected = Math.min(255, (gray[p] * 255) / bg);
        if (o.mode === 'binary') {
          const value = gray[p] > mean(x, y, 15) - 12 ? 255 : 0;
          data[i] = data[i + 1] = data[i + 2] = value;
        } else if (o.mode === 'gray') data[i] = data[i + 1] = data[i + 2] = corrected;
        else for (let k = 0; k < 3; k++) data[i + k] = Math.min(255, (data[i + k] * 255) / bg);
        data[i + 3] = 255;
      }
    ctx.putImageData(imageData, 0, 0);
    checkAbort(signal);
    return result(await encodeCanvas(c, 'png'), 'cleaned-scan.png', {
      width,
      height,
      perspectiveCorrected: perspectiveDetected,
      deskewDegrees: angle,
      cleanup: o.mode,
      detection: 'Bright page border and text-line projection; review automatic corrections',
    });
  } finally {
    image.close?.();
  }
}
