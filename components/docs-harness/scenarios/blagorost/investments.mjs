// Сценарий: «Инвестирование» — два пути паевых взносов в Благорост.
//
// Подготовка стенда (фаза 08-investments) делает программно:
//   - capital::openproject — компонент готов принимать инвестиции
//   - wallet::createdeposit + gateway::completeincome — пополняет кошельки petrov + ekaterina
//   - capital::createinvest — petrov вносит 500 000 ₽ в компонент «MVP v1»
//   - capital::createpinv  — ekaterina вносит 200 000 ₽ в программу «Благорост»
//
// Сценарий снимает три состояния:
//   01 — компонент с включённым переключателем «Принимает инвестиции»
//   02 — вкладка «План» компонента с привлечёнными инвестициями (500 000 ₽)
//   03 — профиль с кнопкой «Инвестировать» на Кошельке Благороста (для инвестиций в программу)

import { createHash } from 'node:crypto';
import { loginAsChairman, SHOT_SCALE } from '../../lib/harness.mjs';
import { annotate } from '../../lib/annotate.mjs';

export const meta = {
  title: 'Инвестирование — в компонент и в программу',
  docPath: 'new/blagorost/investments.md',
  assetsDir: 'assets/new/blagorost/investments',
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
    'capital:08-investments',
  ],
};

const COMPONENT_HASH = createHash('sha256').update('blago:project:49').digest('hex');
const COMPONENT_TITLE = 'MVP v1';

async function dismissOnboardingDialogs(page) {
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
    await page.waitForTimeout(3500);
  }
}

async function clearNotifications(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.q-notification').forEach((n) => n.remove());
    document.querySelectorAll('.q-notifications__list > *').forEach((n) => n.remove());
  });
}

async function findBox(...locators) {
  for (const loc of locators) {
    try {
      const first = loc.first();
      await first.waitFor({ state: 'visible', timeout: 2000 });
      const b = await first.boundingBox();
      if (b) return b;
    } catch {}
  }
  return null;
}

async function highlightBox(shotEntry, box, opts = {}) {
  if (!box || !shotEntry?.path) return;
  const pad = (opts.padding ?? 6) * SHOT_SCALE;
  const x = box.x * SHOT_SCALE - pad;
  const y = box.y * SHOT_SCALE - pad;
  const w = box.width * SHOT_SCALE + pad * 2;
  const h = box.height * SHOT_SCALE + pad * 2;
  await annotate({
    input: shotEntry.path,
    output: shotEntry.path,
    annotations: [
      { type: 'rect', at: [x, y, w, h], color: opts.color ?? '#e74c3c', width: opts.width ?? 4, radius: opts.radius ?? 10 },
    ],
  });
}

export default async ({ page, context, shot, env }) => {
  await loginAsChairman(page, context);
  await dismissOnboardingDialogs(page);

  // --- Кадр 1. Карточка компонента с включённым toggle «Принимает инвестиции» ---
  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/capital/components/${COMPONENT_HASH}/description`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(`text=${COMPONENT_TITLE}`, { timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await clearNotifications(page);

  const toggleBox = await findBox(
    page.locator('label:has-text("Принимает инвестиции")'),
    page.locator('.q-toggle:has-text("Принимает инвестиции")'),
  );
  const toggleShot = await shot(
    page,
    '01-toggle-investments-on',
    'Карточка компонента «MVP v1»: переключатель «Принимает инвестиции» в левой панели включён — пайщики могут совершать паевые взносы напрямую в этот компонент.',
  );
  await highlightBox(toggleShot, toggleBox, { padding: 6 });

  // --- Кадр 2. Вкладка «План» компонента с привлечёнными инвестициями ---
  // Берём свежую page чтобы projectStore мониторов остался релевантным
  const planPage = await context.newPage();
  try {
    await planPage.goto(`${env.BASE_URL}/${env.COOPNAME}/capital/components/${COMPONENT_HASH}/planning`, { waitUntil: 'domcontentloaded' });
    await planPage.waitForSelector('text=Привлекаемые инвестиции', { timeout: 30000 }).catch(() => {});
    await planPage.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await planPage.waitForTimeout(2000);
    await clearNotifications(planPage);
    await shot(
      planPage,
      '02-component-plan-with-investments',
      'Вкладка «План» компонента «MVP v1»: строка «Привлекаемые инвестиции» в колонке «Факт» — фактически поступившие 500 000 ₽ от пайщика-инвестора.',
    );
  } finally {
    await planPage.close();
  }

  // --- Кадр 3. Профиль с кнопкой «Инвестировать» на Кошельке Благороста ---
  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/capital/wallet`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Иванов', { timeout: 30000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await clearNotifications(page);

  const investBtnBox = await findBox(
    page.getByRole('button', { name: /Инвестировать/i }),
    page.locator('button:has-text("Инвестировать")'),
    page.locator('text=Инвестировать'),
  );
  const profileShot = await shot(
    page,
    '03-profile-koshelek-invest-button',
    'Страница профиля пайщика: кнопка «Инвестировать» на Кошельке Благороста — этот путь направляет паевой взнос в программу «Благорост», совет распределяет его между компонентами.',
  );
  await highlightBox(profileShot, investBtnBox, { padding: 6 });
};
