// Сценарий: «Назначение мастера и план компонента» — второй шаг серии «Генерация».
//
// Подготовка стенда (фаза 07-master-and-plan) делает действия программно через SDK:
//   - capital::setmaster (master = ant для компонента MVP v1)
//   - capital::setplan   (160 ч × 1500 ₽/ч + 50 000 ₽ доп. расходов)
//
// Сценарий снимает уже подготовленные страницы — для документации важно
// показать «как это выглядит после действия», а не имитировать UI-клики
// по диалогам, которые в текущем UI требуют clearance flow (председатель
// должен сначала «откликнуться на приглашение в проект» с ролью мастера и
// получить одобрение). Для пользовательской документации этот шаг описывается
// в прозе.
//
// Кадры:
//   01-component-master  — компонент с назначенным мастером (sidebar, выделено)
//   02-component-plan    — вкладка «План» компонента: таблица план/факт
//   03-project-plan      — вкладка «План» проекта: сводный план

import { createHash } from 'node:crypto';
import { loginAsChairman, SHOT_SCALE } from '../../lib/harness.mjs';
import { annotate } from '../../lib/annotate.mjs';

export const meta = {
  title: 'Назначение мастера и план компонента',
  docPath: 'new/blagorost/master-and-plan.md',
  assetsDir: 'assets/new/blagorost/master-and-plan',
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
  ],
};

const PROJECT_HASH = createHash('sha256').update('blago:project:48').digest('hex');
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

  // --- Кадр 1. Карточка компонента — sidebar с назначенным мастером ---
  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/capital/components/${COMPONENT_HASH}/description`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(`text=${COMPONENT_TITLE}`, { timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await clearNotifications(page);

  const masterBox = await findBox(
    page.locator('.master-selector'),
    page.locator('.q-field:has-text("Мастер")'),
  );
  const masterShot = await shot(
    page,
    '01-component-master',
    'Страница компонента «MVP v1»: в левой панели поле «Мастер» — председатель ant назначен мастером компонента (Иванов).',
  );
  await highlightBox(masterShot, masterBox, { padding: 6 });

  // --- Кадр 2. Вкладка «План» компонента — таблица план/факт ---
  // Открываем планирование в свежей странице того же контекста — у новой page
  // нет привязки к pinia/component-store предыдущего экрана, поэтому
  // ProjectPlanningWidget при mount запросит проект заново и получит is_planed=true.
  const planningPage = await context.newPage();
  try {
    await planningPage.goto(`${env.BASE_URL}/${env.COOPNAME}/capital/components/${COMPONENT_HASH}/planning`, { waitUntil: 'domcontentloaded' });
    await planningPage.waitForSelector('text=Стоимость часа', { timeout: 30000 }).catch(() => {});
    await planningPage.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    // Polling: ждём пока is_planed=true дойдёт до UI (если parser ещё догоняет)
    for (let i = 0; i < 8; i++) {
      const stillEmpty = await planningPage.locator('text=не установлено').count();
      if (stillEmpty === 0) break;
      await planningPage.reload({ waitUntil: 'domcontentloaded' });
      await planningPage.waitForSelector('text=Стоимость часа', { timeout: 30000 }).catch(() => {});
      await planningPage.waitForTimeout(2000);
    }
    await clearNotifications(planningPage);
    await shot(
      planningPage,
      '02-component-plan',
      'Вкладка «План» компонента «MVP v1»: таблица план/факт со значениями — стоимость часа, плановые часы, пулы исполнителей/соавторов/координаторов, дополнительные расходы, общая стоимость результата.',
    );
  } finally {
    await planningPage.close();
  }

  // --- Кадр 3. Вкладка «План» проекта — сводный план ---
  const projectPlanPage = await context.newPage();
  try {
    await projectPlanPage.goto(`${env.BASE_URL}/${env.COOPNAME}/capital/projects/${PROJECT_HASH}/planning`, { waitUntil: 'domcontentloaded' });
    await projectPlanPage.waitForSelector('text=Сводный план', { timeout: 30000 }).catch(() => {});
    await projectPlanPage.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await projectPlanPage.waitForTimeout(2000);
    await clearNotifications(projectPlanPage);

    await shot(
      projectPlanPage,
      '03-project-plan',
      'Вкладка «План» проекта «Кошелёк пайщика»: сводный план — агрегированные показатели всех компонентов проекта (сейчас один — «MVP v1»).',
    );
  } finally {
    await projectPlanPage.close();
  }
};
