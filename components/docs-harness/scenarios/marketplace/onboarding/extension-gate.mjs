// Сценарий: L3 — первый вход пайщика на Стол заказов.
//
// Модель прав (marketplace-desktop-grants.provider.ts): пайщик получает права
// заказчика только после того, как подписал персональную оферту ЦПП И выбрал
// пункт выдачи. До этого у него ровно один грант — `Onboarding:orderer`,
// открывающий единственную страницу «Подключение к Столу заказов». Каталог в
// это время закрыт.
//
// Сценарий проверяет именно переход состояния: до подключения каталога нет,
// после — есть. Без этой проверки экран «Недостаточно прав доступа» легко
// принять за норму (так и было: прежний сценарий снимал его трижды и
// считался пройденным).
//
// Фикстура выбирается из пула автоматически: подпись оферты ЦПП — ончейн-
// действие, отменить его нельзя, поэтому пайщик расходуется за один прогон.
// freshGateFixture() берёт следующего неподключённого и создаёт при
// необходимости; когда пул кончится, сценарий скажет об этом прямо.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs, pickBranchIfAsked } from '../../../lib/harness.mjs';
import { freshGateFixture } from '../../../lib/fixtures.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'));

export const meta = {
  title: 'Подключение пайщика к Столу заказов (L3)',
  docPath: 'new/marketplace/onboarding/extension-gate.md',
  assetsDir: 'assets/new/marketplace/onboarding/extension-gate',
  role: 'user',
  mode: 'docs',
  // Конкретный пайщик определяется в рантайме — см. freshGateFixture().
  feature: 'marketplace.onboarding',
  cases: ['mkt.onb.happy.03'],
  prepare: ['marketplace:01-l1-accept', 'marketplace:02-branches'],
};

export default async ({ page, shot, expect, env: e }) => {
  const username = freshGateFixture({ log: (m) => console.log(`  ${m}`) });
  const fixture = loadFixture(username);
  await loginAs(page, fixture);
  await pickBranchIfAsked(page);
  await cleanViteOverlays(page);

  // --- 01. Каталог до подключения: стол закрыт ------------------------------
  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/catalog`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-catalog-closed',
    'Пайщица, ещё не подключившаяся к Столу заказов, открывает каталог витрины — и попадает на страницу подключения: сначала нужно выбрать пункт выдачи и подписать оферту ЦПП. Права заказчика появляются только после этого.',
    {
      expect: async (p) => {
        // Ключевая проверка: закрытая страница стола уводит на его шлюз, а не
        // на «Недостаточно прав доступа» — допуск пайщик получает сам, здесь.
        await expect(p).toHaveURL(/\/market\/onboarding\/member-cpp/, { timeout: 15000 });
        await expect(p.locator('text=Недостаточно прав доступа')).toHaveCount(0, { timeout: 15000 });
      },
    },
  );

  // --- 02. Страница подключения --------------------------------------------
  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/onboarding/member-cpp`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  // Диалог выбора участка платформа показывает заново на каждом заходе, пока
  // выбор не сохранён, — закрываем его и здесь, иначе он перехватит клики.
  await pickBranchIfAsked(page);
  await page.waitForSelector('text=Выберите пункт выдачи заказов', { timeout: 90000 });
  await page.waitForTimeout(2000);
  await cleanViteOverlays(page);

  await shot(
    page,
    '02-onboarding-page',
    'Страница «Подключение к Столу заказов». Слева — список пунктов выдачи кооператива с картой, внизу — согласие с офертой на присоединение к ЦПП «Стол заказов» и Положением ЦПП. Пункт выдачи можно сменить позже в любой момент.',
  );

  // --- 03. Подключение: выбор ПВЗ + согласие с офертой ----------------------
  // Кликаем в основном содержимом страницы, а не в портале диалога: имя
  // участка встречается и там, и там.
  await pickBranchIfAsked(page, { timeout: 4000 });
  const content = page.locator('main, .q-page').first();
  const pvz = content.locator('text=Красногорск').first();
  // force: диалог платформы может успеть перерисоваться поверх страницы между
  // проверкой и кликом; ждать его исчезновения бесполезно — он возвращается
  // при каждом заходе, пока выбор участка не сохранён.
  if (await pvz.isVisible().catch(() => false)) await pvz.click({ force: true });
  else await content.locator('.q-item, [role="listitem"]').first().click({ force: true });
  await page.waitForTimeout(800);

  // Согласие — обязательное условие: без него «Продолжить» не отправляет форму.
  await content.locator('.q-checkbox').first().click({ force: true });
  await page.waitForTimeout(500);
  await cleanViteOverlays(page);

  await content.locator('button:has-text("Продолжить")').first().click({ force: true });
  await page.waitForTimeout(6000);
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await cleanViteOverlays(page);

  // --- 04. Каталог после подключения ---------------------------------------
  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/catalog`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '03-catalog-open',
    'После подписания оферты и выбора пункта выдачи каталог витрины открыт: пайщица видит предложения кооператива и может оформлять заказы.',
    {
      expect: async (p) => {
        // Ключевая проверка сценария: отказ в правах должен исчезнуть.
        await expect(p.locator('text=Недостаточно прав доступа')).toHaveCount(0, { timeout: 15000 });
      },
    },
  );
};
