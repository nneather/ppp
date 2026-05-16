/**
 * Writes solid Zinc-950 (#09090b) PNGs into static/ for PWA manifest + apple-touch-icon.
 * Run: node scripts/gen-pwa-placeholder-icons.mjs
 */
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const staticDir = path.join(__dirname, '..', 'static');

/** @param {Buffer} buf */
function crc32(buf) {
	let crc = 0xffffffff;
	for (let i = 0; i < buf.length; i++) {
		crc ^= buf[i];
		for (let j = 0; j < 8; j++) {
			crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
		}
	}
	return (crc ^ 0xffffffff) >>> 0;
}

/** @param {string} type @param {Buffer} data */
function pngChunk(type, data) {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length, 0);
	const typeBuf = Buffer.from(type, 'ascii');
	const crcData = Buffer.concat([typeBuf, data]);
	const crcBuf = Buffer.alloc(4);
	crcBuf.writeUInt32BE(crc32(crcData), 0);
	return Buffer.concat([len, typeBuf, data, crcBuf]);
}

/** @param {number} width @param {number} height @param {[number, number, number]} rgb */
function solidPng(width, height, [r, g, b]) {
	const rowLen = 1 + width * 3;
	const row = Buffer.alloc(rowLen);
	row[0] = 0;
	for (let x = 0; x < width; x++) {
		const o = 1 + x * 3;
		row[o] = r;
		row[o + 1] = g;
		row[o + 2] = b;
	}
	const img = Buffer.alloc(height * rowLen);
	for (let y = 0; y < height; y++) {
		row.copy(img, y * rowLen);
	}
	const compressed = zlib.deflateSync(img, { level: 9 });
	const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8;
	ihdr[9] = 2;
	ihdr[10] = 0;
	ihdr[11] = 0;
	ihdr[12] = 0;
	return Buffer.concat([
		signature,
		pngChunk('IHDR', ihdr),
		pngChunk('IDAT', compressed),
		pngChunk('IEND', Buffer.alloc(0))
	]);
}

const zinc950 = [0x09, 0x09, 0x0b];

const files = [
	['icon-192.png', 192, 192],
	['icon-512.png', 512, 512],
	['apple-touch-icon.png', 180, 180]
];

for (const [name, w, h] of files) {
	const out = path.join(staticDir, name);
	fs.writeFileSync(out, solidPng(w, h, zinc950));
	console.log('wrote', out);
}
