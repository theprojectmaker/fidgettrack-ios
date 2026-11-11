// Generates the app icon and the notification glyph from a drawn fidget-spinner mark.
// No image libraries: raw RGBA -> PNG via zlib. Run: node scripts/make-icon.cjs
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const OUT = path.join(__dirname, '..', 'assets');
fs.mkdirSync(OUT, { recursive: true });

function crc32(buf) {
  let c, t = crc32.t;
  if (!t) { t = crc32.t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = t[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function png(N, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(N * (N * 4 + 1));
  for (let y = 0; y < N; y++) { raw[y * (N * 4 + 1)] = 0; Buffer.from(rgba.buffer).copy(raw, y * (N * 4 + 1) + 1, y * N * 4, y * N * 4 + N * 4); }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// opts: fullBleed (gradient background) or transparent (white glyph only)
function renderAt(M, opts) {
  const top = [0x63, 0x66, 0xf1], bot = [0x8b, 0x5c, 0xf6], white = [255, 255, 255];
  const px = new Uint8ClampedArray(M * M * 4);
  const c = M / 2;
  const hubR = M * 0.085, lobeR = M * 0.135, dist = M * 0.19, bearR = M * 0.034, lobeHoleR = M * 0.052;
  const lobes = [];
  for (let k = 0; k < 3; k++) { const a = (-90 + k * 120) * Math.PI / 180; lobes.push([c + Math.cos(a) * dist, c + Math.sin(a) * dist]); }
  for (let y = 0; y < M; y++) {
    const bg = lerp(top, bot, y / (M - 1));
    for (let x = 0; x < M; x++) {
      let col, a;
      const dc = Math.hypot(x - c, y - c);
      let inHub = dc <= hubR, inLobe = false, lobeD = 1e9;
      for (const [lx, ly] of lobes) { const d = Math.hypot(x - lx, y - ly); if (d < lobeD) lobeD = d; if (d <= lobeR) inLobe = true; }
      const inMark = inHub || inLobe;
      const inHole = dc <= bearR || lobeD <= lobeHoleR;
      if (opts.transparent) {
        if (inMark && !inHole) { col = white; a = 255; } else { col = [255, 255, 255]; a = 0; }
      } else {
        col = bg; a = 255;
        if (inMark) { col = white; if (inHole) col = bg; }
      }
      const i = (y * M + x) * 4; px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2]; px[i + 3] = a;
    }
  }
  return px;
}
function downscale(src, M, N) {
  const dst = Buffer.alloc(N * N * 4); const s = M / N;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) { const i = ((y * s + dy) * M + (x * s + dx)) * 4; r += src[i]; g += src[i + 1]; b += src[i + 2]; a += src[i + 3]; n++; }
    const j = (y * N + x) * 4; dst[j] = r / n; dst[j + 1] = g / n; dst[j + 2] = b / n; dst[j + 3] = a / n;
  }
  return dst;
}
const make = (N, opts) => png(N, downscale(renderAt(N * 2, opts), N * 2, N));

fs.writeFileSync(path.join(OUT, 'icon.png'), make(1024, { transparent: false }));
fs.writeFileSync(path.join(OUT, 'notification-icon.png'), make(96, { transparent: true }));
console.log('Wrote assets/icon.png (1024) and assets/notification-icon.png (96)');
