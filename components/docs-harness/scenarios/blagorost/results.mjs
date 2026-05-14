// Сценарий: «Результат и получение доли» — вкладка results карточки компонента.
//
// Логин ivanpetrov → /capital/components/<MVP_HASH>/results → видит таблицу
// сегментов после внесения результатов мастером (статусы CONTRIBUTED).
// На своей строке у него активна кнопка «Получить долю в ОАП», которая
// открывает диалог конвертации направлений со слайдером
// «Главный Кошелёк ↔ Программа Благорост».
//
// prepare:
//   01..12 — стандартный пайплайн до состояния «голосование рассчитано» (RESULT)
//   13-push-result — pushresult + soviet approve+vote+exec + signact1 + signact2
//                    для каждого сегмента; статусы CONTRIBUTED, можно конвертировать.
//
// Без фазы 14 (convertsegm) — иначе сегменты уйдут в FINALIZED и кнопка
// «Получить долю» исчезнет.
//
// Кадры:
//   01-overview        — общий вид страницы «Результат» (ColorCards + таблица сегментов)
//   02-convert-dialog  — открытый ConvertSegmentDialog со слайдером
//                        Главный Кошелёк ↔ Программа Благорост

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { loginAs, dismissOnboardingDialogs } from '../../lib/harness.mjs';

// Путь к фикстуре зашит в комментарии regex'ом в meta.prepare-парсере shoot.mjs
// (state/participants/ivanpetrov.json) — поэтому orchestrator её создаст
// до runPrepare. Сам файл читаем лениво в default() — иначе модуль падает
// при импорте на свежем reboot, когда фикстуры ещё нет.
//
// fixture-source: state/participants/ivanpetrov.json

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Хеш компонента «MVP v1» — детерминированный, такой же как в seed-фазах.
const COMPONENT_HASH = createHash('sha256').update('blago:project:49').digest('hex');

export const meta = {
  title: 'Результат и получение доли',
  docPath: 'new/blagorost/results.md',
  assetsDir: 'assets/new/blagorost/results',
  role: 'participant',
  fixture: 'ivanpetrov',
  fixtures: ['ivanpetrov', 'ekaterina'],
  prepare: [
    'capital:01-programs',
    'capital:02-extension-config',
    'capital:04-contributor',
    'capital:05-additional-contributors',
    'capital:06-create-project-koshelek',
    'capital:07-master-and-plan',
    'capital:07b-clearance-all',
    'capital:08-investments',
    'capital:09-tasks',
    'capital:10-commits-and-voting',
    'capital:11-cast-votes',
    'capital:12-recalc-and-calc-votes',
    'capital:13-push-result',
  ],
};

function loadFixture(username) {
  return JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../state/participants/${username}.json`), 'utf8'),
  );
}

async function clearNotifications(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.q-notification').forEach((n) => n.remove());
    document.querySelectorAll('.q-notifications__list > *').forEach((n) => n.remove());
  });
}

export default async ({ page, shot, env }) => {
  const fixture = loadFixture('ivanpetrov');

  // --- Логин пайщика ---
  await loginAs(page, fixture);
  await dismissOnboardingDialogs(page);

  // --- Открываем страницу результатов компонента ---
  await page.goto(
    `${env.BASE_URL}/${env.COOPNAME}/capital/components/${COMPONENT_HASH}/results`,
    { waitUntil: 'domcontentloaded' },
  );

  // Ждём пока загрузится содержимое страницы — должна появиться карточка
  // «Стоимость ОАП» (один из ColorCards в шапке).
  await page.waitForSelector('text=Стоимость ОАП', { timeout: 60000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await clearNotifications(page);
  await page.waitForTimeout(800);

  // --- Кадр 1: общий вид страницы «Результат» ---
  // Видны: три ColorCards с агрегатами (Стоимость Генерации / Стоимость
  // Благороста / Стоимость ОАП с процентом), список сегментов всех участников
  // с детализацией стоимости (Генерация / Благорост / Всего), для текущего
  // пайщика — кнопка «Получить долю в ОАП» / FAB «Принять участие».
  await shot(
    page,
    '01-overview',
    'Страница «Результат» компонента «MVP v1»: ColorCards с агрегатами по проекту (Стоимость Генерации / Стоимость Благороста / Стоимость ОАП) и список сегментов с участниками после внесения результатов мастером.',
  );

  // --- Кадр 2: открытый ConvertSegmentDialog со слайдером ---
  // Нажимаем «Получить долю в ОАП» — открывается диалог с заголовком
  // «Получить долю в объекте авторских прав» и слайдером Главный Кошелёк ↔
  // Программа Благорост.
  const convertBtn = page.locator('button:has-text("Получить долю в ОАП")').first();
  await convertBtn.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  await convertBtn.click().catch(() => {});
  await page.waitForSelector('text=Получить долю в объекте авторских прав', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
  await shot(
    page,
    '02-convert-dialog',
    'Диалог «Получить долю в объекте авторских прав»: карточка «Всего к получению», слайдер «Главный Кошелек ↔ Программа Благорост» и кнопка «Получить» — пайщик выбирает, какая часть доли уйдёт деньгами в Главный Кошелёк, какая останется капитализацией в программе Благорост.',
  );
};
