// Generate the PWA bell icons (zero dependencies) into public/icons/.
// Run: npm run gen:icons. The output PNGs are committed, so this only needs
// rerunning if you change the icon design.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(ICONS_DIR, { recursive: true });

for (const size of [192, 512]) {
  fs.writeFileSync(path.join(ICONS_DIR, `icon-${size}.png`), makeBellPNG(size));
  console.log(`wrote public/icons/icon-${size}.png`);
}

function makeBellPNG(size) {
  const bg = [99, 102, 241];   // indigo-500
  const fg = [255, 255, 255];  // white bell
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const cx = size / 2;
  const top = size * 0.26, rim = size * 0.62;
  const hwTop = size * 0.05, hwRim = size * 0.23;

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // no per-row filter
    for (let x = 0; x < size; x++) {
      const c = isBell(x, y) ? fg : bg;
      const i = rowStart + 1 + x * 4;
      raw[i] = c[0]; raw[i + 1] = c[1]; raw[i + 2] = c[2]; raw[i + 3] = 255;
    }
  }

  function isBell(x, y) {
    const dxAbs = Math.abs(x - cx);
    if (y >= top && y <= rim) {
      const t = (y - top) / (rim - top);
      const hw = hwTop + (hwRim - hwTop) * Math.sqrt(t);
      if (dxAbs <= hw) return true;
    }
    if (y > rim && y <= rim + size * 0.05 && dxAbs <= size * 0.27) return true;        // rim bar
    if (dist(x, y, cx, top) <= size * 0.045) return true;                              // top knob
    if (dist(x, y, cx, rim + size * 0.1) <= size * 0.05) return true;                  // clapper
    return false;
  }
  function dist(x, y, ax, ay) { return Math.hypot(x - ax, y - ay); }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function crc32(buf) {
  if (!crc32.table) {
    const t = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    crc32.table = t;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = crc32.table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
