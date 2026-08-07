// Сценарий: Стол поставщика → создание предложения.
// Пайщик ivanpetrov входит на /market-supplier/create-offer, заполняет форму нового
// предложения и отправляет. Снимки: пустая форма → заполненная → каталог с
// новой карточкой.
//
// Quasar q-input/q-select рендерит label как div.q-field__label, а не
// <label>, поэтому селектор `label:has-text(...)` НЕ находит поля. Используем
// `.q-field:has(.q-field__label:has-text("X"))` и берём input внутри.

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

  // Сетевая телеметрия — критично для отлова silent submit failure.
  let createOfferSent = false;
  let createOfferStatus = null;
  let createOfferBody = null;
  page.on('request', (req) => {
    if (req.url().includes('/v1/graphql') && req.method() === 'POST') {
      try {
        const body = req.postData() || '';
        if (/marketplaceCreateOffer|MarketplaceCreateOffer/.test(body)) {
          createOfferSent = true;
        }
      } catch {}
    }
  });
  page.on('response', async (res) => {
    if (createOfferSent && createOfferStatus === null && res.url().includes('/v1/graphql')) {
      try {
        const body = await res.text();
        if (body.includes('marketplaceCreateOffer')) {
          createOfferStatus = res.status();
          createOfferBody = body.slice(0, 800);
        }
      } catch {}
    }
  });
  page.on('pageerror', (err) => console.log(`[page-error] ${err.message}`));

  await loginAs(page, fixture);
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));
  await signAllAgreements(page);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => {
    document.querySelectorAll('.q-notification').forEach((n) => n.remove());
  });
  await page.waitForTimeout(2000);

  // PRE: каталог — это default route расширения `market`. Заходим на него
  // первым: если 404 — extension не подгрузился (синтаксическая ошибка в
  // одной из marketplace-страниц ломает useInitExtensionsProcess через
  // boot/init.ts; см. ловушку в PLAN.md §9.X). Без этого pre-check форма
  // create-offer тоже даст 404 без понятного сообщения.
  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/catalog`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.waitForTimeout(3000);
  const catalogIs404 = await page.evaluate(() =>
    document.body.innerText.includes('404 страница не найдена'),
  );
  if (catalogIs404) {
    throw new Error(
      '[offer-create] /market/catalog → 404. extension `market` не подгружен. '
      + 'Проверь tail /tmp/desktop-dev.log — обычно vue/compiler-sfc Unexpected token.',
    );
  }

  // --- 01. Пустая форма создания предложения ---
  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-supplier/create-offer`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.locator('.q-form').first().waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1000);
  await cleanViteOverlays(page);
  await shot(
    page,
    '01-empty-form',
    'Форма «Новое предложение» сразу после открытия: все поля пустые',
  );

  // --- 02. Форма с заполненными базовыми полями ---
  // Quasar q-input: label = div.q-field__label, input лежит внутри .q-field.
  const setField = async (labelText, value) => {
    const field = page.locator(
      `.q-field:has(.q-field__label:text-is("${labelText}"))`,
    ).first();
    if (await field.count() === 0) {
      // fallback: label с обязательным звездочкой
      const fallback = page.locator(
        `.q-field:has(.q-field__label:has-text("${labelText}"))`,
      ).first();
      if (await fallback.count() === 0) {
        console.log(`[offer-create] поле «${labelText}» не найдено`);
        return false;
      }
      await fallback.locator('input, textarea').first().fill(value);
      return true;
    }
    await field.locator('input, textarea').first().fill(value);
    return true;
  };

  // q-select: клик по полю → меню q-menu → выбор первого option.
  const pickFirstOption = async (labelText) => {
    const field = page.locator(
      `.q-field:has(.q-field__label:has-text("${labelText}"))`,
    ).first();
    if (await field.count() === 0) {
      console.log(`[offer-create] q-select «${labelText}» не найден`);
      return false;
    }
    await field.click();
    await page.waitForTimeout(500);
    const opt = page.locator('.q-menu .q-item').filter({ hasNot: page.locator('.disabled') }).first();
    if (await opt.count() === 0) {
      console.log(`[offer-create] options для «${labelText}» пустые`);
      return false;
    }
    await opt.click();
    await page.waitForTimeout(400);
    return true;
  };

  // cycle_type параметризуется через env MP_CYCLE_TYPE (default time_based).
  //   individual        — немедленный acceptIndividual → синтез заявки-из-одного-
  //                        заказа → SUPPLY_PREPARED shipment (магистраль II).
  //   volume_based       — партия стартует при sum(orders) >= target_volume
  //                        (синхронный evaluateVolumeBasedAfterCreate).
  //   open_subscription  — партия закрывается по сигналу поставщика вручную.
  //   time_based         — партия по cron на cycle_end (created_at + cycle_days).
  const cycleType = process.env.MP_CYCLE_TYPE || 'time_based';
  const targetVolume = process.env.MP_TARGET_VOLUME || '5';
  const productNames = {
    individual: 'Мёд алтайский ПК «Восход» (individual, демо)',
    volume_based: 'Картофель Адретта мешок 25 кг (volume, демо)',
    open_subscription: 'Сыр Костромской ПК «Восход» (подписка, демо)',
    time_based: 'Берёзовый сок ПК «Восход» (демо)',
  };
  const productName = productNames[cycleType] || productNames.time_based;

  await setField('Название товара *', productName);
  await setField('Описание', 'Свежий берёзовый сок, разлив 1 л. Поставка через ПВЗ Красногорск.');
  await pickFirstOption('Категория *');
  await setField('Цена за единицу *', '120');
  await pickFirstOption('Единица *');
  await setField('Доступное количество *', '50');
  await setField('Гарантия (дней)', '7');

  // «Тип отсечки заказов» — q-option-group (radio). Radio-label = полный текст
  // CYCLE_TYPES (например «По объёму (volume_based)»). После клика по radio
  // onCycleTypeChange переключает v-if блок с cycle-полями → ждём их появления.
  const pickCycleRadio = async (radioText) => {
    const radio = page.locator(`.q-radio:has-text("${radioText}")`).first();
    if (await radio.count() === 0) {
      throw new Error(`[offer-create] radio «${radioText}» не найден в форме cycle_type`);
    }
    await radio.click();
    await page.waitForTimeout(500);
  };

  if (cycleType === 'individual') {
    await pickCycleRadio('Индивидуально');
  } else if (cycleType === 'volume_based') {
    await pickCycleRadio('По объёму');
    await setField('Целевой объём *', targetVolume);
    await setField('Максимальный срок ожидания (дней) *', '30');
  } else if (cycleType === 'open_subscription') {
    await pickCycleRadio('Открытая подписка');
    await setField('Лимит ожидания пайщика (дней, опц.)', '30');
  } else {
    // time_based (default)
    await setField('Длительность цикла (дней) *', '7');
  }

  await page.waitForTimeout(1000);
  await cleanViteOverlays(page);
  await shot(
    page,
    '02-filled-form',
    'Та же форма с заполненными полями: название, описание, цена, количество, гарантия',
  );

  // --- 03. Клик «Опубликовать на модерацию» и assert успешной отправки ---
  const submitBtn = page.locator('button:has-text("Опубликовать на модерацию")').first();
  if (await submitBtn.count() === 0) {
    throw new Error('[offer-create] кнопка «Опубликовать на модерацию» не найдена');
  }
  const isDisabled = await submitBtn.isDisabled();
  if (isDisabled) {
    // Снять текущее состояние формы для отладки и упасть громко.
    const fieldsDump = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.q-field')).map((f) => ({
        label: f.querySelector('.q-field__label')?.textContent?.trim(),
        value: f.querySelector('input')?.value,
        error: f.querySelector('.q-field__messages')?.textContent?.trim(),
      })),
    );
    console.log('[offer-create] form state:', JSON.stringify(fieldsDump, null, 2));
    throw new Error('[offer-create] submit btn disabled — форма не валидна');
  }
  await submitBtn.click();

  // Ждём пока мутация реально отправится.
  let waited = 0;
  while (!createOfferSent && waited < 10000) {
    await page.waitForTimeout(200);
    waited += 200;
  }
  if (!createOfferSent) {
    throw new Error('[offer-create] submit нажат, но мутация marketplaceCreateOffer НЕ ушла');
  }
  // Ждём ответа.
  let waitedRes = 0;
  while (createOfferStatus === null && waitedRes < 30000) {
    await page.waitForTimeout(200);
    waitedRes += 200;
  }
  console.log(
    `[offer-create] marketplaceCreateOffer sent=${createOfferSent} status=${createOfferStatus} waitedMs=${waited}+${waitedRes}`,
  );
  if (createOfferStatus !== 200) {
    console.log(`[offer-create] response body: ${createOfferBody}`);
    throw new Error(`[offer-create] mutation вернула статус ${createOfferStatus}`);
  }
  if (createOfferBody && /"errors":\s*\[/.test(createOfferBody)) {
    throw new Error(`[offer-create] mutation вернула GraphQL errors: ${createOfferBody}`);
  }

  await page.waitForTimeout(3000);
  await cleanViteOverlays(page);
  await shot(
    page,
    '03-after-submit',
    'Состояние UI после клика «Опубликовать на модерацию» — успешная отправка, идёт редирект в каталог',
  );

  // --- 04. Каталог после создания ---
  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/catalog`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await cleanViteOverlays(page);
  await shot(
    page,
    '04-catalog-after',
    'Каталог Стола заказов после создания предложения',
  );
};
