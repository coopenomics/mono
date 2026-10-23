// Сценарий: боксы и типы боксов на складе участка (Эпик 19).
//
// Бокс — тара со своим QR-кодом. Тип задаёт габариты и объём (тару закупают
// партиями), боксы заводятся партиями одного типа и получают сквозные коды
// BX-0001, BX-0002… Требует включённого containers_enabled (фаза 07).
//
// Повторный прогон терпим: тип и партия не пересоздаются, кадры снимаются
// с уже заведённых.
//
// Фикстура: председатель Красногорск (chairkrg) — грант Container:manage.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHOT_SCALE, SHOT_VIEWPORT, cleanViteOverlays, env, loginAs, loginAsChairman, pickBranchIfAsked } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const loadFixture = (username) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'));

export const meta = {
  title: 'Боксы и типы боксов',
  docPath: 'new/marketplace/operator/containers.md',
  assetsDir: 'assets/new/marketplace/operator/containers',
  role: 'user',
  mode: 'docs',
  feature: 'marketplace.stock',
  cases: ['mkt.stock.ui.01'],
  prepare: ['marketplace:07-warehouse-config'],
  fixture: 'chairkrg',
  fixtures: ['chairkrg'],
};

export default async ({ page, shot, expect }) => {
  // Печатный лист QR-этикеток вызывает win.print() — в headless он не рисует
  // диалога, но глушим на всякий случай во всех фреймах.
  await page.addInitScript(() => { window.print = () => {}; });

  const fixture = loadFixture('chairkrg');
  await loginAs(page, fixture);
  await pickBranchIfAsked(page);

  // ── Типы боксов ──
  // Тип тары общий на весь кооператив: его заводит председатель на столе
  // администратора в разделе «Боксы кооператива», вкладка «Типы боксов».
  // Оператор участка свою партию боксов заводит уже выбранного типа.
  const chairmanContext = await page.context().browser().newContext({
    viewport: SHOT_VIEWPORT,
    deviceScaleFactor: SHOT_SCALE,
    locale: 'ru-RU',
    // Время на кадрах — московское, как у кооператива: в CI браузер иначе живёт в UTC.
    timezoneId: 'Europe/Moscow',
  });
  const admin = await chairmanContext.newPage();
  // Строка реестра типов: имя типа совпадает с подсказкой поля «Название» в
  // окне, поэтому ищем именно в таблице, а не по всей странице.
  const typeRow = admin.locator('tbody tr').filter({ hasText: 'Ящик 60×40×30' }).first();
  try {
    await admin.addInitScript(() => { window.print = () => {}; });
    await loginAsChairman(admin, chairmanContext);
    await pickBranchIfAsked(admin);
    await admin.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-admin/containers`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await pickBranchIfAsked(admin);
    await admin.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await admin.locator('text=Типы боксов').first().click();
    await admin.waitForTimeout(1200);
    await cleanViteOverlays(admin);

    const hasType = await typeRow.count();
    if (!hasType) {
      await shot(
        admin,
        '01-types-empty',
        'Стол администратора, «Боксы кооператива», вкладка «Типы боксов» до заведения первого типа. Тип задаёт габариты и объём тары, а не отдельный бокс: коробки закупают одинаковыми партиями, а объём нужен агрегатом — по нему считается перевозка боксов между участками.',
      );

      await admin.locator('button:has-text("Тип боксов")').first().click();
      await admin.waitForSelector('.q-dialog', { timeout: 10000 });
      await admin.locator('.q-dialog .q-field:has-text("Название") input').first().fill('Ящик 60×40×30');
      await admin.locator('.q-dialog .q-field:has-text("Длина") input').first().fill('60');
      await admin.locator('.q-dialog .q-field:has-text("Ширина") input').first().fill('40');
      await admin.locator('.q-dialog .q-field:has-text("Высота") input').first().fill('30');
      await admin.locator('.q-dialog .q-field:has-text("Предельный вес") input').first().fill('25');
      await admin.waitForTimeout(600);

      await shot(
        admin,
        '02-type-dialog',
        'Заведение типа боксов: название и габариты в сантиметрах — так тару меряют на месте. Полезный объём в кубометрах считается сам; предельный вес — необязательное ограничение.',
      );

      await admin.locator('.q-dialog button:has-text("Завести")').last().click();
      await admin.waitForTimeout(2500);
      await admin.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    }

    await shot(
      admin,
      '03-types-list',
      'Реестр типов боксов кооператива: габариты, объём и предельный вес. Дальше участки заводят боксы партиями выбранного типа.',
      {
        expect: async () => {
          await expect(typeRow).toBeVisible({ timeout: 15000 });
        },
      },
    );
  } catch (e) {
    // Кадр поломки сюита снимает с основной страницы; стол администратора
    // открыт во втором контексте — снимаем его сами, иначе причина не видна.
    await shot(admin, '00-admin-fail', 'Стол администратора в момент поломки сценария.', { allowError: true }).catch(() => {});
    throw e;
  } finally {
    await chairmanContext.close();
  }

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-pvz/warehouse/containers`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await cleanViteOverlays(page);

  const hasBoxes = await page.locator('text=BX-0001').count();
  if (!hasBoxes) {
    await page.locator('button:has-text("Завести боксы")').first().click();
    await page.waitForSelector('.q-dialog', { timeout: 10000 });
    // Тип боксов — из общего реестра кооператива; при одном типе он уже выбран.
    const typeField = page.locator('.q-dialog .q-field:has-text("Тип боксов")').first();
    if (await typeField.count()) {
      await typeField.click();
      const opt = page.locator('.q-menu .q-item:has-text("Ящик 60×40×30")').first();
      if (await opt.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)) await opt.click();
      else await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
    await page.locator('.q-dialog .q-field:has-text("Сколько завести") input').first().fill('6');
    await page.locator('.q-dialog .q-field:has-text("Подпись партии") input').first().fill('Молочная тара');
    await page.waitForTimeout(600);

    await shot(
      page,
      '04-batch-dialog',
      'Партия боксов: тип, количество и подпись. Коды выдаются подряд (BX-0001, BX-0002…); сразу после заведения открывается лист QR-этикеток на печать — этикетки клеятся на тару.',
    );

    await page.locator('.q-dialog button:has-text("Завести")').last().click();
    await page.waitForTimeout(3000);
  }

  await shot(
    page,
    '05-containers-list',
    'Реестр боксов участка: код, тип, подпись партии и текущее место. Отмеченные боксы можно отправить на печать QR-этикеток повторно. При закрывающей подписи приёмки достаточно отсканировать бокс, чтобы принятое имущество легло на своё место.',
    {
      expect: async (p) => {
        await expect(p.locator('text=BX-0001').first()).toBeVisible({ timeout: 15000 });
      },
    },
  );
};
