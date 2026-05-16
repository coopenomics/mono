// Хелперы регистрации в Восходе: повторно используется в сценариях 01-08
// onboarding'а (каждый последующий сценарий проходит весь wizard до своего
// «точки интереса»; перепроходить wizard в Playwright детерминированно проще,
// чем восстанавливать sign-up state из IndexedDB).
//
// Контракт фикстуры coopData — см. scenarios/onboarding/01-register-coop.mjs:
// short_name / full_name / type / represented_by / phone / country / city /
// full_address / fact_address / inn / ogrn / kpp / bank.{name,corr,bik,kpp,account,currency}.
// email генерится тут с уникальным RUN_ID, чтобы registerAccount не падал
// на дубликате email.

import fs from 'node:fs';

export function makeRunId() {
  return String(Date.now()).slice(-6);
}

async function fillByLabel(page, label, value) {
  await page.locator(`label:has-text("${label}")`).first().locator('input,textarea').fill(value);
}

async function clickContinue(page) {
  await page.locator('button:has-text("Продолжить")').first().click();
}

/**
 * Проходит wizard /auth/signup для organization-type кооператива до экрана
 * ReadStatement. Делает шоты ключевых шагов через переданный `shot`. По
 * пути перехватывает GraphQL ответ registerAccount, чтобы достать
 * сгенерированный username и WIF из поля «Приватный ключ».
 *
 * @returns {Promise<{username: string|null, wif: string|null, email: string}>}
 */
export async function signUpAsOrganization({
  page,
  shot,
  env,
  coopData,
  fixturePath,
  runId,
}) {
  const id = runId ?? makeRunId();
  const email = `${coopData.emailLocal || 'chairman'}+${id}@example.com`;

  // --- 1. Открываем форму регистрации. ---
  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/auth/signup`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=ВСТУПИТЬ В ПАЙЩИКИ', { timeout: 30_000 });
  await page.waitForTimeout(500);
  await shot(page, '01-signup-empty', 'Открытая форма /auth/signup: первый шаг визарда — ввод электронной почты.');

  // --- 2. Email. ---
  await fillByLabel(page, 'Введите email', email);
  await page.waitForTimeout(300);
  await shot(page, '02-email-filled', `Введён email будущего председателя второго кооператива (${email}).`);
  await clickContinue(page);

  // --- 3. Тип аккаунта — Организация. ---
  await page.locator('.q-stepper__tab--active:has-text("Заполните форму заявления")').first()
    .waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator('button:has-text("Организация")').first()
    .waitFor({ state: 'visible', timeout: 10_000 });
  await page.waitForTimeout(400);
  await shot(page, '03-type-buttons', 'Выбор типа пайщика: три кнопки — «Физлицо», «ИП», «Организация».');

  await page.locator('button:has-text("Организация")').click();
  await page.waitForSelector('label:has-text("Краткое наименование организации")', { timeout: 15_000 });
  await page.waitForTimeout(400);
  await shot(page, '04-organization-empty', 'Раскрылась форма данных организации (после клика «Организация»).');

  // --- 4. Заполнение данных кооператива. ---
  await fillByLabel(page, 'Краткое наименование организации', coopData.short_name);
  await fillByLabel(page, 'Полное наименование организации', coopData.full_name);

  await page.locator('label:has-text("Выберите тип организации")').first().click();
  await page.waitForSelector(`text=${coopData.type}`, { timeout: 5_000 });
  await page.locator(`.q-menu .q-item:has-text("${coopData.type}")`).first().click();
  await page.waitForTimeout(300);

  await fillByLabel(page, 'Фамилия представителя', coopData.represented_by.last_name);
  await fillByLabel(page, 'Имя представителя', coopData.represented_by.first_name);
  await fillByLabel(page, 'Отчество представителя', coopData.represented_by.middle_name);
  await fillByLabel(page, 'действует на основании', coopData.represented_by.based_on);
  await fillByLabel(page, 'Должность представителя', coopData.represented_by.position);
  await fillByLabel(page, 'Номер телефона представителя', coopData.phone);

  await page.locator('label:has-text("Страна")').first().click();
  await page.locator('.q-menu .q-item:has-text("Россия")').first().click();
  await page.waitForTimeout(200);

  await fillByLabel(page, 'Город', coopData.city);
  await fillByLabel(page, 'Юридический адрес регистрации', coopData.full_address);
  await fillByLabel(page, 'Фактический адрес', coopData.fact_address);
  await fillByLabel(page, 'ИНН организации', coopData.inn);
  await fillByLabel(page, 'ОГРН организации', coopData.ogrn);
  await fillByLabel(page, 'КПП организации', coopData.kpp);
  await fillByLabel(page, 'Наименование банка', coopData.bank.name);
  await fillByLabel(page, 'Корреспондентский счет', coopData.bank.corr);
  await fillByLabel(page, 'БИК', coopData.bank.bik);
  await fillByLabel(page, 'КПП банка', coopData.bank.kpp);
  await fillByLabel(page, 'Номер счета', coopData.bank.account);

  await page.locator('label:has-text("Валюта")').first().click();
  await page.locator('.q-menu .q-item:has-text("RUB")').first().click();
  await page.waitForTimeout(200);

  await page.waitForTimeout(500);
  await shot(page, '05-organization-filled', 'Все поля кооператива заполнены: реквизиты, представитель, банковские данные.');

  await page.locator('.q-checkbox:has-text("персональных данных")').click();
  await page.waitForTimeout(300);
  await clickContinue(page);

  // --- 6. GenerateAccount. ---
  await page.locator('.q-stepper__tab--active:has-text("Получите приватный ключ")').first()
    .waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForSelector('label:has-text("Приватный ключ")', { timeout: 15_000 });
  await page.waitForTimeout(800);
  await shot(page, '07-generate-account', 'Шаг «Получите приватный ключ» — UI сгенерировал приватный ключ (WIF) кооператива.');

  const wif = await page.locator('label:has-text("Приватный ключ")').first().locator('input').inputValue();
  if (wif && fixturePath) {
    fs.writeFileSync(
      fixturePath,
      JSON.stringify({ ...coopData, email, wif }, null, 2),
      'utf8',
    );
    console.log(`[signUpAsOrganization] фикстура сохранена → ${fixturePath} (wif=${wif.slice(0, 6)}…)`);
  }

  await page.locator('.q-checkbox:has-text("сохранил ключ")').click();
  await page.waitForTimeout(300);

  // Перехват GraphQL registerAccount для извлечения username.
  const registerAccountResponse = page.waitForResponse(
    (resp) =>
      resp.url().includes('/graphql') &&
      resp.request().method() === 'POST' &&
      resp.request().postData()?.includes('registerAccount'),
    { timeout: 30_000 },
  );
  await clickContinue(page);
  let username = null;
  try {
    const resp = await registerAccountResponse;
    const json = await resp.json();
    username = json?.data?.registerAccount?.account?.username || null;
  } catch (e) {
    console.warn('[signUpAsOrganization] не удалось перехватить registerAccount response:', e.message);
  }

  // --- 8. ReadStatement — ждём активации и отрисованного заявления. ---
  await page.locator('.q-stepper__tab--active:has-text("Ознакомьтесь")').first()
    .waitFor({ state: 'visible', timeout: 60_000 });
  await page.locator('.statement').first()
    .waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator('.statement').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await shot(
    page,
    '09-statement-read',
    'Шаг «Заявление о вступлении» — на странице отображается сгенерированный текст заявления с реквизитами кооператива.',
  );

  // Обновляем фикстуру username'ом.
  if (username && fixturePath && fs.existsSync(fixturePath)) {
    const existing = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    fs.writeFileSync(
      fixturePath,
      JSON.stringify({ ...existing, username }, null, 2),
      'utf8',
    );
    console.log(`[signUpAsOrganization] username сохранён в фикстуру: ${username}`);
  }

  return { username, wif, email };
}
