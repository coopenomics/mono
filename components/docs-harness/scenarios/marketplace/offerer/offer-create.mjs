// Сценарий: поставщик публикует предложение.
//
// Форма — пятишаговая карточка товара: «Товар» → «Цена и наличие» →
// «Условия поставки» → «Изображения» → «Проверка и публикация». После
// публикации предложение уходит на модерацию председателю и до одобрения в
// каталоге не появляется.
//
// Предусловия (фаза marketplace:04-supplier): пайщик допущен в реестр
// поставщиков и указал реквизиты для выплат — без реквизитов форма показывает
// блокирующее предупреждение и публиковать нельзя.
//
// Фикстура: ivanpetrov / Петров Иван Сергеевич.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs, pickBranchIfAsked } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'));

export const OFFER_TITLE = 'Яблочный сок';

export const meta = {
  title: 'Стол поставщика — создание предложения',
  docPath: 'new/marketplace/offerer/offer-create.md',
  assetsDir: 'assets/new/marketplace/offerer/offer-create',
  role: 'user',
  mode: 'docs',
  fixture: 'ivanpetrov',
  fixtures: ['ivanpetrov'],
  feature: 'marketplace.offer',
  cases: ['mkt.offer.happy.01'],
  prepare: ['marketplace:01-l1-accept', 'marketplace:02-branches', 'marketplace:03-assign-branches', 'marketplace:04-supplier', 'marketplace:05-sign-offer'],
};

// Числовые поля — управляемые: fill() без последующего blur оставляет модель
// нетронутой, и шаг уезжает дальше с прежним значением.
async function setNumber(page, label, value) {
  const input = page.locator(`.q-field:has-text("${label}") input`).first();
  await input.click();
  await input.fill('');
  await input.type(String(value));
  await input.blur();
  await page.waitForTimeout(300);
  return input;
}

export default async ({ page, shot, expect }) => {
  const fixture = loadFixture('ivanpetrov');
  await loginAs(page, fixture);
  await pickBranchIfAsked(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-supplier/create-offer`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('text=Название товара', { timeout: 120000 });
  await page.waitForTimeout(1500);
  await cleanViteOverlays(page);

  // Реквизиты для выплат обязаны быть настроены заранее: без них публикация
  // закрыта, и сценарий упрётся в предупреждение вместо формы.
  await expect(page.locator('text=Укажите реквизиты для выплат')).toHaveCount(0, { timeout: 10000 });

  await shot(
    page,
    '01-empty-form',
    'Карточка товара заполняется по шагам: сначала название, категория и описание. Подсказка под формой напоминает, что после публикации предложение уходит на модерацию председателю и до одобрения в каталоге не появляется.',
  );

  // --- Шаг 1. Товар --------------------------------------------------------
  await page.locator('.q-field:has-text("Название товара") input').first().fill(OFFER_TITLE);
  await page.locator('.q-field:has-text("Категория")').first().click();
  const category = page.locator('.q-menu .q-item, .q-menu [role="option"]').first();
  await category.waitFor({ state: 'visible', timeout: 15000 });
  await category.click();
  await page.locator('.q-field:has-text("Описание") textarea, .q-field:has-text("Описание") input')
    .first()
    .fill('Яблочный сок прямого отжима из яблок кооперативного сада. Без сахара и консервантов, хранить в холодильнике.');
  await page.waitForTimeout(500);

  await shot(
    page,
    '02-step-product',
    `Шаг «Товар» заполнен: название «${OFFER_TITLE}», выбрана категория из списка доступных кооперативу, добавлено описание для каталога.`,
  );
  await page.locator('button:has-text("Далее")').first().click();
  await page.waitForTimeout(1500);

  // --- Шаг 2. Цена и наличие ----------------------------------------------
  // Сок меряется литрами, не штуками: единица измерения задаёт и подпись цены
  // («за литр»), и шаг количества в диалоге заказа.
  await page.locator('.q-field:has-text("Единица измерения")').first().click();
  const litre = page.locator('.q-menu .q-item:has-text("литр"), .q-menu .q-item:has-text("Литр"), .q-menu .q-item:has-text("л")').first();
  await litre.waitFor({ state: 'visible', timeout: 10000 });
  await litre.click();
  await page.waitForTimeout(500);
  const price = await setNumber(page, 'Цена за', 250);
  const qty = await setNumber(page, 'Доступное количество', 100);
  const shelf = await setNumber(page, 'Срок годности', 30);
  // Проверяем, что значения дошли до модели: управляемые поля молча
  // возвращаются к значениям по умолчанию, если ввод не был зафиксирован.
  expect(await price.inputValue()).toBe('250');
  expect(await qty.inputValue()).toBe('100');
  expect(await shelf.inputValue()).toBe('30');

  await shot(
    page,
    '03-step-price',
    'Шаг «Цена и наличие»: цена за единицу, способ отпуска (по мере или упаковкой), ограничение количества и срок годности. Срок годности определяет, до какого момента имущество можно выдать заказчику.',
  );
  await page.locator('button:has-text("Далее")').first().click();
  await page.waitForTimeout(1500);

  // --- Шаг 3. Условия поставки --------------------------------------------
  await page.waitForSelector('text=Участки и объём поставки', { timeout: 20000 });
  // Отмечаем участок именно чекбоксом: клик по строке ничего не переключает,
  // а «Далее» без единого отмеченного участка молча остаётся на этом шаге.
  const krgRow = page.locator('.q-checkbox').first();
  await krgRow.click();
  await page.waitForTimeout(1200);
  await expect(page.locator('.q-checkbox[aria-checked="true"]').first()).toBeVisible({ timeout: 10000 });

  // Минимальный объём поставки > 1: при объёме 1 сводный заказ не копится и
  // прогресс-бар сбора партии нигде не показывается. 25 литров против заказа
  // в 10 литров дают наглядные 40% на «Входящих заказах» поставщика.
  const minVol = page.locator('.q-field:has-text("Мин. объём") input').first();
  await minVol.click();
  await minVol.fill('');
  await minVol.type('25');
  await minVol.blur();
  await page.waitForTimeout(500);

  await shot(
    page,
    '04-step-supply',
    'Шаг «Условия поставки»: поставщик отмечает кооперативные участки, на которые готов обеспечить доставку. Заказчик сможет выбрать предложение только на отмеченном участке.',
  );
  await page.locator('button:has-text("Далее")').first().click();
  await page.waitForTimeout(1500);

  // --- Шаг 4. Изображения --------------------------------------------------
  // Карточка без фотографии выглядит в каталоге пустой заглушкой — грузим
  // фотографию так же, как это сделает живой поставщик.
  const fileInput = page.locator('.q-file input[type="file"]').first();
  await fileInput.setInputFiles(path.resolve(__dirname, '../../../fixtures/sok.jpg'));
  await page.waitForTimeout(2000);

  await shot(
    page,
    '04b-step-images',
    'Шаг «Изображения»: до восьми фотографий JPEG/PNG/WEBP, первая становится обложкой карточки в каталоге.',
  );
  await page.locator('button:has-text("Далее")').first().click();
  await page.waitForTimeout(1500);

  // --- Шаг 5. Проверка и публикация ---------------------------------------
  await page.waitForSelector('text=Сверьте карточку перед отправкой', { timeout: 20000 });
  await shot(
    page,
    '05-review',
    'Последний шаг — сводка карточки перед отправкой. Здесь видно всё, что увидит модератор: товар, цену, условия поставки.',
  );

  // Поставщику важно увидеть карточку-предпросмотр целиком, как её увидит
  // заказчик в каталоге, — прокручиваем сводку до карточки.
  const previewCard = page.locator(`text=${OFFER_TITLE}`).last();
  await previewCard.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(800);
  await shot(
    page,
    '05b-review-card',
    'Карточка-предпросмотр в сводке: фотография, название, цена и условия — ровно то, что появится в каталоге после одобрения.',
  );

  const publish = page.locator('button:has-text("Опубликовать"), button:has-text("Отправить на модерацию")').first();
  await publish.click();
  await page.waitForTimeout(6000);
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await cleanViteOverlays(page);

  await shot(
    page,
    '06-after-publish',
    'После публикации предложение попадает в «Мои предложения» со статусом «На модерации» и ждёт решения председателя.',
    {
      expect: async (p) => {
        await expect(p.locator(`text=${OFFER_TITLE}`).first()).toBeVisible({ timeout: 20000 });
      },
    },
  );
};
