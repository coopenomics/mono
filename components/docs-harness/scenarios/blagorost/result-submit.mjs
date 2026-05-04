// Сценарий: «Внести результат» — отдельный pre-submit-кадр для results.md.
//
// Готовится через seed-фазы 01..12 (без 13!) — компонент в статусе READY:
// голоса рассчитаны (`is_votes_calculated=true`), сегменты статуса READY.
// На странице «Результаты» в строке своего сегмента пайщик видит кнопку
// «Внести результат» (PushResultButton). После её нажатия pushresult
// отправляется on-chain.
//
// Кадры:
//   pre-submit          — страница «Результат» до внесения: видна кнопка
//                         «Внести результат» в строке текущего пайщика.
//
// Кадр после клика (с диалогом signact1) сейчас не снимается — для прохождения
// pushresult у пайщика должен быть полностью индексированный appendix-clearance,
// а parser теряет половину дельт capital::appendixes (см. #56). Дальнейшие
// шаги (signact1 / решение совета / signact2) описаны в md текстом.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { loginAs, dismissOnboardingDialogs } from '../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadFixture(username) {
  return JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../state/participants/${username}.json`), 'utf8'),
  );
}

const COMPONENT_HASH = createHash('sha256').update('blago:project:49').digest('hex');

export const meta = {
  title: 'Внести результат и подписать акт',
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
    // НЕ запускаем 13 — нужен READY-статус для снятия кадра «до внесения».
  ],
};

async function clearNotifications(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.q-notification').forEach((n) => n.remove());
    document.querySelectorAll('.q-notifications__list > *').forEach((n) => n.remove());
  });
}

export default async ({ page, shot, env }) => {
  const fixture = loadFixture('ivanpetrov');
  await loginAs(page, fixture);
  await dismissOnboardingDialogs(page);

  await page.goto(
    `${env.BASE_URL}/${env.COOPNAME}/capital/components/${COMPONENT_HASH}/results`,
    { waitUntil: 'domcontentloaded' },
  );
  await page.waitForSelector('text=Стоимость ОАП', { timeout: 60000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await clearNotifications(page);
  await page.waitForTimeout(800);

  // Прокрутим страницу к строке своего сегмента — кнопка «Внести результат»
  // отрисовывается только в строке текущего пайщика, и она не помещается
  // в стартовый viewport.
  const submitBtn = page.locator('button:has-text("Внести результат")').first();
  await submitBtn.waitFor({ state: 'visible', timeout: 10000 });
  await submitBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  await shot(
    page,
    'pre-submit',
    'Страница «Результат» компонента «MVP v1» сразу после расчёта голосов (статус сегментов READY): в строке своего сегмента пайщик видит кнопку «Внести результат». Это запуск on-chain transaction `capital::pushresult` — сегмент перейдёт в AUTHORIZED и потребует подписи Акта приёма-передачи РИД (signact1).',
  );
};
