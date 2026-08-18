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
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs, pickBranchIfAsked } from '../../../lib/harness.mjs';
import { makeSolidPng } from '../../../lib/png.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'),
  );

/** Фото «дефекта», которое пайщик прикладывает к заявлению. */
const RETURN_PHOTO = makeSolidPng(480, 360, [176, 92, 76]);

/**
 * Сколько единиц пайщица возвращает. Возврат частичный намеренно: полный
 * возврат забирает у участка весь членский взнос по заказу, и следующая за
 * ним экономика участка смотрит на пустой кошелёк.
 */
const RETURN_QUANTITY = 3;

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
  docPath: 'new/marketplace/orderer/returns.md',
  assetsDir: 'assets/new/marketplace/orderer/returns',
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

  // Кадр блока возврата отличается от общего вида карточки: прокручиваем к
  // блоку гарантийного возврата, иначе два кадра выходят почти одинаковыми.
  await page.locator('text=/[Гг]арантийн/').first().scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(600);
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

  // Возвращается ЧАСТЬ выданного, а не всё. Так проверяется больше:
  // у заказа остаётся невозвращённая доля, членский взнос по ней остаётся у
  // участка (иначе кошелёк участка обнуляется и экономику не на чем смотреть),
  // а на складе появляется остаток кооператива — материал для перепредложения
  // и списания.
  const qtyInput = dialog.locator('input[type="number"]').first();
  await qtyInput.click();
  await qtyInput.fill(String(RETURN_QUANTITY));
  await qtyInput.blur();
  await page.waitForTimeout(600);
  await cleanViteOverlays(page);

  await shot(
    page,
    '03-claim-reason',
    `Шаг «Описание»: пайщик своими словами объясняет, что не так с товаром, — этот текст увидит председатель участка при удалённом рассмотрении. Здесь возвращается ${RETURN_QUANTITY} единицы из выданных: количество можно не указывать вовсе, тогда вернётся всё.`,
    {
      expect: async () => {
        // Количество обязано дойти до модели: иначе вернётся всё выданное, и
        // проверка частичного возврата превратится в проверку полного.
        expect(await qtyInput.inputValue()).toBe(String(RETURN_QUANTITY));
      },
    },
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
