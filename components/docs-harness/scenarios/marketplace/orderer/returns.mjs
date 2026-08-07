// Сценарий: orderer-стол «Гарантийный возврат» (/market/returns, Story 7.1 / FR29).
//
// Поток III «Возврат и списание», шаг 1: пайщица Екатерина оформляет возврат
// по одному из своих ПОЛУЧЕННЫХ заказов. Полный путь:
//   1. /market/returns — выбор полученного заказа из выпадающего списка
//      (RECEIVED-заказы пайщика; ручной ввод UUID убран как нереалистичный).
//   2. 3-шаговый takeover SubmitReturnClaimDialog:
//      описание брака (причина + категория + кол-во) → фото-доказательство
//      (1-10 файлов) → подпись заявления (registry_id=1104) ключом сессии.
//   3. После submit (marketplaceCreateReturnClaim) заявление уходит на
//      удалённое рассмотрение председателя КУ (статус «На рассмотрении
//      председателя»).

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'),
  );

// CRC32 (PNG-полином) — нужен для корректных chunk-CRC, иначе строгий декодер
// браузера отвергает картинку (naturalWidth=0, broken-иконка), хотя HTTP 200.
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
// Валидный RGB-PNG заданного размера, залитый одним цветом. В отличие от
// «минимального» 1×1 — гарантированно декодируется и в операторском диалоге
// показывается осмысленной миниатюрой фото.
function makeSolidPng(width, height, [r, g, b]) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  // 10,11,12 = compression/filter/interlace = 0
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

export const meta = {
  title: 'Стол заказчика — гарантийный возврат',
  docPath: 'new/marketplace/orderer/return-claim.md',
  assetsDir: 'assets/new/marketplace/orderer/return-claim',
  role: 'user',
  fixture: 'ekaterina',
  fixtures: ['ekaterina'],
};

// Фото-доказательство брака. На orderer-столе показывается только chip
// «Фото N · PNG», но в операторском RemoteDecisionDialog рендерится <img> —
// поэтому нужен валидно декодируемый кадр осмысленного размера (землисто-бурая
// заливка как «фото повреждённого мешка картофеля»). Хеш файла уходит on-chain.
const DEFECT_PNG = makeSolidPng(480, 360, [150, 111, 51]);

async function signAllAgreements(page) {
  for (let i = 0; i < 8; i++) {
    const clicked = await page.evaluate(() => {
      const portals = Array.from(document.querySelectorAll('[id^="q-portal--dialog--"]'))
        .filter((p) => getComputedStyle(p).display !== 'none');
      if (portals.length === 0) return false;
      const top = portals[portals.length - 1];
      const btn = Array.from(top.querySelectorAll('button'))
        .find((b) => b.textContent?.trim() === 'Подписать' && !b.disabled);
      if (!btn) return false;
      btn.scrollIntoView({ block: 'center', behavior: 'instant' });
      btn.click();
      return true;
    });
    if (!clicked) break;
    await page.waitForTimeout(3500);
  }
}

export default async ({ page, shot }) => {
  const fixture = loadFixture('ekaterina');

  // Source-of-truth успеха = GraphQL mutation 200 без errors (Notify живёт 2.5с).
  let claimSent = false;
  let claimStatus = null;
  let claimBody = null;
  page.on('request', (req) => {
    if (req.url().includes('/v1/graphql') && req.method() === 'POST') {
      const body = req.postData() || '';
      if (/marketplaceCreateReturnClaim|MarketplaceCreateReturnClaim/.test(body)) claimSent = true;
    }
  });
  page.on('response', async (res) => {
    if (claimSent && claimStatus === null && res.url().includes('/v1/graphql')) {
      try {
        const body = await res.text();
        if (body.includes('marketplaceCreateReturnClaim')) {
          claimStatus = res.status();
          claimBody = body.slice(0, 1400);
        }
      } catch {}
    }
  });

  await loginAs(page, fixture);
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));
  await page.waitForFunction(
    () => !document.body.innerText.includes('Формируем документ'),
    { timeout: 30000 },
  ).catch(() => {});
  await page.waitForTimeout(1500);
  await signAllAgreements(page);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/returns`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.locator('.mp-return-claims, .q-page').first()
    .waitFor({ state: 'visible', timeout: 90000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await cleanViteOverlays(page);
  await signAllAgreements(page);
  await page.waitForTimeout(1200);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-returns-list',
    'Стол «Гарантийный возврат имущества» пайщицы Екатерины. Выпадающий список «Полученный заказ» содержит её заказы со статусом «Получен» — возврат оформляется только по выданному имуществу в пределах гарантийного срока. Ниже — ленты активных и архивных заявлений.',
  );

  // Выбор полученного заказа. request_hash детерминирован
  // (return:order_hash:orderer:qty), поэтому повторная заявка на уже
  // возвращённый заказ коллизит on-chain (409 «Заявление уже подано»). На
  // «грязном» стенде список содержит и уже заявленные заказы — UI их не
  // отфильтровывает. Поэтому перебираем позиции списка по очереди: на коллизии
  // 409 перезагружаем стол и берём следующий заказ, пока не найдём незаявленный.
  // Кадры 02-04 (описание/фото/подпись) визуально одинаковы для любого заказа,
  // поэтому переснимаются на каждой попытке и остаются от успешной.
  const orderSelect = page.locator('.mp-return-claims__submit .q-select').first();
  await orderSelect.click();
  await page.waitForTimeout(500);
  const optionCount = await page.locator('.q-menu .q-item').count();
  if (optionCount === 0) throw new Error('[return-claim] в списке нет полученных заказов для возврата');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  let submitted = false;
  let lastBody = null;
  for (let idx = 0; idx < optionCount && !submitted; idx++) {
    // Сброс перехватчиков перед попыткой.
    claimSent = false;
    claimStatus = null;
    claimBody = null;

    await orderSelect.click();
    await page.waitForTimeout(500);
    const opt = page.locator('.q-menu .q-item').nth(idx);
    await opt.waitFor({ state: 'visible', timeout: 8000 });
    await opt.click();
    await page.waitForTimeout(400);
    await cleanViteOverlays(page);

    await page.locator('button:has-text("Подать заявление")').first().click();
    await page.locator('.mp-return-submit').first().waitFor({ state: 'visible', timeout: 8000 });
    await page.waitForTimeout(600);
    await cleanViteOverlays(page);

    // === Шаг 1 takeover: описание брака ===
    const reason = page.locator('.mp-return-submit textarea').first();
    await reason.click();
    await reason.fill('Товар повреждён при доставке: треснул мешок, часть картофеля раздавлена и непригодна к употреблению.');
    await page.waitForTimeout(300);

    const categorySelect = page.locator('.mp-return-submit .q-select').first();
    await categorySelect.click();
    await page.waitForTimeout(400);
    await page.locator('.q-menu .q-item:has-text("Повреждено / сломано")').first().click();
    await page.waitForTimeout(300);

    const qty = page.locator('.mp-return-submit input[type="number"]').first();
    await qty.click();
    await qty.fill('1');
    await page.waitForTimeout(300);
    await cleanViteOverlays(page);
    await shot(
      page,
      '02-describe-defect',
      'Шаг 1 заявления — описание дефекта: причина возврата (увидит председатель КУ при удалённом рассмотрении), категория дефекта «Повреждено / сломано» и возвращаемое количество единиц.',
    );

    // К шагу фото.
    await page.locator('button:has-text("К загрузке фото")').first().click();
    await page.waitForTimeout(500);
    await page.locator('.mp-return-submit input[type="file"]').first()
      .setInputFiles({ name: 'defect-01.png', mimeType: 'image/png', buffer: DEFECT_PNG });
    await page.waitForTimeout(800);
    await cleanViteOverlays(page);
    await shot(
      page,
      '03-attach-photos',
      'Шаг 2 — фото-доказательство: пайщик прикладывает от 1 до 10 фотографий товара (JPEG/PNG/WEBP, до 10 МБ). Хеши файлов записываются в блокчейн как доказательная база. Приложенные файлы показаны чипами.',
    );

    // К подписи.
    await page.locator('button:has-text("К подписи заявления")').first().click();
    await page.locator('.mp-return-submit__preview, text=Не удалось сформировать').first()
      .waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await cleanViteOverlays(page);
    await shot(
      page,
      '04-sign-statement',
      'Шаг 3 — подпись заявления: backend формирует предварительное заявление на возврат (registry_id=1104), пайщик сверяет его и подписывает ключом текущей сессии. Подписанный документ уходит вместе с причиной и фото.',
    );

    // Подписать и подать.
    await page.locator('button:has-text("Подписать и подать")').first().click();

    let waited = 0;
    while (!claimSent && waited < 12000) { await page.waitForTimeout(200); waited += 200; }
    if (!claimSent) throw new Error('[return-claim] submit нажат, но мутация marketplaceCreateReturnClaim НЕ ушла');
    let waitedRes = 0;
    while (claimStatus === null && waitedRes < 40000) { await page.waitForTimeout(200); waitedRes += 200; }
    lastBody = claimBody;
    console.log(`[return-claim] попытка idx=${idx} sent=${claimSent} status=${claimStatus} waitedMs=${waited}+${waitedRes}`);

    const isCollision = claimBody && /уже подано/.test(claimBody);
    if (claimStatus === 200 && !/"errors":\s*\[/.test(claimBody || '')) {
      submitted = true;
      break;
    }
    if (isCollision) {
      // Заказ уже заявлен — полный reload (hash-навигация SPA не размонтирует
      // takeover-диалог степпера, он бы перехватывал клики), потом следующий заказ.
      console.log(`[return-claim] idx=${idx} уже заявлен (409) — пробую следующий заказ`);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));
      await page.locator('.mp-return-claims, .q-page').first()
        .waitFor({ state: 'visible', timeout: 90000 }).catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
      await signAllAgreements(page);
      await page.waitForTimeout(1500);
      await cleanViteOverlays(page);
      continue;
    }
    // Любая другая ошибка — фейлим сразу, не маскируем.
    console.log(`[return-claim] response body: ${claimBody}`);
    throw new Error(`[return-claim] mutation вернула статус ${claimStatus}`);
  }

  if (!submitted) {
    console.log(`[return-claim] last response body: ${lastBody}`);
    throw new Error('[return-claim] все полученные заказы уже заявлены — нет незаявленного для свежего возврата (нужен reboot:extra)');
  }

  // Заявление пишется в PG через parser sync (~2-3с после on-chain submretrn),
  // поэтому первый load() в onSubmitted может не застать строку. Перезагружаем
  // ленту и ждём появления карточки активного заявления.
  await page.waitForTimeout(4000);
  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/returns`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.locator('.mp-return-claims, .q-page').first()
    .waitFor({ state: 'visible', timeout: 90000 }).catch(() => {});
  await page.locator('text=На рассмотрении председателя').first()
    .waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await cleanViteOverlays(page);
  await shot(
    page,
    '05-claim-submitted',
    'Заявление подано: в ленте «Активные заявления» появилась карточка со статусом «На рассмотрении председателя» — указаны количество, фактическая стоимость, номер заказа и причина возврата. Председатель кооперативного участка рассмотрит обращение удалённо и при необходимости пригласит на очный осмотр.',
  );
};
