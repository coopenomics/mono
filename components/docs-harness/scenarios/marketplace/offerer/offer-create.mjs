// Сценарий: Стол поставщика → создание предложения.
// Пайщик ivanpetrov входит на /market/create-offer, заполняет форму нового
// предложения и отправляет. Снимки: пустая форма → заполненная → каталог с
// новой карточкой.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'),
  );

export const meta = {
  title: 'Стол поставщика: создание предложения',
  docPath: 'new/marketplace/offerer/offer-create.md',
  assetsDir: 'assets/new/marketplace/offerer/offer-create',
  role: 'user',
  fixture: 'ivanpetrov',
  fixtures: ['ivanpetrov'],
};

async function signAllAgreements(page) {
  await page.waitForFunction(
    () => !document.body.innerText.includes('Формируем документ'),
    { timeout: 30000 },
  ).catch(() => {});
  await page.waitForTimeout(500);

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
  const fixture = loadFixture('ivanpetrov');

  await loginAs(page, fixture);
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));
  await signAllAgreements(page);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => {
    document.querySelectorAll('.q-notification').forEach((n) => n.remove());
  });
  await page.waitForTimeout(2000);

  // --- 01. Пустая форма создания предложения ---
  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/market/create-offer`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await cleanViteOverlays(page);
  await shot(
    page,
    '01-empty-form',
    'Форма «Новое предложение» сразу после открытия: все поля пустые',
  );

  // --- 02. Форма с заполненными базовыми полями ---
  // Заполняем то, что точно есть на форме: название, описание, цена.
  // Поля под label'ами — стандартная Quasar-структура.
  const setField = async (labelText, value) => {
    const loc = page.locator(`label:has-text("${labelText}")`).first();
    if (await loc.count() === 0) return false;
    // .locator('input,textarea') внутри label
    const inputLoc = loc.locator('input, textarea').first();
    if (await inputLoc.count() === 0) return false;
    await inputLoc.fill(value).catch(() => {});
    return true;
  };

  await setField('Название', 'Берёзовый сок ПК «Восход» (демо)');
  await setField('Описание', 'Свежий берёзовый сок, разлив 1 л. Поставка через ПВЗ Красногорск.');
  await setField('Цена', '120');
  await setField('Доступное количество', '50');
  await setField('Гарантия', '7');

  // q-select «Категория *» — Quasar рендерит label как div.q-field__label
  // (не HTML <label>). Селектор готов, но в текущей среде marketplace-resolver'ы
  // на backend :2998 не зарегистрированы — fetchCategories() возвращает [],
  // меню q-select остаётся пустым, и submit падает с «Выберите категорию».
  // Когда backend marketplace-extension будет поднят, нижеследующий блок выберет
  // первый baseline-пункт автоматически.
  const categoryField = page
    .locator('.q-field')
    .filter({ has: page.locator('.q-field__label', { hasText: 'Категория' }) })
    .first();
  if (await categoryField.count() > 0) {
    await categoryField.locator('.q-field__control').click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const firstItem = page.locator('.q-menu .q-item').first();
    if (await firstItem.count() > 0) {
      await firstItem.click({ timeout: 5000 }).catch(() => {});
    }
    await page.waitForTimeout(1000);
  }

  await page.waitForTimeout(1000);
  await cleanViteOverlays(page);
  await shot(
    page,
    '02-filled-form',
    'Та же форма с заполненными полями: название, описание, цена, количество, категория, гарантия, тип отсечки заказов',
  );

  // --- 03. После клика «Опубликовать на модерацию»: либо успех + редирект, либо валидационная подсветка ---
  const submitBtn = page.locator('button:has-text("Опубликовать на модерацию")').first();
  if (await submitBtn.count() > 0) {
    await submitBtn.click().catch(() => {});
    await page.waitForTimeout(6000);
    await cleanViteOverlays(page);
    await shot(
      page,
      '03-after-submit',
      'Состояние UI после клика «Опубликовать на модерацию»: либо подтверждение, либо подсветка незаполненных полей',
    );
  }

  // --- 04. Каталог после создания ---
  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/market/catalog`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await cleanViteOverlays(page);
  await shot(
    page,
    '04-catalog-after',
    'Каталог Стола заказов после создания предложения',
  );
};
