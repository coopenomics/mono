// Сценарий: председатель настраивает доступные категории кооператива.
//
// Модель (Эпик 16): есть базовые категории платформы и собственные категории
// кооператива. Пока не выключена ни одна — «открыт весь каталог», предложения
// можно публиковать в любой категории. Выключение категории ограничивает
// список; базовые категории нельзя удалить, только выключить.
//
// Backend — available-category-admin.resolver.ts (@AuthRoles chairman);
// маршрут стола требует грант `Whitelist:manage`.
//
// Фикстура: председатель кооператива (ant, Иванов Иван Иванович).

import { loginAsChairman, pickBranchIfAsked } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Доступные категории кооператива',
  docPath: 'new/marketplace/admin/categories.md',
  assetsDir: 'assets/new/marketplace/admin/categories',
  role: 'chairman',
  mode: 'docs',
  feature: 'marketplace.categories',
  cases: ['mkt.cat.happy.01', 'mkt.cat.happy.02'],
  prepare: ['marketplace:01-l1-accept'],
};

export default async ({ page, shot, expect, env, context }) => {
  await loginAsChairman(page, context);
  // Диалог выбора участка платформа показывает и председателю: пока он висит,
  // клики уходят в него, а не в страницу.
  await pickBranchIfAsked(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-admin/category-whitelist`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('text=Доступные категории', { timeout: 60000 });
  // Диалог участка платформа поднимает уже после перехода на страницу —
  // закрываем его здесь, иначе он перехватит клики по таблице.
  await pickBranchIfAsked(page);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(900);

  // Реестр категорий обязан быть непустым: базовые категории заводит платформа,
  // и пустая таблица означала бы, что справочник не доехал, а не «их нет».
  const rows = page.locator('tbody tr, .q-table tbody tr');
  await expect(rows.first()).toBeVisible({ timeout: 15000 });
  const total = await rows.count();
  expect(total).toBeGreaterThan(0);

  await shot(
    page,
    '01-overview',
    'Страница «Доступные категории» Стола администратора. Пока не выключена ни одна категория, вверху написано «Открыт весь каталог» — пайщики могут публиковать предложения в любой категории. У базовых категорий вид «Базовая»: их нельзя удалить, только выключить тумблером справа.',
    {
      expect: async (p) => {
        await expect(p.locator('text=Открыт весь каталог').first()).toBeVisible({ timeout: 10000 });
      },
    },
  );

  // Выключение категории — то самое ограничение каталога, ради которого экран
  // и существует. Проверяем именно смену состояния, а не факт клика.
  // Тумблер берём в строке таблицы: первым на странице идёт переключатель
  // темы в шапке, и клик по нему просто перекрашивает интерфейс.
  const firstToggle = page.locator('tbody tr .q-toggle, .q-table tbody tr .q-toggle').first();
  // Диалог участка всплывает асинхронно и может подняться уже после первого
  // кадра — проверяем непосредственно перед взаимодействием с таблицей.
  await pickBranchIfAsked(page, { timeout: 4000 });
  // force: диалог платформы успевает перерисоваться поверх таблицы между
  // проверкой и кликом, а ждать его исчезновения бесполезно — он возвращается.
  await firstToggle.click({ force: true });
  await page.waitForTimeout(2500);
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

  await shot(
    page,
    '02-category-off',
    'После выключения категории каталог перестаёт быть открытым: подпись вверху меняется на ограниченный список, и опубликовать предложение в выключенной категории уже нельзя. Вернуть категорию можно тем же тумблером.',
    {
      expect: async (p) => {
        await expect(p.locator('text=Открыт весь каталог')).toHaveCount(0, { timeout: 10000 });
      },
    },
  );

  // Возвращаем состояние: сценарий не должен оставлять стенд с урезанным
  // каталогом — на нём дальше публикуется предложение поставщика.
  await firstToggle.click({ force: true });
  await page.waitForTimeout(2500);
  await expect(page.locator('text=Открыт весь каталог').first()).toBeVisible({ timeout: 10000 });
};
