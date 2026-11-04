const multiply = (a, b) => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];
const point = (m, x, y) => ({
  x: m[0] * x + m[2] * y + m[4],
  y: m[1] * x + m[3] * y + m[5],
});
const merge = (values) => {
  const out = [];
  for (const value of values.sort((a, b) => a - b)) {
    if (!out.length || Math.abs(value - out.at(-1)) > 2) out.push(value);
    else out[out.length - 1] = (out.at(-1) + value) / 2;
  }
  return out;
};
// PDF.js 6 exposes painted paths as DrawOPS streams (move/line/curve/close).
export function lineTable(operators, items, OPS) {
  let transform = [1, 0, 0, 1, 0, 0];
  const stack = [],
    vertical = [],
    horizontal = [];
  const line = (a, b) => {
    if (!a || !b) return;
    if (Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) > 12)
      vertical.push({
        x: (a.x + b.x) / 2,
        y0: Math.min(a.y, b.y),
        y1: Math.max(a.y, b.y),
      });
    if (Math.abs(a.y - b.y) < 1 && Math.abs(a.x - b.x) > 12)
      horizontal.push({
        y: (a.y + b.y) / 2,
        x0: Math.min(a.x, b.x),
        x1: Math.max(a.x, b.x),
      });
  };
  for (let i = 0; i < operators.fnArray.length; i++) {
    const op = operators.fnArray[i],
      args = operators.argsArray[i];
    if (op === OPS.save) stack.push(transform.slice());
    else if (op === OPS.restore) transform = stack.pop() || [1, 0, 0, 1, 0, 0];
    else if (op === OPS.transform) transform = multiply(transform, args);
    else if (op === OPS.constructPath) {
      const path = args?.[1]?.[0];
      if (!path || !ArrayBuffer.isView(path)) continue;
      let current, start;
      for (let p = 0; p < path.length;) {
        const command = path[p++];
        if (command === 0) {
          current = point(transform, path[p++], path[p++]);
          start = current;
        } else if (command === 1) {
          const next = point(transform, path[p++], path[p++]);
          line(current, next);
          current = next;
        } else if (command === 2) {
          p += 4;
          current = point(transform, path[p++], path[p++]);
        } else if (command === 3) {
          p += 2;
          current = point(transform, path[p++], path[p++]);
        } else if (command === 4) {
          line(current, start);
          current = start;
        } else break;
      }
    }
  }
  const xs = merge(vertical.map((v) => v.x)),
    ys = merge(horizontal.map((h) => h.y)).reverse();
  if (xs.length < 3 || ys.length < 3 || xs.length > 100 || ys.length > 1000) return [];
  const rows = Array.from({ length: ys.length - 1 }, () =>
    Array.from({ length: xs.length - 1 }, () => []),
  );
  for (const item of items) {
    if (!item.str?.trim()) continue;
    const x = item.transform[4] + (item.width || 0) / 2,
      y = item.transform[5] + (item.height || 10) / 2,
      col = xs.findIndex((v, i) => i < xs.length - 1 && x >= v - 1 && x <= xs[i + 1] + 1),
      row = ys.findIndex((v, i) => i < ys.length - 1 && y <= v + 1 && y >= ys[i + 1] - 1);
    if (row >= 0 && col >= 0)
      rows[row][col].push({
        x: item.transform[4],
        y: item.transform[5],
        text: item.str,
      });
  }
  return rows
    .map((row) =>
      row.map((cell) =>
        cell
          .sort((a, b) => (Math.abs(b.y - a.y) > 3 ? b.y - a.y : a.x - b.x))
          .map((x) => x.text)
          .join(' '),
      ),
    )
    .filter((row) => row.some(Boolean));
}
