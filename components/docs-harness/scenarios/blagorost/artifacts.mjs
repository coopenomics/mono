// Сценарий: «Артефакты» — вкладка component-requirements / project-requirements.
//
// Фаза 09b создаёт через GraphQL 4 артефакта на компоненте (по одному
// каждого формата) + 1 на проекте. Сценарий снимает заполненный список и
// редактор каждого из 4 форматов через клик по строке таблицы.
//
// Кадр диалога создания через FAB/хоткей R пропущен — заблокирован
// инфраструктурным race в parser/controller (action apprvappndx приходит
// раньше дельты appendixes → capital_appendixes пуст → has_clearance=false
// у всех, FAB и хоткеи отключены). См. задачу #53. Описание диалога —
// текстом в .md.
//
// Кадры:
//   01-component-artifacts — список артефактов компонента (4 шт.)
//   02-markdown-editor     — редактор Markdown в EditRequirementDialog
//   03-mermaid-editor      — редактор Mermaid с предпросмотром
//   04-bpmn-editor         — редактор BPMN (bpmn-js)
//   05-drawio-editor       — редактор Draw.io (iframe diagrams.net)
//   06-project-artifacts   — список артефактов проекта (1 общая концепция)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { loginAsChairman, dismissOnboardingDialogs } from '../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadFixture(username) {
  return JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../state/participants/${username}.json`), 'utf8'),
  );
}

const PROJECT_HASH = createHash('sha256').update('blago:project:48').digest('hex');
const COMPONENT_HASH = createHash('sha256').update('blago:project:49').digest('hex');

export const meta = {
  title: 'Артефакты',
  docPath: 'new/blagorost/artifacts.md',
  assetsDir: 'assets/new/blagorost/artifacts',
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
    'capital:09b-artifacts',
  ],
};

async function clearNotifications(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.q-notification').forEach((n) => n.remove());
    document.querySelectorAll('.q-notifications__list > *').forEach((n) => n.remove());
  });
}

async function closeMaximizedDialog(page) {
  // q-dialog maximized — закрываем по иконке close в заголовке (q-bar).
  // Бывает несколько диалогов в стеке — закрываем верхний.
  const closeBtn = page
    .locator('div.q-dialog:visible')
    .last()
    .locator('button:has(.q-icon:has-text("close"))')
    .last();
  try {
    await closeBtn.click({ timeout: 5000 });
  } catch {
    // fallback — Escape
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(800);
}

async function openArtifactByTitle(page, title, extraDelay = 1500) {
  // На странице компонента/проекта список делает router.push к отдельной странице
  // detail (component-requirement-detail / project-requirement-detail) — это НЕ
  // q-dialog, а полноценная страница с EditRequirementPanel.
  const row = page.locator(`tr:has-text("${title}")`).first();
  await row.waitFor({ state: 'visible', timeout: 10000 });
  await Promise.all([
    page.waitForURL((url) => url.pathname.includes('/requirements/'), { timeout: 12000 }),
    row.click(),
  ]);
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  // Ждём, пока в q-bar появится title-input с текстом нашего артефакта.
  await page.waitForFunction(
    (expected) =>
      Array.from(document.querySelectorAll('.q-bar input')).some((i) =>
        (i.value ?? '').includes(expected),
      ),
    title,
    { timeout: 12000 },
  );
  await page.waitForTimeout(extraDelay); // редакторы (BPMN/Drawio) рендерят канвас
}

async function backToList(page) {
  // На странице detail в шапке EditRequirementPanel есть «✕ Закрыть» либо кнопка
  // «Назад» в основном layout'е. Безопаснее — page.goBack(), он вернёт к списку.
  await page.goBack();
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(500);
}

export default async ({ page, context, shot, env }) => {
  await loginAsChairman(page, context);
  await dismissOnboardingDialogs(page);

  // Перед артефактами переводим компонент из «Ожидает» в «Активен» через UI —
  // на «Ожидает» FAB не показывает действий, артефакт не создашь.
  await page.goto(
    `${env.BASE_URL}/${env.COOPNAME}/capital/components/${COMPONENT_HASH}`,
    { waitUntil: 'domcontentloaded' },
  );
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  // Persistent-диалог Capital sign — режем сразу.
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    document.querySelectorAll('[id^="q-portal--dialog--"]').forEach((p) => {
      if (p.textContent?.includes('Прочитайте и подпишите')) p.remove();
    });
  });
  await page.waitForTimeout(500);
  // Открываем dropdown «Статус» и выбираем «Активен», если ещё «Ожидает».
  const isPending = await page
    .locator('text=Ожидает')
    .first()
    .isVisible()
    .catch(() => false);
  if (isPending) {
    await page.locator('label:has-text("Статус")').first().click();
    await page.waitForTimeout(500);
    await page.locator('div[role="option"]:has-text("Активен"), .q-item:has-text("Активен")').first().click();
    await page.waitForTimeout(2000);
  }
  await clearNotifications(page);

  // --- 01: список артефактов компонента ---
  await page.goto(
    `${env.BASE_URL}/${env.COOPNAME}/capital/components/${COMPONENT_HASH}/requirements`,
    { waitUntil: 'domcontentloaded' },
  );
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  // На капитальной странице может всплыть persistent-диалог «Прочитайте и подпишите»
  // (Положение ЦПП Кошелёк) — на ant'е он уже подписан, но фронт держит его в DOM.
  // Сначала пробуем стандартный dismiss; если остался — режем portal из DOM, чтобы не мешал.
  await page.waitForTimeout(3000);
  for (let i = 0; i < 2; i++) {
    const hasSignDialog = await page
      .locator('text=Прочитайте и подпишите')
      .first()
      .isVisible()
      .catch(() => false);
    if (!hasSignDialog) break;
    await dismissOnboardingDialogs(page);
    await page.waitForTimeout(1500);
  }
  await page.evaluate(() => {
    document.querySelectorAll('[id^="q-portal--dialog--"]').forEach((p) => {
      if (p.textContent?.includes('Прочитайте и подпишите')) {
        p.remove();
      }
    });
  });
  await page.waitForTimeout(500);
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  // Ждём пока в списке появится Markdown-артефакт (значит таблица загружена).
  await page.waitForSelector('text=Требования к экрану', { timeout: 15000 });
  await clearNotifications(page);
  await page.waitForTimeout(800);

  await shot(
    page,
    '01-component-artifacts',
    'Вкладка «Артефакты» компонента «MVP v1»: четыре артефакта разных форматов — Markdown (требования), Mermaid (диаграмма потока), BPMN (бизнес-процесс) и Draw.io (архитектурная схема). Иконка слева подсказывает формат.',
  );

  // --- 02: редактор Markdown ---
  await openArtifactByTitle(page, 'Требования к экрану');
  await shot(
    page,
    '02-markdown-editor',
    'Редактор артефакта в формате Markdown: заголовок «Требования к экрану «Кошелёк»», тело с разделами и списками. Сохранение — кнопкой «Сохранить» в шапке.',
  );
  await backToList(page);

  // --- 03: редактор Mermaid ---
  await openArtifactByTitle(page, 'Поток коммитов');
  await shot(
    page,
    '03-mermaid-editor',
    'Редактор Mermaid: слева — текст диаграммы кодом, справа — живой предпросмотр. Sequence-диаграмма потока приёмки коммита между Исполнителем, Мастером и Кооперативом.',
  );
  await backToList(page);

  // --- 04: редактор BPMN ---
  await openArtifactByTitle(page, 'Процесс приёмки РИД');
  // bpmn-js рендерится дольше — даём больше времени на канвас.
  await page.waitForTimeout(2500);
  await shot(
    page,
    '04-bpmn-editor',
    'Редактор BPMN: визуальный конструктор бизнес-процесса с панелью элементов слева (события, задачи, шлюзы) и канвасом для рисования. Нотация BPMN 2.0.',
  );
  await backToList(page);

  // --- 05: редактор Draw.io ---
  await openArtifactByTitle(page, 'Архитектурная схема');
  // Draw.io грузится во встроенный iframe — ждём дольше.
  await page.waitForTimeout(3500);
  await shot(
    page,
    '05-drawio-editor',
    'Редактор Draw.io во встроенном режиме: полный набор фигур (блок-схемы, mind maps, сетевые диаграммы), сохранение при закрытии артефакта.',
  );
  await backToList(page);

  // --- 06: список артефактов проекта ---
  await page.goto(
    `${env.BASE_URL}/${env.COOPNAME}/capital/projects/${PROJECT_HASH}/requirements`,
    { waitUntil: 'domcontentloaded' },
  );
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  // На layout'е ProjectPage снова вылезает persistent SignAgreementDialog — режем.
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    document.querySelectorAll('[id^="q-portal--dialog--"]').forEach((p) => {
      if (p.textContent?.includes('Прочитайте и подпишите')) p.remove();
    });
  });
  await page.waitForTimeout(500);
  await page.waitForSelector('text=Концепция проекта', { timeout: 15000 });
  await clearNotifications(page);
  await page.waitForTimeout(800);

  await shot(
    page,
    '06-project-artifacts',
    'Вкладка «Артефакты» проекта «Кошелёк пайщика»: один общий концептуальный документ, видимый всем компонентам проекта.',
  );
};
