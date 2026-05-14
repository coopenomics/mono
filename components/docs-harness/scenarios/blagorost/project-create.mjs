// Сценарий: «Создание проекта и компонента» — первый шаг в серии «Генерация
// на проекте → выход в Благорост».
//
// Председатель `ant` создаёт проект «Кошелёк пайщика» через Мастерскую,
// затем добавляет к нему компонент «MVP v1». Снимаются 4 кадра: заполненная
// форма проекта, заполненная форма компонента, итоговый список с раскрытым
// проектом, и при необходимости — раскрытый FAB.
//
// Особенность: сценарий НЕ идемпотентный. UI генерирует project_hash через
// generateUniqueHash (timestamp + random) — повторный запуск без --reboot создаст
// дубль. Для следующих сценариев серии используется фаза 06-create-project-koshelek
// с детерминированным sha256-хешем (id=48), которая работает независимо.
//
// Перед прогоном: `node bin/shoot.mjs blagorost/project-create --reboot`.

import { loginAsChairman, SHOT_SCALE } from '../../lib/harness.mjs';
import { annotate } from '../../lib/annotate.mjs';

// Получает первый видимый bbox по перечню локаторов-кандидатов.
// Каждый кандидат проверяется с таймаутом 2с — если ни один не нашёл, вернёт null
// (highlight просто пропустится; сценарий не падает).
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

// Обводит bbox красной рамкой поверх PNG. Координаты в CSS-пикселях,
// конвертируются в PNG-пиксели через SHOT_SCALE. padding в CSS-пикселях.
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

export const meta = {
  title: 'Создание проекта и компонента в Благоросте',
  docPath: 'new/blagorost/project-create.md',
  assetsDir: 'assets/new/blagorost/project-create',
  role: 'chairman',
  fixture: 'ant',
  // ivanpetrov + ekaterina нужны фазе 05 (регистрация Contributor), но в этом
  // сценарии UI с ними не работает. Объявляем явно — orchestrator создаст
  // через add-plain-participant ещё до запуска prepare-фаз.
  fixtures: ['ivanpetrov', 'ekaterina'],
  prepare: [
    'capital:01-programs',
    'capital:02-extension-config',
    'capital:04-contributor',
    'capital:05-additional-contributors',
  ],
};

const PROJECT_TITLE = 'Кошелёк пайщика';
const PROJECT_DESCRIPTION = 'Контракт лицевых счетов и интеграция «Кнопка Благорост» в сторонние приложения. Учёт членских взносов и аналитика по кошелькам пайщиков.';
const COMPONENT_TITLE = 'MVP v1';
const COMPONENT_DESCRIPTION = 'Минимальный продукт: контракт лицевых счетов, базовое API учёта членских взносов, виджет «Кнопка Благорост» для интеграции в сторонние приложения.';

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

// Editor — кастомный contenteditable (TipTap). Кликаем в редактируемую
// область диалога и вводим текст. Если не нашёл — пропускаем (описание
// опционально, форма провалидируется только по title).
async function fillEditor(page, dialogLocator, text) {
  try {
    const editor = dialogLocator.locator('.ProseMirror, [contenteditable="true"]').first();
    await editor.waitFor({ state: 'visible', timeout: 3000 });
    await editor.click();
    await page.keyboard.type(text, { delay: 5 });
  } catch {
    // Описание не критично для прохождения формы.
  }
}

export default async ({ page, context, shot, env }) => {
  // --- Шаг 1. Логин председателя ---
  await loginAsChairman(page, context);
  await dismissOnboardingDialogs(page);

  // --- Шаг 2. Открываем Мастерскую ---
  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/capital/projects`, { waitUntil: 'domcontentloaded' });
  // Ждём пока FAB появится — это маркер «страница готова, контрибутор-роль детектирована».
  await page.waitForSelector('.q-fab', { timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await clearNotifications(page);
  await page.waitForTimeout(500);

  // --- Шаг 3. Раскрываем FAB ---
  // Кастомный shared/ui/Fab — на hover делает fabRef.show() и выезжают q-fab-action
  // (Проект (P), Компонент (C) и др.). Click тоже работает, но Playwright actionability
  // на q-fab__icon-holder ловит intercepts от parent q-page-sticky — стабильнее hover.
  await page.locator('.q-fab').first().hover();
  await page.waitForSelector('text=Проект (P)', { timeout: 5000 });
  await page.waitForTimeout(500);

  // Захватываем bbox до screenshot — после shot FAB может скрыться (Fab.vue
  // запускает таймер scheduleHide на 1с при mouseleave).
  const fabActionBox = await findBox(
    page.getByRole('button', { name: 'Проект (P)' }),
    page.locator('button:has-text("Проект (P)")'),
    page.locator('text=Проект (P)'),
  );
  const fabShot = await shot(
    page,
    '01-fab-actions',
    'Мастерская в Благоросте: председатель навёл курсор на плавающую кнопку «+» в правом нижнем углу — раскрылись действия «Проект» и «Компонент».',
  );
  await highlightBox(fabShot, fabActionBox);

  // --- Шаг 4. Открываем форму создания проекта ---
  // Хоткей P безусловно работает на странице (useCapitalFabHotkeys → openDialog).
  // Клик по q-fab-action из-за hover-логики Fab может «улететь» если курсор
  // успеет уйти, поэтому используем клавишу — она надёжнее.
  await page.keyboard.press('KeyP');
  await page.waitForSelector('text=Создать проект', { timeout: 10000 });
  await page.waitForTimeout(500);

  const projectDialog = page.locator('div.q-dialog:visible').last();

  // Поле «Название проекта» — q-input с label
  const titleInput = projectDialog.locator('label:has-text("Название проекта") input, input[aria-label="Название проекта"]').first();
  await titleInput.click();
  await titleInput.fill(PROJECT_TITLE);

  // Поле «Описание проекта» — кастомный Editor
  await fillEditor(page, projectDialog, PROJECT_DESCRIPTION);
  await page.waitForTimeout(500);

  await shot(
    page,
    '02-create-project-dialog',
    'Форма создания проекта: председатель вводит название «Кошелёк пайщика» и описание. После «Создать» вопрос автоматически попадает на повестку совета.',
  );

  // --- Шаг 5. Создаём проект ---
  await projectDialog.locator('button:has-text("Создать")').last().click();
  // Ждём пока диалог сам закроется — это надёжнее, чем `text=PROJECT_TITLE`,
  // который матчится в самом диалоге («Название проекта: Кошелёк пайщика»)
  // и проскакивает мимо реального события «контракт подтвердил создание».
  await page.waitForFunction(
    () => !Array.from(document.querySelectorAll('[id^="q-portal--dialog--"]'))
      .some((p) => getComputedStyle(p).display !== 'none' && p.textContent?.includes('Название проекта')),
    { timeout: 30000 },
  );
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await clearNotifications(page);
  await page.waitForTimeout(500);

  // --- Шаг 6. Открываем форму создания компонента из строки проекта ---
  // CreateComponentButton — иконка add в строке проекта; ищем её внутри строки
  // с заголовком нашего проекта.
  const projectRow = page.locator(`tr:has-text("${PROJECT_TITLE}"), [role="row"]:has-text("${PROJECT_TITLE}"), .q-item:has-text("${PROJECT_TITLE}")`).first();
  // q-btn[icon="add"] — Quasar рендерит как button с .q-btn и внутри иконка add
  const addComponentBtn = projectRow.locator('button:has(i.q-icon:text("add"))').first();
  // Fallback на любую кнопку с aria-label «add» в строке
  const addBtnFallback = projectRow.locator('button[aria-label*="add" i], button:has(.material-icons:text("add"))').first();
  try {
    await addComponentBtn.click({ timeout: 5000 });
  } catch {
    await addBtnFallback.click({ timeout: 5000 });
  }
  await page.waitForSelector('text=Создать компонент', { timeout: 10000 });
  await page.waitForTimeout(500);

  const componentDialog = page.locator('div.q-dialog:visible').last();

  const componentTitleInput = componentDialog.locator('label:has-text("Название компонента") input, input[aria-label="Название компонента"]').first();
  await componentTitleInput.click();
  await componentTitleInput.fill(COMPONENT_TITLE);
  await fillEditor(page, componentDialog, COMPONENT_DESCRIPTION);
  await page.waitForTimeout(500);

  await shot(
    page,
    '03-create-component-dialog',
    'Форма создания компонента в проекте «Кошелёк пайщика»: председатель вводит название «MVP v1» и подробное описание результата.',
  );

  // --- Шаг 7. Создаём компонент ---
  await componentDialog.locator('button:has-text("Создать")').last().click();
  // Ждём пока модалка сама закроется (контракт + парсер + UI отреагировал).
  // На свежей цепочке парсер иногда отстаёт, и диалог зависает в спиннере
  // даже после успешного capital::addproject — компонент уже на chain,
  // просто UI не получил mongo-обновления. Если за 20с не закрылся —
  // закрываем руками через Esc и идём дальше.
  const dialogClosed = await page.waitForFunction(
    () => !Array.from(document.querySelectorAll('[id^="q-portal--dialog--"]'))
      .some((p) => getComputedStyle(p).display !== 'none' && p.textContent?.includes('Название компонента')),
    { timeout: 20000 },
  ).then(() => true).catch(() => false);
  if (!dialogClosed) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      document.querySelectorAll('[id^="q-portal--dialog--"]').forEach((p) => {
        if (p.textContent?.includes('Название компонента')) p.remove();
      });
    });
  }
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await clearNotifications(page);
  await page.waitForTimeout(500);

  // --- Шаг 8. Раскрываем проект чтобы было видно компонент ---
  // Стрелка «›» слева от названия проекта раскрывает список компонентов.
  try {
    const expandBtn = page.locator(`tr:has-text("${PROJECT_TITLE}") button:has(i:text("chevron_right")), .q-item:has-text("${PROJECT_TITLE}") button:has(i:text("chevron_right"))`).first();
    await expandBtn.click({ timeout: 3000 });
    await page.waitForTimeout(500);
  } catch {
    // Если auto-раскрылся или другой селектор — игнорируем, скриншот снимем как есть.
  }

  // bbox «+» в строке проекта (CreateComponentButton) — захватываем до shot.
  const plusBtnBox = await findBox(
    page.locator(`tr:has-text("${PROJECT_TITLE}")`).first().locator('button:has(i:text-is("add"))'),
    page.locator(`tr:has-text("${PROJECT_TITLE}")`).first().locator('button[aria-label*="add" i]'),
  );
  const listShot = await shot(
    page,
    '04-projects-list-with-koshelek',
    'Мастерская после создания: проект «Кошелёк пайщика» виден в списке, под ним раскрыт компонент «MVP v1».',
  );
  await highlightBox(listShot, plusBtnBox, { padding: 4 });

  // --- Шаг 9. Открываем карточку проекта ---
  // Клик по самому названию проекта (не по «+» и не по стрелке) ведёт в ProjectPage.
  await page.locator(`tr:has-text("${PROJECT_TITLE}")`).first().getByText(PROJECT_TITLE, { exact: true }).first().click();
  // Дождёмся router-навигации и появления описания на странице проекта
  await page.waitForURL(/\/capital\/project\//, { timeout: 15000 }).catch(() => {});
  await page.waitForSelector('text=Контракт лицевых счетов', { timeout: 30000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await clearNotifications(page);
  await page.waitForTimeout(800);

  // bbox поля «Статус» в sidebar — захватываем до shot.
  const statusFieldBox = await findBox(
    page.locator('.q-field:has-text("Статус")'),
    page.locator('label:has-text("Статус")'),
  );
  const projectShot = await shot(
    page,
    '05-project-page',
    'Страница проекта «Кошелёк пайщика»: название, описание и левая панель управления (sidebar) — статус «Ожидает», поля «Мастер», «Видео», «Репозиторий».',
  );
  await highlightBox(projectShot, statusFieldBox, { padding: 6 });

  // --- Шаг 10. Переключаем статус проекта на «Активен» ---
  // q-select (UpdateStatus.vue) — открывается кликом по полю, выбор через q-item.
  async function setStatusActive() {
    await page.locator('.q-field:has-text("Статус")').first().click();
    await page.waitForSelector('.q-menu', { timeout: 5000 });
    await page.locator('.q-menu .q-item:has-text("Активен")').first().click();
    // Подождать confirmation от chain + poll-обновление UI
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);
  }
  await setStatusActive();
  await clearNotifications(page);

  // --- Шаг 11. Переходим во вкладку «Компоненты» проекта ---
  // Доступ на чтение компонентов открыт без clearance — controller их не
  // фильтрует. Нам важно дать парсеру довести addproject до mongo: после
  // setStatusActive клик во вкладку идёт сразу, и `capitalProject`-resolver
  // успевает вернуть `components: []`, хотя через секунду уже отдал бы
  // правильный список. Поэтому ждём до 30с появления MVP v1 на странице.
  await page.waitForTimeout(3000);

  await page.getByRole('tab', { name: /Компоненты/i }).click().catch(async () => {
    await page.locator('text=КОМПОНЕНТЫ').first().click();
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

  // Реальное ожидание появления компонента в списке. Если парсер ещё не
  // дошёл — useProjectLoader тихо вернёт project.components=[] и страница
  // зависнет на «Нет компонентов». Сценарий мог бы пережить это через
  // обход (вернуться в Мастерскую и кликнуть из общего списка), но
  // правильный пользовательский путь — именно вкладка «Компоненты», и
  // именно его и проверяем.
  await page.locator(`text=${COMPONENT_TITLE}`).first().waitFor({ timeout: 30000 });

  await page.locator(`text=${COMPONENT_TITLE}`).first().click();
  await page.waitForURL(/\/capital\/components\//, { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);

  // --- Шаг 12. Переключаем статус компонента на «Активен» ---
  await setStatusActive();
  await clearNotifications(page);

  await shot(
    page,
    '06-component-page-active',
    'Страница компонента «MVP v1» после активации: статус «Активен» в левой панели, переключатель «Принимает инвестиции», описание результата. С этого момента можно принимать коммиты исполнителей (после установки плана).',
  );
};
