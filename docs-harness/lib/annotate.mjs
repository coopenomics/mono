// Наносит аннотации (стрелки, прямоугольники, зум-вставки, подписи) поверх PNG.
// Рендерит HTML с img + SVG через Playwright, снимает отрисованный результат.
//
// Usage (CLI):
//   node lib/annotate.mjs <input.png> <spec.json> <output.png>
//
// Usage (API):
//   import { annotate } from './lib/annotate.mjs';
//   await annotate({ input, output, annotations });
//
// Форма spec.json:
//   {
//     "annotations": [
//       { "type": "arrow",  "from": [300, 650], "to": [200, 715], "color": "#e74c3c", "width": 4 },
//       { "type": "rect",   "at":   [10, 690, 230, 50], "color": "#e74c3c", "width": 3 },
//       { "type": "label",  "at":   [310, 640], "text": "ФИО пайщика", "color": "#e74c3c" },
//       { "type": "zoom",   "source": [10, 690, 230, 170], "at": [900, 600, 460, 340],
//                           "border": "#e74c3c", "borderWidth": 3, "arrow": true }
//     ]
//   }

import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';

// Вырезает source=[x,y,w,h] из input и масштабирует пропорционально в scale раз.
// Использует sharp с lanczos3 (лучший качеством ресэмплер). Выход — отдельный PNG.
//   await cropScaled({ input, output, source: [5,687,240,205], scale: 3 });
// → PNG 720×615, аспект исходника сохранён.
export async function cropScaled({ input, output, source, scale = 2 }) {
  const [sx, sy, sw, sh] = source.map(Math.round);
  const tw = Math.round(sw * scale);
  const th = Math.round(sh * scale);
  await sharp(path.resolve(input))
    .extract({ left: sx, top: sy, width: sw, height: sh })
    .resize(tw, th, { kernel: 'lanczos3', fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toFile(path.resolve(output));
}

export async function annotate({ input, output, annotations }) {
  const absInput = path.resolve(input);
  const img = await fs.readFile(absInput);
  const { width, height } = await probePng(img);

  const dataUri = `data:image/png;base64,${img.toString('base64')}`;
  const svg = renderSvg(annotations, width, height);

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    html, body { margin: 0; padding: 0; background: transparent; }
    .wrap { position: relative; width: ${width}px; height: ${height}px; }
    .wrap img { display: block; width: ${width}px; height: ${height}px; }
    .wrap svg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
  </style></head><body><div class="wrap">
    <img src="${dataUri}" width="${width}" height="${height}"/>
    ${svg}
  </div></body></html>`;

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    // Подождём пока img догрузится (data-uri мгновенно, но для надёжности)
    await page.waitForFunction(() => {
      const img = document.querySelector('img');
      return img && img.complete && img.naturalWidth > 0;
    });
    const el = await page.$('.wrap');
    await el.screenshot({ path: output, omitBackground: false });
  } finally {
    await browser.close();
  }
}

function renderSvg(annotations, w, h) {
  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">`);

  // Дефолтный маркер стрелки
  parts.push(`<defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6"
            orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"/>
    </marker>
  </defs>`);

  // Labels всегда последними — чтобы текст не перекрывался zoom'ами/прямоугольниками.
  const body = annotations.filter(a => a.type !== 'label');
  const labels = annotations.filter(a => a.type === 'label');
  for (const a of [...body, ...labels]) {
    switch (a.type) {
      case 'arrow': parts.push(renderArrow(a)); break;
      case 'rect':  parts.push(renderRect(a)); break;
      case 'circle': parts.push(renderCircle(a)); break;
      case 'label': parts.push(renderLabel(a)); break;
      case 'zoom':  parts.push(renderZoom(a, w, h)); break;
      default: throw new Error(`Unknown annotation type: ${a.type}`);
    }
  }

  parts.push(`</svg>`);
  return parts.join('');
}

function renderArrow({ from, to, color = '#e74c3c', width = 4 }) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
    stroke="${color}" stroke-width="${width}" stroke-linecap="round"
    marker-end="url(#arrow)"/>`;
}

function renderRect({ at, color = '#e74c3c', width = 3, radius = 6, fill = 'none', fillOpacity = 0.15 }) {
  const [x, y, w, h] = at;
  const fillAttr = fill === 'none' ? 'none' : fill;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" ry="${radius}"
    fill="${fillAttr}" fill-opacity="${fill === 'none' ? 0 : fillOpacity}"
    stroke="${color}" stroke-width="${width}"/>`;
}

function renderCircle({ at, color = '#e74c3c', width = 3 }) {
  const [cx, cy, r] = at;
  return `<circle cx="${cx}" cy="${cy}" r="${r}"
    fill="none" stroke="${color}" stroke-width="${width}"/>`;
}

// Лейбл через foreignObject: HTML-div сам растянется по ширине текста,
// никаких оценочных коэффициентов (кириллица, широкие буквы «ш/щ/ж/м» раньше ломали SVG <text>).
// anchor: 'bl' (bottom-left, по умолчанию) — (x,y) это нижний-левый угол подложки;
//         'tl' — верхний-левый; 'tc' — верхняя середина; 'bc' — нижняя середина.
function renderLabel({ at, text, color = '#e74c3c', fontSize = 22, background = '#ffffff', padding = 6, anchor = 'bl' }) {
  const [x, y] = at;
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  // Позиционируем через CSS translate (0-100%) — размер подложки появится после layout.
  const translate = {
    tl: 'translate(0, 0)',
    bl: 'translate(0, -100%)',
    tc: 'translate(-50%, 0)',
    bc: 'translate(-50%, -100%)',
    tr: 'translate(-100%, 0)',
    br: 'translate(-100%, -100%)',
  }[anchor] ?? 'translate(0, -100%)';
  return `<foreignObject x="0" y="0" width="100%" height="100%" style="overflow: visible;">
    <div xmlns="http://www.w3.org/1999/xhtml"
      style="position: absolute; left: ${x}px; top: ${y}px; transform: ${translate};
             display: inline-block; padding: ${padding}px ${padding + 2}px;
             background: ${background}; border: 2px solid ${color}; border-radius: 4px;
             color: ${color}; font-family: system-ui, -apple-system, 'Segoe UI', Arial, sans-serif;
             font-size: ${fontSize}px; font-weight: 600; line-height: 1; white-space: nowrap;">${esc}</div>
  </foreignObject>`;
}

// Зум-вставка: берём область source=[sx,sy,sw,sh] из исходного изображения
// и отрисовываем её увеличенной в at. Форматы at:
//   [x, y, scale]   — origin + коэффициент (w,h вычислятся = sw*scale, sh*scale)
//   [x, y, w, h]    — явный прямоугольник. Аспект source сохраняется: фактическая
//                     вставка вписывается в w×h (letterbox-стиль), не растягивая пиксели.
// Если arrow:true — рисуем пунктирную линию между центрами source и at.
function renderZoom({ source, at, border = '#e74c3c', borderWidth = 3, arrow = false, imageHref }) {
  const [sx, sy, sw, sh] = source;
  let ax, ay, aw, ah;
  if (at.length === 3) {
    const [x, y, scale] = at;
    ax = x; ay = y; aw = sw * scale; ah = sh * scale;
  } else {
    const [x, y, w, h] = at;
    // Сохраняем аспект source внутри прямоугольника at: min-scale, центрируем.
    const srcAspect = sw / sh;
    const dstAspect = w / h;
    let fitW, fitH;
    if (dstAspect > srcAspect) { fitH = h; fitW = h * srcAspect; }
    else                       { fitW = w; fitH = w / srcAspect; }
    ax = x + (w - fitW) / 2;
    ay = y + (h - fitH) / 2;
    aw = fitW; ah = fitH;
  }
  // Используем <image> с viewBox-подобной трансформацией:
  // Кладём image целиком, но через clipPath оставляем только source-регион,
  // и через transform масштабируем+сдвигаем так, чтобы source оказался в at.
  const clipId = `zc-${Math.random().toString(36).slice(2, 8)}`;
  const scaleX = aw / sw;
  const scaleY = ah / sh;
  // Храним <image> отдельно от SVG — используем CSS background через foreignObject
  // Надёжнее — сослаться на ту же data-uri, что img. Но у нас в SVG нет href — передаётся через imageHref.
  // Чтобы избежать дублирования, используем SVG <use> с символом… проще: дублируем data-uri через ${imageHref}.
  // imageHref прокидывается из renderSvg если есть. Если нет — рисуем только рамку+стрелку.
  const parts = [];
  if (imageHref) {
    parts.push(`<defs><clipPath id="${clipId}">
      <rect x="${ax}" y="${ay}" width="${aw}" height="${ah}"/>
    </clipPath></defs>`);
    // Подложка — белый фон (на случай прозрачных пикселей)
    parts.push(`<rect x="${ax}" y="${ay}" width="${aw}" height="${ah}" fill="#ffffff"/>`);
    // image + transform, обрезанный clipPath'ом в прямоугольник at
    const tx = ax - sx * scaleX;
    const ty = ay - sy * scaleY;
    parts.push(`<g clip-path="url(#${clipId})">
      <image href="${imageHref}" x="0" y="0"
        transform="translate(${tx} ${ty}) scale(${scaleX} ${scaleY})"
        style="image-rendering: auto;"/>
    </g>`);
  }
  // Рамка исходной области
  parts.push(`<rect x="${sx}" y="${sy}" width="${sw}" height="${sh}"
    fill="none" stroke="${border}" stroke-width="${borderWidth}" stroke-dasharray="6 4"/>`);
  // Рамка зума
  parts.push(`<rect x="${ax}" y="${ay}" width="${aw}" height="${ah}"
    fill="none" stroke="${border}" stroke-width="${borderWidth}"/>`);
  // Соединительная стрелка из центра source в ближайшую сторону at
  if (arrow) {
    const cx = sx + sw / 2;
    const cy = sy + sh / 2;
    // Точка на рамке at, ближайшая к центру source
    const tx = Math.max(ax, Math.min(ax + aw, cx));
    const ty = Math.max(ay, Math.min(ay + ah, cy));
    parts.push(`<line x1="${cx}" y1="${cy}" x2="${tx}" y2="${ty}"
      stroke="${border}" stroke-width="${borderWidth}" stroke-dasharray="4 4"/>`);
  }
  return parts.join('');
}

async function probePng(buf) {
  // PNG header: 8 bytes signature + IHDR chunk starting at offset 8
  // width at bytes 16-19, height at bytes 20-23 (big-endian)
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('Not a PNG');
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const [,, cmd, ...rest] = process.argv;
  if (cmd === 'crop') {
    // Usage: annotate.mjs crop <input.png> <output.png> <x,y,w,h> <scale>
    const [input, output, rect, scaleStr] = rest;
    if (!input || !output || !rect) {
      console.error('Usage: annotate.mjs crop <input.png> <output.png> <x,y,w,h> <scale=2>');
      process.exit(2);
    }
    const source = rect.split(',').map(Number);
    const scale = Number(scaleStr ?? 2);
    await cropScaled({ input, output, source, scale });
    console.log(`✓ ${output} (${Math.round(source[2] * scale)}×${Math.round(source[3] * scale)} px, lanczos3)`);
  } else {
    // Usage: annotate.mjs <input.png> <spec.json> <output.png>
    const input = cmd;
    const [specPath, output] = rest;
    if (!input || !specPath || !output) {
      console.error('Usage: annotate.mjs <input.png> <spec.json> <output.png>');
      console.error('   or: annotate.mjs crop <input.png> <output.png> <x,y,w,h> <scale>');
      process.exit(2);
    }
    const spec = JSON.parse(await fs.readFile(specPath, 'utf8'));
    const img = await fs.readFile(input);
    const dataUri = `data:image/png;base64,${img.toString('base64')}`;
    const annotations = spec.annotations.map(a => a.type === 'zoom' ? { ...a, imageHref: dataUri } : a);
    await annotate({ input, output, annotations });
    console.log(`✓ ${output}`);
  }
}
