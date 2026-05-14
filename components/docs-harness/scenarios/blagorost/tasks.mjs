// Сценарий: «Задачи компонента» — Agile-доска и работа над задачами.
//
// Снимаемые кадры:
//   01-board                — список задач компонента (мастер): id, оценка,
//                              приоритет, статус, исполнитель в каждой строке;
//   02-create-dialog        — диалог «Создать задачу» (заполнен мастером);
//   03-sidebar-master       — правая панель открытой задачи у мастера: видны
//                              кнопки SET_DONE / SET_ESTIMATE / приоритет;
//   04-sidebar-executor     — та же задача глазами исполнителя (ivanpetrov):
//                              недоступны DONE/ESTIMATE/PRIORITY; есть только
//                              переход в ON_REVIEW;
//   05-tracker-tickets      — страница «Моё время» исполнителя ekaterina:
//                              видна задача без estimate с тикающими часами.
//
// prepare: стандартный pipeline до фазы 09 — задачи уже посеяны.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { loginAs, loginAsChairman, dismissOnboardingDialogs } from '../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadFixture(username) {
  return JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../state/participants/${username}.json`), 'utf8'),
  );
}

const COMPONENT_HASH = createHash('sha256').update('blago:project:49').digest('hex');

export const meta = {
  title: 'Задачи компонента',
  docPath: 'new/blagorost/tasks.md',
  assetsDir: 'assets/new/blagorost/tasks',
  role: 'chairman',
  fixture: 'ant',
  fixtures: ['ivanpetrov', 'ekaterina'],
  prepare: [
    'capital:01-programs',
    'capital:02-extension-config',
    'capital:04-contributor',
    'capital:05-additional-contributors',
    'capital:06-create-project-koshelek',
    'capital:07-master-and-plan',
    'capital:07b-clearance-all',
    'capital:09-tasks',
  ],
};

async function clearNotifications(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.q-notifications, .q-notification__list').forEach((n) => n.remove());
  });
}

// После каждой навигации в /capital/... может всплывать persistent-диалог
// «Прочитайте и подпишите» (политика Capital-extension'а на свежей цепочке).
// Удаляем по DOM (паттерн artifacts.mjs).
async function killPersistentSignDialog(page) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    document.querySelectorAll('[id^="q-portal--dialog--"]').forEach((p) => {
      if (p.textContent?.includes('Прочитайте и подпишите')) p.remove();
    });
  });
  await page.waitForTimeout(500);
}

// Финальная зачистка прямо перед screenshot — на случай если sign-диалог
// перерисовался Vue-реактивностью между killPersistentSignDialog и shot.
async function nukePersistentRightBeforeShot(page) {
  await page.evaluate(() => {
    document.querySelectorAll('[id^="q-portal--dialog--"]').forEach((p) => {
      if (p.textContent?.includes('Прочитайте и подпишите')) p.remove();
    });
  });
}

// Закрывает любые открытые в данный момент Quasar-диалоги (по Esc + DOM-removal на портале).
async function closeAnyDialog(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    document.querySelectorAll('[id^="q-portal--dialog--"]').forEach((p) => p.remove());
  });
  await page.waitForTimeout(200);
}

export default async ({ page, context, shot, env }) => {
  const browser = context.browser();
  // ============================================================================
  // КАДР 1. Доска задач компонента (вид мастера)
  // ============================================================================
  await loginAsChairman(page, context);
  // ВАЖНО: НЕ зовём dismissOnboardingDialogs — на свежей цепочке для ant
  // он уходит в 60-сек ожидание Loader'а и блокирует тест. Вместо подписания
  // удаляем диалоги в DOM сразу после navigation (паттерн artifacts.mjs).
  // Базовые agreements (wallet/signature/privacy/user) уже отмечены *_done=true
  // в seed-фазе 02-extension-config (dev-shortcut), но Capital extension
  // отдельно показывает «Прочитайте и подпишите» при первом входе в /capital/...
  await page.goto(
    `${env.BASE_URL}/${env.COOPNAME}/capital/components/${COMPONENT_HASH}/tasks`,
    { waitUntil: 'domcontentloaded' },
  );
  await killPersistentSignDialog(page);
  // Ждём загрузки списка задач — должна появиться хоть одна посеянная.
  await page.waitForSelector('text=Поднять Vue-каркас', { timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  await clearNotifications(page);

  await shot(
    page,
    '01-board',
    'Доска задач компонента «MVP v1» у мастера: четыре задачи (две DONE, две IN_PROGRESS). В строке слева — иконка приоритета, номер id и компактный чип времени (факт/план); по центру — название с метками; справа — chip статуса и стопка аватарок исполнителей.',
  );

  // ============================================================================
  // КАДР 2. Диалог «Создать задачу» (заполнен мастером)
  // ============================================================================
  // FAB-action открывается hotkey'ем T (см. capital-fab-hotkeys.ts).
  await page.keyboard.press('KeyT');
  await page.waitForTimeout(1000);

  // Заполняем поля диалога — title, description, estimate. Селекторы по label.
  await page.locator('label:has-text("Название задачи") input').first().fill('Новая задача — пример заполнения').catch(() => {});
  await page.locator('label:has-text("Описание задачи") textarea').first().fill('Краткое описание. На этом этапе исполнители не задаются — назначим позже на странице задачи.').catch(() => {});
  await page.locator('label:has-text("Оценка (часы)") input').first().fill('8').catch(() => {});

  await page.waitForTimeout(500);
  await nukePersistentRightBeforeShot(page);
  await clearNotifications(page);
  await shot(
    page,
    '02-create-dialog',
    'Диалог «Создать задачу» с заполненными полями: «Название задачи», «Описание задачи», «Приоритет», «Статус», «Оценка (часы)» 8. Исполнители на этом этапе не указываются — назначаются позже на самой задаче',
  );

  await closeAnyDialog(page);

  // ============================================================================
  // КАДР 3. Sidebar задачи у МАСТЕРА (ant)
  // ============================================================================
  // Кликаем на задачу в IN_PROGRESS (Документация модулей) — там наглядно видно
  // активный набор кнопок мастера: SET_DONE, SET_ESTIMATE, SET_PRIORITY, переходы.
  await page.locator('text=Документация модулей').first().click();
  await page.waitForTimeout(800);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await clearNotifications(page);
  await shot(
    page,
    '03-sidebar-master',
    'Страница задачи «Документация модулей» у мастера: статус IN_PROGRESS, доступны переходы в DONE и CANCELED, поле оценки редактируется, можно переназначить исполнителя и ответственного',
  );

  // Запоминаем URL открытой задачи — переоткроем её под исполнителем.
  const issueUrl = page.url();

  // ============================================================================
  // КАДР 4. Тот же sidebar у ИСПОЛНИТЕЛЯ (ivanpetrov)
  // ============================================================================
  const ivanCtx = await browser.newContext({ viewport: { width: 1120, height: 800 }, deviceScaleFactor: 1.25 });
  const ivanPage = await ivanCtx.newPage();
  const ivan = loadFixture('ivanpetrov');
  await loginAs(ivanPage, ivan);
  await ivanPage.goto(issueUrl, { waitUntil: 'domcontentloaded' });
  await killPersistentSignDialog(ivanPage);
  await ivanPage.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await ivanPage.waitForTimeout(2000);
  await nukePersistentRightBeforeShot(ivanPage);
  await clearNotifications(ivanPage);
  await shot(
    ivanPage,
    '04-sidebar-executor',
    'Та же задача глазами исполнителя ivanpetrov: статус IN_PROGRESS, доступен переход только в ON_REVIEW; кнопки изменения оценки, приоритета и переназначения скрыты или серые',
  );
  await ivanCtx.close();

  // ============================================================================
  // КАДР 5. «Моё время» у ekaterina — задача без estimate с тикающими часами
  // ============================================================================
  const ekaCtx = await browser.newContext({ viewport: { width: 1120, height: 800 }, deviceScaleFactor: 1.25 });
  const ekaPage = await ekaCtx.newPage();
  const eka = loadFixture('ekaterina');
  await loginAs(ekaPage, eka);
  await ekaPage.goto(`${env.BASE_URL}/${env.COOPNAME}/capital/tracker`, { waitUntil: 'domcontentloaded' });
  await killPersistentSignDialog(ekaPage);
  // Ждём пока строка проекта появится в табличке tracker'а — это маркер
  // что мы дошли до /capital/tracker и контент отрендерился.
  await ekaPage.waitForSelector('text=MVP v1', { timeout: 60000 });
  await ekaPage.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await ekaPage.waitForTimeout(2000);
  await nukePersistentRightBeforeShot(ekaPage);
  await clearNotifications(ekaPage);
  await shot(
    ekaPage,
    '05-tracker-tickets',
    'Страница «Моё время» у ekaterina: внутри проекта MVP v1 видна задача без estimate «Исследование альтернативных адаптеров кошелька» с накопленными часами по почасовому начислению',
  );
  await ekaCtx.close();
};
