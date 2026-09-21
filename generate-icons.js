"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ROOT = __dirname;
const SOURCE_SIZE = 1024;
const ICON_SIZES = [16, 48, 128];
const BACKGROUND = [18, 46, 111];

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function blend(canvas, width, x, y, color, alpha = 1) {
  if (x < 0 || y < 0 || x >= width || y >= width || alpha <= 0) return;
  const index = (y * width + x) * 4;
  const inverse = 1 - alpha;
  canvas[index] = clamp(color[0] * alpha + canvas[index] * inverse);
  canvas[index + 1] = clamp(color[1] * alpha + canvas[index + 1] * inverse);
  canvas[index + 2] = clamp(color[2] * alpha + canvas[index + 2] * inverse);
  canvas[index + 3] = 255;
}

function roundedRectContains(x, y, left, top, right, bottom, radius) {
  if (x < left || x > right || y < top || y > bottom) return false;
  const nearX = x < left + radius ? left + radius : x > right - radius ? right - radius : x;
  const nearY = y < top + radius ? top + radius : y > bottom - radius ? bottom - radius : y;
  return (x - nearX) ** 2 + (y - nearY) ** 2 <= radius ** 2;
}

function fillRoundedRect(canvas, width, bounds, radius, color, opacity = 1) {
  const [left, top, right, bottom] = bounds;
  for (let y = Math.floor(top - 1); y <= Math.ceil(bottom + 1); y += 1) {
    for (let x = Math.floor(left - 1); x <= Math.ceil(right + 1); x += 1) {
      if (roundedRectContains(x, y, left, top, right, bottom, radius)) blend(canvas, width, x, y, color, opacity);
    }
  }
}

function fillPolygon(canvas, width, points, color, opacity = 1) {
  const minX = Math.floor(Math.min(...points.map(([x]) => x)));
  const maxX = Math.ceil(Math.max(...points.map(([x]) => x)));
  const minY = Math.floor(Math.min(...points.map(([, y]) => y)));
  const maxY = Math.ceil(Math.max(...points.map(([, y]) => y)));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i];
        const [xj, yj] = points[j];
        const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
        if (intersects) inside = !inside;
      }
      if (inside) blend(canvas, width, x, y, color, opacity);
    }
  }
}

function drawLine(canvas, width, from, to, strokeWidth, color, opacity = 1) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const radius = strokeWidth / 2;
  const minX = Math.floor(Math.min(x1, x2) - radius - 1);
  const maxX = Math.ceil(Math.max(x1, x2) + radius + 1);
  const minY = Math.floor(Math.min(y1, y2) - radius - 1);
  const maxY = Math.ceil(Math.max(y1, y2) + radius + 1);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy || 1;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const projection = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared));
      const nearestX = x1 + projection * dx;
      const nearestY = y1 + projection * dy;
      if ((x - nearestX) ** 2 + (y - nearestY) ** 2 <= radius ** 2) blend(canvas, width, x, y, color, opacity);
    }
  }
}

function drawArc(canvas, width, center, radius, start, end, strokeWidth, color, opacity = 1) {
  const steps = Math.ceil(Math.abs(end - start) * radius / 3);
  let previous = null;
  for (let i = 0; i <= steps; i += 1) {
    const angle = start + ((end - start) * i) / steps;
    const point = [center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius];
    if (previous) drawLine(canvas, width, previous, point, strokeWidth, color, opacity);
    previous = point;
  }
}

function drawIcon() {
  const width = SOURCE_SIZE;
  const canvas = new Uint8Array(width * width * 4);
  for (let y = 0; y < width; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const t = (x + y) / (width * 2);
      const color = [47 - 29 * t, 128 - 82 * t, 255 - 137 * t];
      if (roundedRectContains(x, y, 32, 32, 992, 992, 256)) blend(canvas, width, x, y, color);
      else blend(canvas, width, x, y, BACKGROUND);
    }
  }

  const white = [255, 255, 255];
  const cyan = [103, 232, 249];
  const blue = [37, 99, 235];

  // Four corner brackets make the selection action legible without a heavy box.
  drawLine(canvas, width, [192, 280], [192, 192], 48, white);
  drawLine(canvas, width, [192, 192], [280, 192], 48, white);
  drawLine(canvas, width, [736, 192], [824, 192], 48, white);
  drawLine(canvas, width, [824, 192], [824, 280], 48, white);
  drawLine(canvas, width, [192, 736], [192, 824], 48, white);
  drawLine(canvas, width, [192, 824], [280, 824], 48, white);
  drawLine(canvas, width, [736, 824], [824, 824], 48, white);
  drawLine(canvas, width, [824, 824], [824, 736], 48, white);

  // A single content page sits inside the selection frame.
  fillRoundedRect(canvas, width, [248, 200, 664, 752], 64, [5, 20, 58], 0.28);
  fillRoundedRect(canvas, width, [248, 200, 664, 752], 64, [230, 240, 255]);
  fillPolygon(canvas, width, [[488, 200], [664, 376], [552, 376], [488, 312]], [184, 214, 255]);
  fillPolygon(canvas, width, [[488, 200], [664, 376], [552, 376], [488, 312]], white);
  drawLine(canvas, width, [328, 400], [504, 400], 40, blue);
  drawLine(canvas, width, [328, 488], [560, 488], 40, blue);
  drawLine(canvas, width, [328, 576], [488, 576], 40, blue);

  // The export arrow exits the selection to the right, with no overlap.
  drawLine(canvas, width, [680, 512], [912, 512], 56, cyan);
  drawLine(canvas, width, [912, 512], [832, 432], 56, cyan);
  drawLine(canvas, width, [912, 512], [832, 592], 56, cyan);
  return canvas;
}

function resize(source, sourceSize, targetSize) {
  const output = new Uint8Array(targetSize * targetSize * 4);
  const scale = sourceSize / targetSize;
  for (let y = 0; y < targetSize; y += 1) {
    for (let x = 0; x < targetSize; x += 1) {
      const left = Math.floor(x * scale);
      const right = Math.min(sourceSize, Math.ceil((x + 1) * scale));
      const top = Math.floor(y * scale);
      const bottom = Math.min(sourceSize, Math.ceil((y + 1) * scale));
      const totals = [0, 0, 0, 0];
      let count = 0;
      for (let sy = top; sy < bottom; sy += 1) {
        for (let sx = left; sx < right; sx += 1) {
          const index = (sy * sourceSize + sx) * 4;
          totals[0] += source[index];
          totals[1] += source[index + 1];
          totals[2] += source[index + 2];
          totals[3] += source[index + 3];
          count += 1;
        }
      }
      const index = (y * targetSize + x) * 4;
      output[index] = Math.round(totals[0] / count);
      output[index + 1] = Math.round(totals[1] / count);
      output[index + 2] = Math.round(totals[2] / count);
      output[index + 3] = Math.round(totals[3] / count);
    }
  }
  return output;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function encodePng(pixels, size) {
  const scanlines = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    scanlines[y * (size * 4 + 1)] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + y * size * 4, size * 4).copy(scanlines, y * (size * 4 + 1) + 1);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(scanlines, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const source = drawIcon();
for (const size of ICON_SIZES) {
  const target = resize(source, SOURCE_SIZE, size);
  fs.writeFileSync(path.join(ROOT, "icons", `icon${size}.png`), encodePng(target, size));
}
console.log(`Generated ${ICON_SIZES.length} icons from icons/logo.svg geometry.`);
