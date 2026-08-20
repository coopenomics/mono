// Сценарий: Стол председателя кооператива → Сеть ПВЗ.
// На свежем стенде (после `reboot:extra`) уже созданы три кооперативных участка
// Подмосковья — Красногорск (krg), Одинцово (odn), Мытищи (myt). Сценарий снимает
// текущее состояние сети ПВЗ + демонстрирует диалог «Создать кооперативный участок»
// без фактической отправки on-chain действия (КУ уже on-chain из installExtraData).
//
// Фикстура — chairman кооператива `ant` (Иван Иванов).

import { loginAsChairman, dismissOnboardingDialogs, pickBranchIfAsked } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Сеть ПВЗ: реестр кооперативных участков',
  docPath: 'new/marketplace/admin/issuance-points.md',
  assetsDir: 'assets/new/marketplace/admin/issuance-points',
  role: 'chairman',
};

export default async ({ page, context, shot, expect, env }) => {
  await loginAsChairman(page, context);
  // Диалог выбора участка платформа показывает и председателю: пока он висит,
  // клики уходят в него, а не в страницу.
  await pickBranchIfAsked(page);
  await dismissOnboardingDialogs(page);

  // 1. Открыть страницу «Кооперативные участки»
  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/chairman/settings/branches`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Кооперативные участки', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  await dismissOnboardingDialogs(page);
  await shot(page, '01-pvz-network', 'Реестр кооперативных участков: председатель видит карту сети ПВЗ из трёх участков Подмосковья — Красногорск, Одинцово, Мытищи. У каждого КУ свой председатель, контактные данные и документ-основание создания.');

  // 2. Открыть диалог «Создать кооперативный участок» для документации UX
  await page.locator('button:has-text("добавить участок")').click();
  await page.waitForSelector('text=Создать кооперативный участок', { timeout: 15000 });
  await page.waitForTimeout(500);
  await shot(page, '02-dialog-empty', 'Диалог «Создать кооперативный участок»: пустая форма с обязательными полями — председатель участка, наименование, телефон, фактический адрес, email и документ-основание (решение совета).');

  // 3. Заполнить демо-полями (новый КУ Подольск — не сохраняем, только показываем UX).
  // Автокомплит ищет по ФИО из реестра пайщиков, поэтому вводим фамилию —
  // ввод ника отдавал «Ничего не найдено» и кадр выходил пустым.
  const trusteeField = page.locator('label:has-text("Председатель участка")').locator('input').first();
  await trusteeField.click();
  await trusteeField.type('Зайцева', { delay: 60 });
  const suggestion = page.locator('.q-menu .q-item:has-text("Зайцева")').first();
  await suggestion.waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(400);
  await shot(page, '03-autocomplete-chairman', 'Поле «Председатель участка» — поиск по фамилии в реестре пайщиков: подсказка показывает ФИО и аккаунт. Председателем добавляемого участка назначается любой пайщик кооператива.');

  // Выбираем пайщика и наполняем остальные поля — форма в кадре должна быть
  // рабочей, а не пустой. Сабмита не будет: диалог закроется Escape.
  await suggestion.click();
  await page.waitForTimeout(400);
  const fillField = async (label, value) => {
    const inp = page.locator(`label:has-text("${label}")`).locator('input').first();
    await inp.click();
    await inp.fill(value);
    await page.waitForTimeout(200);
  };
  await fillField('Наименование участка', 'Подольск');
  await fillField('Номер телефона участка', '+7 (999) 123-04-04');
  await fillField('Фактический адрес участка', 'Московская область, г. Подольск, Революционный проспект, д. 18');
  await fillField('Email-адрес участка', 'pdl@voskhod.coop');
  await fillField('Председатель действует на основании', 'решение собрания совета №СС-2 от 15 августа 2026 г');
  await page.waitForTimeout(400);
  await shot(page, '03b-form-filled', 'Заполненная форма добавления участка: председатель выбран из реестра пайщиков, указаны наименование, контакты и документ-основание — решение совета, которым участок создан юридически.');

  // 4. Закрываем диалог без сабмита (КУ уже on-chain из installExtraData)
  await page.keyboard.press('Escape');
  await page.locator('text=Создать кооперативный участок').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(600);

  // 5. Развернуть Красногорск — детали с реквизитами, председатель, доверенные лица
  const krgRow = page.locator('tr:has-text("Красногорск")').first();
  await krgRow.locator('button, .q-btn').first().click().catch(() => {});
  await page.waitForTimeout(900);
  await shot(page, '04-branch-details', 'Развёрнутая карточка Красногорск: реквизиты участка, председатель Иванов Пётр Сергеевич (chairkrg), доверенные лица — Петров Михаил Андреевич (trustedkrg) и Кузнецов Александр Владимирович (opkrg). Доверенные имеют расширенные права на участке (приёмка, выдача, маркировка).');
};
