// Генерация валидного PNG прямо в памяти — для сценариев, где пайщик или
// оператор прикладывает фотографию (заявление на возврат, осмотр при приёме).
//
// Почему не «минимальный» 1×1 и не заглушка: строгий декодер браузера
// отвергает PNG с неверными CRC чанков (naturalWidth = 0, broken-иконка) при
// внешне успешной загрузке — на скриншоте документации это выглядит как
// сломанный интерфейс. Здесь CRC считаются честно, картинка декодируется и в
// операторском диалоге показывается осмысленной миниатюрой.

import zlib from 'node:zlib';

/** CRC32 с полиномом PNG — таблица считается один раз на модуль. */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** Валидный RGB-PNG заданного размера, залитый одним цветом. */
export function makeSolidPng(width, height, [r, g, b]) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // глубина цвета
  ihdr[9] = 2; // тип цвета RGB
  // 10, 11, 12 — сжатие / фильтр / чересстрочность, все нулевые
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) {
    row[1 + x * 3] = r;
    row[1 + x * 3 + 1] = g;
    row[1 + x * 3 + 2] = b;
  }
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}
