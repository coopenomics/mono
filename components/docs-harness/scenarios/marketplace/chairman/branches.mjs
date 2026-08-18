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

  // 3. Заполнить демо-полями (новый КУ Подольск — не сохраняем, только показываем UX)
  const trusteeField = page.locator('label:has-text("Председатель участка")').locator('input').first();
  await trusteeField.click();
  await trusteeField.fill('chairkrg');
  await page.locator('.q-menu .q-item:has-text("chairkrg")').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  // Для демо-кадра достаточно показать как выпадает autocomplete; не выбираем чтобы не сабмитить
  await page.waitForTimeout(400);
  await shot(page, '03-autocomplete-chairman', 'Поле «Председатель участка» — поиск пайщика-председателя через автокомплит: при вводе ника появляется выпадающий список с результатами из реестра пайщиков. Это та же логика, что и в любой форме выбора пайщика по платформе.');

  // 4. Закрываем диалог без сабмита (КУ уже on-chain из installExtraData)
  await page.keyboard.press('Escape');
  await page.locator('text=Создать кооперативный участок').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(600);

  // 5. Развернуть КУ Красногорск — детали с реквизитами, председатель, доверенные лица
  const krgRow = page.locator('tr:has-text("КУ Красногорск")').first();
  await krgRow.locator('button, .q-btn').first().click().catch(() => {});
  await page.waitForTimeout(900);
  await shot(page, '04-branch-details', 'Развёрнутая карточка КУ Красногорск: реквизиты участка, председатель Иванов Пётр Сергеевич (chairkrg), доверенные лица — Петров Михаил Андреевич (trustedkrg) и Кузнецов Александр Владимирович (opkrg). Доверенные имеют расширенные права на участке (приёмка, выдача, маркировка).');
};
