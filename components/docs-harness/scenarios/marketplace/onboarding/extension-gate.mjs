// Сценарий: Onboarding L3 — гейт первого входа на Стол заказов.
// Цель: показать реальный UX свежей пайщицы Екатерины при первом посещении
// marketplace. Снимаем последовательно: стартовый экран после логина (стек
// диалогов соглашений), попытку открыть /market/catalog до подписания
// соглашений и итоговое состояние после подписания всех соглашений.
//
// Фикстура: ekaterina / Екатерина Александровна Смирнова — создаётся
// автоматически через bin/shoot.mjs (KNOWN_FIXTURES) при первом прогоне.
// Если фикстура уже есть на стенде с раннего сценария — гейт пройти не
// получится (она уже подписала всё). Тогда лучше прогнать с --reboot.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'),
  );

export const meta = {
  title: 'Онбординг L3 — гейт первого входа на Стол заказов',
  docPath: 'new/marketplace/onboarding/extension-gate.md',
  assetsDir: 'assets/new/marketplace/onboarding/extension-gate',
  role: 'user',
  fixture: 'ekaterina',
  fixtures: ['ekaterina'],
};

// Снимает один диалог подписания: возвращает {present, title} —
// если диалога нет, present=false; если есть — present=true и заголовок диалога.
async function inspectTopDialog(page) {
  return page.evaluate(() => {
    const portals = Array.from(document.querySelectorAll('[id^="q-portal--dialog--"]'))
      .filter((p) => getComputedStyle(p).display !== 'none');
    if (portals.length === 0) return { present: false };
    const top = portals[portals.length - 1];
    // q-card-section с заголовком обычно идёт первой
    const titleEl = top.querySelector('.q-card-section .text-h6, .q-card-section h6, .text-h6');
    const title = titleEl?.textContent?.trim()
      ?? top.querySelector('.q-card-section')?.textContent?.trim()?.slice(0, 80)
      ?? '';
    const hasSignButton = Array.from(top.querySelectorAll('button'))
      .some((b) => b.textContent?.trim() === 'Подписать' && !b.disabled);
    return { present: true, title, hasSignButton };
  });
}

// Подписать один верхний диалог; возвращает true если кликнул.
async function signOneDialog(page) {
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
  if (clicked) await page.waitForTimeout(3500);
  return clicked;
}

export default async ({ page, shot }) => {
  const fixture = loadFixture('ekaterina');

  await loginAs(page, fixture);
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));

  // Дать UI собрать первый диалог (формируем документ → готовый PDF).
  await page.waitForFunction(
    () => !document.body.innerText.includes('Формируем документ'),
    { timeout: 30000 },
  ).catch(() => {});
  await page.waitForTimeout(1500);
  await cleanViteOverlays(page);

  // --- 01. Стек диалогов сразу после логина новой пайщицы ---
  const first = await inspectTopDialog(page);
  await shot(
    page,
    '01-onboarding-stack',
    `Стек онбординг-диалогов сразу после первого входа Екатерины. Верхний диалог: «${first.title || 'нет'}»`,
  );

  // --- 02. Попытка зайти в Стол заказов до подписания каких-либо соглашений ---
  // Открываем /market/catalog в новой вкладке такого же контекста через page.goto.
  // Если расширение строит гейт — увидим его поверх онбординг-диалогов или
  // увидим редирект на /user/wallet с висящим стеком соглашений.
  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/catalog`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await cleanViteOverlays(page);
  const second = await inspectTopDialog(page);
  await shot(
    page,
    '02-market-before-signing',
    `Попытка открыть /market/catalog ДО подписания соглашений. URL: \`${page.url()}\`. Верхний диалог: «${second.title || 'нет'}»`,
  );

  // --- 03. Подписываем все доступные диалоги-соглашения (общие + ЦПП Кошелёк) ---
  // signAllAgreements: до 8 итераций; каждый клик «Подписать» закрывает
  // верхний диалог стека.
  let dialogsSigned = 0;
  for (let i = 0; i < 8; i++) {
    const ok = await signOneDialog(page);
    if (!ok) break;
    dialogsSigned += 1;
  }
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await cleanViteOverlays(page);

  // --- 04. Каталог Стола заказов после подписания всех соглашений ---
  // Если есть отдельный гейт ЦПП Стола заказов — он должен показаться сейчас
  // как новый диалог. Если нет — каталог должен открыться.
  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/catalog`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await cleanViteOverlays(page);
  const third = await inspectTopDialog(page);
  await shot(
    page,
    '03-market-after-signing',
    `Каталог Стола заказов ПОСЛЕ подписания соглашений. URL: \`${page.url()}\`. Подписано диалогов: ${dialogsSigned}. Верхний диалог: «${third.title || 'нет'}»`,
  );

  // --- 05. Если остался гейт — попробуем подписать его и снять финальное состояние ---
  if (third.present && third.hasSignButton) {
    await signOneDialog(page);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await cleanViteOverlays(page);
    await shot(
      page,
      '04-market-after-gate-signed',
      `Финальное состояние /market/catalog после подписания гейт-оферты ЦПП Стола заказов`,
    );
  }
};
