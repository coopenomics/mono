// Сценарий: пайщик подаёт заявление на гарантийный возврат полученного заказа.
//
// Право на возврат задаёт председатель при одобрении предложения — гарантийным
// сроком в днях. Срок снимается в заказ при оформлении и на выдаче
// превращается в дату окончания гарантии; нулевой срок означает, что возврат
// по предложению не предусмотрен вовсе. Здесь срок задан (см. сценарий
// модерации предложения), поэтому заявление подать можно.
//
// Отдельной страницы /market/returns у заказчика нет (маршрут отдавал 404):
// возврат живёт в карточке заказа, рядом с фактом выдачи и хронологией.
//
// Фикстура: ekaterina / Смирнова Екатерина Александровна — её заказ получен.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs, pickBranchIfAsked } from '../../../lib/harness.mjs';

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

/** Фото «дефекта», которое пайщик прикладывает к заявлению. */
const RETURN_PHOTO = makeSolidPng(480, 360, [176, 92, 76]);

/** Причина возврата — свободный текст, его читает председатель участка. */
const RETURN_REASON = 'Упаковка вскрыта, содержимое с посторонним запахом — товар к употреблению непригоден.';

export const meta = {
  mode: 'docs',
  feature: 'marketplace.return',
  cases: ['mkt.ret.happy.01'],
  prepare: [
    'marketplace:01-l1-accept',
    'marketplace:02-branches',
    'marketplace:03-assign-branches',
    'marketplace:04-supplier',
    'marketplace:05-sign-offer',
    'marketplace-deposits:fund',
  ],
  title: 'Стол заказчика — заявление на гарантийный возврат',
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

export default async ({ page, shot, expect }) => {
  await loginAs(page, loadFixture('ekaterina'));
  await pickBranchIfAsked(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/my-orders`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('text=Мои заказы', { timeout: 90000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await cleanViteOverlays(page);

  await page.getByText('Берёзовый сок').first().click({ force: true });
  await page.waitForSelector('text=Факт выдачи', { timeout: 30000 });
  await page.waitForTimeout(2500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-order-detail',
    'Карточка полученного заказа: сумма, количество и цена за единицу, пункт выдачи, сверка «Заказ / Факт» и хронология — от оформления до получения. Здесь же блок гарантийного возврата.',
    {
      expect: async (p) => {
        await expect(p.locator('text=Факт выдачи').first()).toBeVisible({ timeout: 15000 });
        await expect(p.locator('text=Хронология').first()).toBeVisible({ timeout: 15000 });
      },
    },
  );

  await shot(
    page,
    '02-return-available',
    'Блок гарантийного возврата: срок задан председателем при одобрении предложения, он ещё не истёк — значит, заявление подать можно. Рядом с состоянием указана дата окончания гарантии.',
    {
      expect: async (p) => {
        await expect(p.locator('text=Гарантийный возврат доступен').first()).toBeVisible({ timeout: 15000 });
      },
    },
  );

  // ── Подача заявления ────────────────────────────────────────────────────
  // Заявление собирается мастером из трёх шагов: причина → фото → подпись.
  // Каждый шаг двигает одна и та же кнопка подтверждения в подвале диалога,
  // у неё меняется подпись, поэтому кликаем по классу, а не по тексту.
  await page.locator('button:has-text("Подать заявление на возврат")').first().click({ timeout: 20000 });

  const dialog = page.locator('.mp-takeover').first();
  await dialog.waitFor({ state: 'visible', timeout: 20000 });
  const confirmBtn = dialog.locator('.mp-takeover__confirm');

  await dialog.locator('textarea').first().fill(RETURN_REASON);
  await page.waitForTimeout(400);
  await cleanViteOverlays(page);

  await shot(
    page,
    '03-claim-reason',
    'Шаг «Описание»: пайщик своими словами объясняет, что не так с товаром, — этот текст увидит председатель участка при удалённом рассмотрении. Количество можно не указывать: тогда возвращается всё выданное.',
  );

  await confirmBtn.click();

  // Фото прикладываем прямо в скрытый input загрузчика — диалог выбора файла
  // операционной системы Playwright'у недоступен.
  await dialog.locator('input.file-uploader__native').first().setInputFiles({
    name: 'defect.png',
    mimeType: 'image/png',
    buffer: RETURN_PHOTO,
  });
  await page.waitForTimeout(800);
  await cleanViteOverlays(page);

  await shot(
    page,
    '04-claim-photo',
    'Шаг «Фото»: приложено фото товара. Сами файлы уезжают в хранилище кооператива, а их хеши записываются в блокчейн — доказательная база, которую нельзя подменить задним числом.',
  );

  await confirmBtn.click();

  // Заявление формируется сервером: показывается тот же документ, который
  // будет подписан. Ждём именно его, а не фиксированную паузу.
  await dialog.locator('.mp-return-submit__preview').waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForTimeout(600);
  await cleanViteOverlays(page);

  await shot(
    page,
    '05-claim-preview',
    'Шаг «Подпись»: заявление на гарантийный возврат целиком — состав, количество, сумма к возврату. Пайщик подписывает его своим ключом, подпись уходит в блокчейн вместе с хешами фотографий.',
  );

  await confirmBtn.click();

  // После подачи блок возврата в карточке меняет состояние: вместо действия
  // показывается сама заявка со статусом рассмотрения.
  await page.locator('text=Заявление на возврат').first().waitFor({ state: 'visible', timeout: 90000 });
  await page.waitForTimeout(1500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '06-claim-submitted',
    'Заявление подано и ждёт решения председателя кооперативного участка. Действие подачи из карточки исчезло — по одному заказу одновременно рассматривается только одно заявление.',
    {
      expect: async (p) => {
        // Заявка обязана появиться именно в карточке заказа: если бы подача не
        // доехала до сервера, здесь осталось бы «Гарантийный возврат доступен».
        await expect(p.locator('text=Заявление на возврат').first()).toBeVisible({ timeout: 20000 });
        await expect(p.locator('text=Гарантийный возврат доступен')).toHaveCount(0);
      },
    },
  );
};
