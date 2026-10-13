/**
 * Writes the print resolution (dpi) into a PNG, so Photoshop, Word, Canva and
 * print software open it at the real physical size (54 mm wide), not "72 dpi".
 * A PNG stores it in an optional "pHYs" chunk, placed right after the header.
 */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function setPngDpi(png, dpi) {
  const IHDR_END = 8 + 25; // 8-byte signature + (4 length + 4 type + 13 data + 4 crc)
  if (png.length < IHDR_END || png.toString("ascii", 12, 16) !== "IHDR") return png;
  const perMetre = Math.round(dpi / 0.0254);
  const data = Buffer.alloc(9);
  data.writeUInt32BE(perMetre, 0);
  data.writeUInt32BE(perMetre, 4);
  data[8] = 1; // unit: metre
  const type = Buffer.from("pHYs", "ascii");
  const chunk = Buffer.alloc(21);
  chunk.writeUInt32BE(9, 0);
  type.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([type, data])), 17);
  return Buffer.concat([png.subarray(0, IHDR_END), chunk, png.subarray(IHDR_END)]);
}