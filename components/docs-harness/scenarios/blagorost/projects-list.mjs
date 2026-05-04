// Сценарий: Мастерская — список проектов и компонентов в Благоросте.
//
// Один из «фундаментных» скриншотов всей документации Благороста, заодно
// служит демонстрацией — что вообще делают участники кооператива (видны
// настоящие проекты из _blago/INDEX.md, а не Project-1/Project-2).
//
// До запуска harness через `bin/shoot.mjs blagorost/projects-list` нужны:
//  - reboot:extra или живая локальная цепочка с председателем `ant` и советом
//  - prepare-фазы (см. meta.prepare ниже) — наполняют CAPITAL проектами
//
// Идемпотентно: повторный прогон без --reboot переиспользует уже созданные
// проекты (хеши детерминированные через sha256 от seed_id).

import { loginAsChairman } from '../../lib/harness.mjs';

export const meta = {
  title: 'Мастерская: список проектов',
  docPath: 'new/blagorost/projects-list.md',
  assetsDir: 'assets/new/blagorost/projects-list',
  role: 'chairman',
  fixture: 'ant',
  prepare: [
    'capital:01-programs',
    'capital:02-extension-config',
    'capital:03-projects',
    'capital:04-contributor',
  ],
};

export default async ({ page, context, shot, env }) => {
  // --- Шаг 1. Логин председателя ---
  await loginAsChairman(page, context);

  // На чистой цепочке после reboot первый вход показывает каскад модалок-документов
  // (положение о ЦПП Кошелёк, ЭП, пользовательское соглашение, плюс возможно
  // капитал-документы, которые ant подписал программно через phase-04, но UI всё
  // равно проводит через формальный read-and-sign на стороне клиента). Закрываем
  // их все нативным DOM-кликом на «Подписать» — Playwright actionability-check
  // не пробивает pointer-events текста документа. Цикл с запасом до 12 итераций.
  for (let i = 0; i < 12; i++) {
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
    await page.waitForTimeout(3500); // signing → blockchain confirm → next dialog
  }

  // --- Шаг 2. Переход в Мастерскую ---
  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/capital/projects`, { waitUntil: 'domcontentloaded' });

  // ProjectsListWidget данные тянет через GraphQL → controller; cooparser
  // должен успеть проиндексировать transactions из prepare-фаз. На холодной
  // системе после 42 createproject индексация занимает несколько секунд —
  // ждём появления одного из мета-проектов в DOM.
  const knownTitle = 'Приложение «Стол Заказов»';
  await page.waitForSelector(`text=${knownTitle}`, { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

  // Тосты онбординга (если председатель сюда впервые) выглядят как мусор
  // на инструктивном скриншоте — убираем.
  await page.evaluate(() => {
    document.querySelectorAll('.q-notification').forEach((n) => n.remove());
    document.querySelectorAll('.q-notifications__list > *').forEach((n) => n.remove());
  });
  await page.waitForTimeout(500);

  await shot(
    page,
    '01-projects-list',
    'Мастерская: список мета-проектов и компонентов с человеческими названиями (источник — _blago/INDEX.md). Председатель видит FAB «создать проект» в правом нижнем углу.',
  );
};
