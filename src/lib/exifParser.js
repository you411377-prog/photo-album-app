/**
 * Lightweight EXIF parser for JPEG files.
 * Extracts date/time and GPS coordinates from the first 256KB of a JPEG.
 */

const readAscii = (view, pos, len) => {
  let s = '';
  for (let i = 0; i < len; i += 1) {
    const c = view.getUint8(pos + i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
};

const parseExifFromJpegArrayBuffer = (buffer) => {
  const view = new DataView(buffer);
  if (view.byteLength < 4) return null;
  if (view.getUint16(0, false) !== 0xffd8) return null;

  let offset = 2;

  const getUint16 = (pos, le) => view.getUint16(pos, le);
  const getUint32 = (pos, le) => view.getUint32(pos, le);

  while (offset + 4 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    offset += 2;
    if (marker === 0xd9 || marker === 0xda) break;
    const size = view.getUint16(offset, false);
    const segmentStart = offset + 2;
    if (marker === 0xe1) {
      if (segmentStart + 10 <= view.byteLength && readAscii(view, segmentStart, 6) === 'Exif') {
        const tiffStart = segmentStart + 6;
        const endian = readAscii(view, tiffStart, 2);
        const le = endian === 'II';
        const magic = getUint16(tiffStart + 2, le);
        if (magic !== 42) return null;
        const ifd0Offset = getUint32(tiffStart + 4, le);

        const readRational = (pos) => {
          const num = getUint32(pos, le);
          const den = getUint32(pos + 4, le);
          if (!den) return 0;
          return num / den;
        };

        const readIfd = (ifdOffset) => {
          const abs = tiffStart + ifdOffset;
          if (abs + 2 > view.byteLength) return { entries: [], next: 0 };
          const count = getUint16(abs, le);
          const entries = [];
          let p = abs + 2;
          for (let i = 0; i < count; i += 1) {
            if (p + 12 > view.byteLength) break;
            const tag = getUint16(p, le);
            const type = getUint16(p + 2, le);
            const num = getUint32(p + 4, le);
            const valueOffset = getUint32(p + 8, le);
            entries.push({ tag, type, num, valueOffset, entryPos: p });
            p += 12;
          }
          const next = p + 4 <= view.byteLength ? getUint32(p, le) : 0;
          return { entries, next };
        };

        const readTagValue = (entry) => {
          const { type, num, valueOffset, entryPos } = entry;
          const typeSize = type === 2 ? 1 : type === 3 ? 2 : type === 4 ? 4 : type === 5 ? 8 : 0;
          const byteCount = num * typeSize;
          const valuePos = byteCount <= 4 ? entryPos + 8 : tiffStart + valueOffset;
          if (valuePos + byteCount > view.byteLength) return null;

          if (type === 2) return readAscii(view, valuePos, byteCount);
          if (type === 3) return getUint16(valuePos, le);
          if (type === 4) return getUint32(valuePos, le);
          if (type === 5) {
            if (num === 1) return readRational(valuePos);
            const arr = [];
            for (let i = 0; i < num; i += 1) arr.push(readRational(valuePos + i * 8));
            return arr;
          }
          return null;
        };

        const ifd0 = readIfd(ifd0Offset);
        const exifPtr = ifd0.entries.find(e => e.tag === 0x8769);
        const gpsPtr = ifd0.entries.find(e => e.tag === 0x8825);

        let dateTime = null;
        if (exifPtr) {
          const exifIfd = readIfd(exifPtr.valueOffset);
          const dt = exifIfd.entries.find(e => e.tag === 0x9003) || exifIfd.entries.find(e => e.tag === 0x0132);
          if (dt) {
            const v = readTagValue(dt);
            if (typeof v === 'string' && v) dateTime = v;
          }
        } else {
          const dt = ifd0.entries.find(e => e.tag === 0x0132);
          if (dt) {
            const v = readTagValue(dt);
            if (typeof v === 'string' && v) dateTime = v;
          }
        }

        let gps = null;
        if (gpsPtr) {
          const gpsIfd = readIfd(gpsPtr.valueOffset);
          const latRef = gpsIfd.entries.find(e => e.tag === 0x0001);
          const lat = gpsIfd.entries.find(e => e.tag === 0x0002);
          const lonRef = gpsIfd.entries.find(e => e.tag === 0x0003);
          const lon = gpsIfd.entries.find(e => e.tag === 0x0004);

          const latRefV = latRef ? readTagValue(latRef) : '';
          const lonRefV = lonRef ? readTagValue(lonRef) : '';
          const latV = lat ? readTagValue(lat) : null;
          const lonV = lon ? readTagValue(lon) : null;

          if (Array.isArray(latV) && latV.length >= 3 && Array.isArray(lonV) && lonV.length >= 3) {
            const toDeg = (arr) => arr[0] + arr[1] / 60 + arr[2] / 3600;
            let la = toDeg(latV);
            let lo = toDeg(lonV);
            if (String(latRefV).toUpperCase() === 'S') la *= -1;
            if (String(lonRefV).toUpperCase() === 'W') lo *= -1;
            gps = { lat: la, lon: lo };
          }
        }

        return { dateTime, gps };
      }
    }
    offset += size;
  }
  return null;
};

/**
 * Parse EXIF from an image File object.
 * Returns { date, time, gps } or null.
 */
export const parseExifFromImageFile = async (file) => {
  const head = await file.slice(0, 256 * 1024).arrayBuffer();
  const parsed = parseExifFromJpegArrayBuffer(head);
  if (!parsed) return null;
  const { dateTime, gps } = parsed;
  let date = '';
  let time = '';
  if (dateTime && typeof dateTime === 'string') {
    const parts = dateTime.trim().split(' ');
    if (parts.length >= 2) {
      date = parts[0].replace(/:/g, '-');
      time = parts[1].slice(0, 5);
    }
  }
  return { date, time, gps };
};

export default parseExifFromJpegArrayBuffer;
