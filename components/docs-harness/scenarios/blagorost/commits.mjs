// Сценарий: «Моё время» — диалог фиксации коммита.
//
// Логин ivanpetrov → /capital/tracker → разворачивает проект «MVP v1»,
// нажимает кнопку «Коммит» → открывается диалог со звёздочками-отзывом и
// полем «Отзыв» — это и есть главный кадр для прозы.
//
// prepare:
//   capital:01-programs / 02-extension-config / 04-contributor / 05-additional-contributors /
//   06-create-project-koshelek / 07-master-and-plan / 09-tasks
//
// Фаза 09 создаёт задачи в DONE для ivanpetrov с estimate=8 ч — после неё
// available_hours проекта «MVP v1» = 8 ч, кнопка «Коммит» активна.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loginAs, dismissOnboardingDialogs } from '../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../state/participants/ivanpetrov.json'), 'utf8'),
);

export const meta = {
  title: 'Моё время: фиксация коммита',
  docPath: 'new/blagorost/commits.md',
  assetsDir: 'assets/new/blagorost/commits',
  role: 'participant',
  fixture: FIXTURE.username,
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

export default async ({ page, shot, env }) => {
  // --- Логин пайщика ---
  await loginAs(page, FIXTURE);
  await dismissOnboardingDialogs(page);

  // --- Открываем «Моё время» ---
  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/capital/tracker`, { waitUntil: 'domcontentloaded' });

  // Ждём пока проект «MVP v1» появится в списке (с available_hours).
  await page.waitForSelector('text=MVP v1', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

  // Чистим тосты онбординга — они уезжают в правый верхний угол.
  await page.evaluate(() => {
    document.querySelectorAll('.q-notification').forEach((n) => n.remove());
    document.querySelectorAll('.q-notifications__list > *').forEach((n) => n.remove());
  });
  await page.waitForTimeout(500);

  // --- Кадр 1: общий вид «Моё время» ---
  // Свёрнутый проект «MVP v1» с тремя счётчиками часов и активной кнопкой «Коммит».
  // Не разворачиваем его и не кликаем по строке — иначе click попадает на саму
  // кнопку «Коммит» (она внутри tr), и диалог открывается преждевременно.
  await shot(
    page,
    '01-tracker',
    'Страница «Моё время»: проект «MVP v1» с тремя счётчиками часов — Доступно (8 ч от выполненных задач), В ожидании, Подтверждено. Кнопка «Коммит» активна.',
  );

  // --- Кадр 2: диалог фиксации коммита ---
  // Кнопка «Коммит» — на уровне строки проекта, справа в шапке.
  const commitBtn = page.locator('button', { hasText: 'Коммит' }).first();
  await commitBtn.click();

  // Ждём пока модалка раскроется — заголовок «Зафиксировать взнос».
  await page.waitForSelector('text=Зафиксировать взнос', { timeout: 15000 });
  await page.waitForTimeout(800);

  await shot(
    page,
    '02-commit-dialog',
    'Диалог «Зафиксировать взнос»: компонент проекта, время и себестоимость, шкала «Удовлетворение результатом» (звёздочки) и поле «Отзыв» — отзыв уходит мастеру и виден только ему.',
  );
};
