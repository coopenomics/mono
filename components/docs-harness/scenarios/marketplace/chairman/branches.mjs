// Сценарий: Стол председателя кооператива → Сеть ПВЗ.
// Председатель Восхода создаёт три кооперативных участка (КУ) Московской области:
//   krg — Красногорск, председатель chairkrg
//   odn — Одинцово, председатель chairodn
//   myt — Мытищи, председатель chairmyt
// А также добавляет доверенное лицо trustedkrg к участку Красногорск.
//
// Фикстура — chairman кооператива `ant` (Иван Иванов), email ivanov@example.com,
// shared cooperative-WIF — берётся из env (CHAIRMAN_WIF).
// Председатели КУ (chairkrg/chairodn/chairmyt) и trustedkrg должны существовать
// заранее как пайщики; их создаёт скрипт seed-marketplace-fixtures.sh.

import { loginAsChairman, dismissOnboardingDialogs } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Сеть ПВЗ: создание кооперативных участков',
  docPath: 'new/marketplace/chairman/branches.md',
  assetsDir: 'assets/new/marketplace/chairman/branches',
  role: 'chairman',
};

const BRANCHES = [
  {
    braname: 'krg',
    trusteeUsername: 'chairkrg',
    short_name: 'КУ Красногорск',
    phone: '9991230101',
    address: 'Московская область, г. Красногорск, ул. Заводская, д. 1',
    email: 'krg@voskhod.coop',
    based_on: 'решение собрания совета №СС-1 от 20 мая 2026 г',
  },
  {
    braname: 'odn',
    trusteeUsername: 'chairodn',
    short_name: 'КУ Одинцово',
    phone: '9991230202',
    address: 'Московская область, г. Одинцово, ул. Центральная, д. 12',
    email: 'odn@voskhod.coop',
    based_on: 'решение собрания совета №СС-1 от 20 мая 2026 г',
  },
  {
    braname: 'myt',
    trusteeUsername: 'chairmyt',
    short_name: 'КУ Мытищи',
    phone: '9991230303',
    address: 'Московская область, г. Мытищи, Олимпийский проспект, д. 5',
    email: 'myt@voskhod.coop',
    based_on: 'решение собрания совета №СС-1 от 20 мая 2026 г',
  },
];

export default async ({ page, context, shot, expect, env }) => {
  await loginAsChairman(page, context);
  await dismissOnboardingDialogs(page);

  // 1. Открыть страницу «Кооперативные участки»
  // Vue-router в SPA-mode у текущего стенда — hash-режим, ходим через /#/
  await page.goto(`${env.BASE_URL}/#/${env.COOPNAME}/chairman/settings/branches`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Кооперативные участки', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  await dismissOnboardingDialogs(page);
  await shot(page, '01-empty-list', 'Пустой реестр кооперативных участков: председатель видит таблицу без записей и кнопку «добавить участок» в шапке.');

  for (let i = 0; i < BRANCHES.length; i++) {
    const b = BRANCHES[i];

    // 2. Открыть диалог «Создать кооперативный участок»
    await page.locator('button:has-text("добавить участок")').click();
    await page.waitForSelector('text=Создать кооперативный участок', { timeout: 15000 });
    await page.waitForTimeout(400);
    if (i === 0) {
      await shot(page, '02-dialog-empty', 'Диалог «Создать кооперативный участок»: пустые поля «Председатель участка», «Наименование», «Телефон», «Адрес», «Email» и «Председатель действует на основании».');
    }

    // 3. Заполнить «Председатель участка» через UserSearchSelector (autocomplete)
    const trusteeField = page.locator('label:has-text("Председатель участка")').locator('input').first();
    await trusteeField.click();
    await trusteeField.fill(b.trusteeUsername);
    // ожидаем появления q-menu c результатами
    await page.locator(`.q-menu .q-item:has-text("${b.trusteeUsername}")`).first().waitFor({ state: 'visible', timeout: 10000 });
    await page.locator(`.q-menu .q-item:has-text("${b.trusteeUsername}")`).first().click();

    // 4. Остальные поля
    await page.locator('label:has-text("Наименование участка")').locator('input').fill(b.short_name);
    await page.locator('label:has-text("Номер телефона участка")').locator('input').fill(b.phone);
    await page.locator('label:has-text("Фактический адрес участка")').locator('input').fill(b.address);
    await page.locator('label:has-text("Email-адрес участка")').locator('input').fill(b.email);
    await page.locator('label:has-text("Председатель действует на основании")').locator('input').fill(b.based_on);

    await page.waitForTimeout(400);
    if (i === 0) {
      await shot(page, '03-dialog-filled', `Диалог заполнен для первого участка («${b.short_name}»): выбран председатель ${b.trusteeUsername}, заданы адрес, контакты и документ-основание.`);
    }

    // 5. Submit
    await page.locator('button:has-text("Создать")').click();

    // 6. Дождаться закрытия диалога и появления записи в таблице
    await page.locator('text=Создать кооперативный участок').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
    await page.waitForSelector(`text=${b.short_name}`, { timeout: 30000 });
    await page.waitForTimeout(800);

    if (i === 0) {
      await shot(page, '04-first-branch-created', `Реестр после создания первого участка: в таблице видна строка «${b.short_name}» с председателем.`);
    }
  }

  // 7. Финальный кадр — таблица с тремя участками
  await page.waitForTimeout(1000);
  await dismissOnboardingDialogs(page);
  await shot(page, '05-three-branches', 'Реестр кооперативных участков с тремя участками Подмосковья: Красногорск, Одинцово, Мытищи. Каждый со своим председателем.');

  // 8. Развернуть КУ Красногорск (toggle + → детали + кнопка-удалить)
  await page.locator('tr:has-text("КУ Красногорск") button[aria-label="add"], tr:has-text("КУ Красногорск") .q-btn').first().click().catch(() => {});
  await page.waitForTimeout(800);
  await shot(page, '06-branch-details', 'Развёрнутая карточка КУ Красногорск: реквизиты участка, банковский счёт, карточка председателя; кнопка «удалить» доступна.');
};
