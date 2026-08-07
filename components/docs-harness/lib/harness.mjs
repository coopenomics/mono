// Общие хелперы для сценариев документации.
// Контракт сценария: default export async ({ page, context, shot, expect, env }) => {}
// shot(name, description) — снимает viewport-скриншот, добавляет запись в manifest,
//   падает с ошибкой если соответствующий селектор (если передан) не виден.

import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const HARNESS_ROOT = path.resolve(__dirname, '..');
export const REPO_ROOT = path.resolve(HARNESS_ROOT, '..');

// Режим роутера решается в рантайме (src/app/providers/router.ts:
// env.VUE_ROUTER_MODE === 'history' ? createWebHistory : createWebHashHistory),
// а не на сборке. Стенды разъезжаются: где-то hash, где-то history — и
// зашитый в сценарий «/#/» уводит историю-роутер на несуществующий путь.
// Поэтому сценарии строят URL через APP_PREFIX, а не руками.
function routerPrefix(baseUrl) {
  if (process.env.ROUTER_MODE) return process.env.ROUTER_MODE === 'hash' ? `${baseUrl}/#` : baseUrl;
  try {
    const envFile = path.resolve(__dirname, '../../desktop/.env');
    const raw = fsSync.readFileSync(envFile, 'utf8');
    const m = raw.match(/^\s*VUE_ROUTER_MODE\s*=\s*(\S+)\s*$/m);
    // По умолчанию hash — так же, как в public/config.default.js.
    if (m && m[1].replace(/["']/g, '') === 'history') return baseUrl;
  } catch {
    /* нет .env — остаёмся на hash */
  }
  return `${baseUrl}/#`;
}

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:2999';

export const env = {
  BASE_URL,
  // Префикс для маршрутов приложения: с ним `${env.APP_PREFIX}/${COOPNAME}/...`
  // корректен и в hash-, и в history-режиме.
  APP_PREFIX: routerPrefix(BASE_URL),
  COOPNAME: process.env.COOPNAME || 'voskhod',
  CHAIRMAN_EMAIL: process.env.CHAIRMAN_EMAIL || 'ivanov@example.com',
  CHAIRMAN_WIF: process.env.CHAIRMAN_WIF || '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3',
};

// Единая конвенция для всех сценариев:
//   viewport 1120×800 + deviceScaleFactor 1.25 → PNG выходит 1400×1000 пикселей,
//   но весь UI отрисован на 25 % крупнее обычного (иначе мелкие подписи
//   и иконки на скриншотах неразборчивы). Высота 800 выбрана так, чтобы
//   на Столе пайщика помещалось всё левое меню целиком (до «Поддержка»).
export const SHOT_VIEWPORT = { width: 1120, height: 800 };
export const SHOT_SCALE = 1.25;

// Исключения, которые НЕ являются дефектом проверяемого продукта: их бросают
// сторонние виджеты, которых на локальном стенде просто нет. Список держим
// узким и с обоснованием — каждая запись здесь ослабляет смоук-вердикт.
const IGNORED_PAGE_ERRORS = [
  // Виджет поддержки Chatwoot грузится с внешнего хоста; на локальном стенде
  // его нет, и SDK бросает «Chatwoot not loaded» на каждой странице.
  // К Столу заказов отношения не имеет.
  /Chatwoot not loaded/i,
  // Карта ПВЗ грузится во фрейме стороннего картографического сервиса, и он
  // пытается читать localStorage хоста. Браузер это запрещает — исключение
  // прилетает из чужого кода и к Столу заказов отношения не имеет.
  /Failed to read the 'localStorage' property from 'Window'/i,
];

export async function openBrowser({ storageState } = {}) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: SHOT_VIEWPORT,
    deviceScaleFactor: SHOT_SCALE,
    locale: 'ru-RU',
    storageState,
  });
  const page = await context.newPage();

  const consoleLog = [];
  // Структурированные признаки поломки — на них runner выносит вердикт, не
  // дожидаясь ассерта. Сценарий без единого expect всё равно работает как
  // смоук-тест: JS-исключение на странице или 5xx от сервера роняют прогон.
  // 4xx сюда НЕ попадают: 401/403 — штатная часть логина и боковых сценариев,
  // где отказ и есть ожидаемое поведение.
  const failures = [];
  const debugConsole = process.env.DEBUG_CONSOLE === '1';
  page.on('console', m => {
    const line = `[${m.type()}] ${m.text()}`;
    consoleLog.push(line);
    if (debugConsole) console.log('  [browser]', line.slice(0, 300));
  });
  page.on('pageerror', e => {
    consoleLog.push(`[pageerror] ${e.message}`);
    if (!IGNORED_PAGE_ERRORS.some((re) => re.test(e.message))) {
      failures.push({ kind: 'pageerror', detail: e.message.split('\n')[0].slice(0, 300) });
    }
    if (debugConsole) console.log('  [browser pageerror]', e.message.slice(0, 300));
  });
  page.on('requestfailed', r => {
    const u = r.url();
    if (!u.includes('/src/') && !u.includes('/node_modules/') && !u.includes('/@vite')) {
      consoleLog.push(`[reqfail] ${u} — ${r.failure()?.errorText}`);
    }
  });
  page.on('response', async r => {
    const u = r.url();
    if (u.includes('/v1/') || u.includes('/config') || u.includes('/get_info') || u.includes('get_account')) {
      consoleLog.push(`[resp ${r.status()}] ${r.request().method()} ${u}`);
      // 400 — сформированный клиентом невалидный запрос, это всегда дефект;
      // 5xx — сервер упал. И то и другое роняет сценарий.
      const s = r.status();
      if (s === 400 || s >= 500) {
        failures.push({ kind: 'http', detail: `${s} ${r.request().method()} ${u.slice(0, 200)}` });
      }
    }
  });

  return { browser, context, page, consoleLog, failures };
}

// Логин председателя через форму. Кэширует storageState.
// Учитывает что vue-router в текущем десктопе работает в hash-режиме
// (URL вида http://host/#/voskhod/...), а не history.
export async function loginAsChairman(page, context, { signAgreements = true } = {}) {
  // timeout 150s: первый заход на роут signin компилирует его chunk в холодном
  // Vite (optimizeDeps + on-demand transform модульного графа), что не укладывается
  // в 60с; последующие сценарии переиспользуют скомпилированный chunk и быстры.
  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/auth/signin`, { waitUntil: 'domcontentloaded', timeout: 150000 });
  await page.waitForSelector('button:has-text("Войти")', { timeout: 150000 });
  await cleanViteOverlays(page);
  await page.locator('input[type="email"]').first().fill(env.CHAIRMAN_EMAIL);
  await page.locator('input[type="password"]').first().fill(env.CHAIRMAN_WIF);
  await cleanViteOverlays(page);
  await page.locator('button:has-text("Войти")').click();
  // Ждём пока URL уйдёт от signin (либо в chairman/user/soviet/participant).
  // Используем waitForFunction вместо waitForURL — он более forgiving по hash.
  await page.waitForFunction(
    () => !/auth\/signin/.test(window.location.href),
    { timeout: 30000 },
  ).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  if (signAgreements) await passFirstLoginAgreements(page);
}

// Логин обычного пайщика по фикстуре (state/participants/<username>.json).
// fixture: { username, email, wif, ... }
export async function loginAs(page, fixture, { signAgreements = true } = {}) {
  // timeout 150s: см. комментарий в loginAsChairman — холодная компиляция chunk'а
  // роута signin в Vite не укладывается в 60с на первом заходе.
  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/auth/signin`, { waitUntil: 'domcontentloaded', timeout: 150000 });
  await page.waitForSelector('button:has-text("Войти")', { timeout: 150000 });
  await cleanViteOverlays(page);
  await page.locator('input[type="email"]').first().fill(fixture.email);
  await page.locator('input[type="password"]').first().fill(fixture.wif);
  await cleanViteOverlays(page);
  await page.locator('button:has-text("Войти")').click();
  await page.waitForFunction(
    () => !/auth\/signin/.test(window.location.href),
    { timeout: 30000 },
  ).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  if (signAgreements) await passFirstLoginAgreements(page);
}


// Соглашения первого входа — свойство стенда, а не сценария.
//
// На свежей цепи (после reboot:extra) любой первый вход открывает каскад
// модалок подписания: пользовательское соглашение, ЭП, политика обработки
// персональных данных, положение о ЦПП «Кошелёк». Пока они висят, оверлей
// перехватывает клики — и сценарий падает на «не могу кликнуть по меню»,
// хотя меню на месте. Раньше каждый сценарий разбирался с этим сам (или не
// разбирался вовсе), поэтому чинить приходилось по одному.
//
// Подписываем, а не прячем: спрятанный диалог оставляет кооператив без
// подписи, и следующее же действие упирается в неё уже на сервере.
export async function passFirstLoginAgreements(page) {
  // Документ может ещё генерироваться — кнопка появится позже текста.
  await page.waitForFunction(
    () => !document.body.innerText.includes('Формируем документ'),
    { timeout: 30000 },
  ).catch(() => {});
  const { signed } = await signOnboardingAgreements(page, { probeMs: 4000 });
  if (signed) await page.waitForTimeout(1500);
  return signed;
}

// Скрывает каскад модалок-документов первого входа (Положение о ЦПП Кошелёк,
// ЭП, политика обработки ПД, пользовательское соглашение). После регистрации
// или первого логина в Восходе у chairman'а/пайщика рендерятся параллельно 4
// SignAgreementDialog (см. widgets/RequireAgreements) — каждый в своём
// q-portal--dialog--N. На каждом page.goto Vue их перерендерит заново.
//
// На локальном тестовом стенде реальная подпись (signAgreement → push в
// блокчейн) не отрабатывает: submit-handler q-form вызывается, validate
// проходит, но signAgreement зависает либо backend отдаёт ошибку без
// видимого UX-feedback. Для целей docs-harness нам важно ПРОЙТИ дальше по
// сценарию, а не фиксировать сам онбординг.
//
// Стратегия: ставим MutationObserver, который при добавлении/изменении
// q-portal--dialog--N проверяет, не онбординг ли это («Прочитайте и подпишите
// документ» в заголовке) — и если да, ставит display:none + чистит body-флаги
// Quasar (q-body--prevent-scroll и пр.). Наблюдатель остаётся жить до конца
// page-сессии и работает после каждого Vue-перерендера.
// Выбор кооперативного участка — платформенный оверлей, а не экран Стола заказов.
//
// После того как кооператив перешёл на двухэтапную систему управления, любой
// пайщик при первом входе получает диалог «Выберите кооперативный участок».
// Пока он висит, экран расширения под ним недоступен. Сценариям Стола заказов
// этот шаг не принадлежит, но пройти его они обязаны — иначе падают на
// «не вижу каталог», хотя дело в незакрытом диалоге платформы.
//
// Возвращает имя выбранного участка либо null, если диалога не было.
export async function pickBranchIfAsked(page, { timeout = 12000 } = {}) {
  // Без :visible — портал-обёртка Quasar может не иметь собственного бокса,
  // и строгая проверка видимости отбрасывает диалог, который на экране есть.
  const dialog = page.locator('[id^="q-portal--dialog--"]').filter({ hasText: 'Выберите кооперативный участок' }).first();
  const shown = await dialog.waitFor({ state: 'attached', timeout }).then(() => true).catch(() => false);
  if (!shown) return null;
  // Портал может остаться в DOM после закрытия: тогда он есть, но не кликается,
  // и попытка «выбрать участок» вешает сценарий на таймаут поля.
  const interactive = await dialog.locator('.q-field').first().isVisible().catch(() => false);
  if (!interactive) return null;

  // Список участков приходит запросом, поэтому меню сразу после клика может
  // быть пустым. Ждём именно появления опции, а не «какого-то» меню: пустой
  // выпадающий список — это симптом, который однажды уже стоил половины
  // прогона (у участков не было реквизитов, и они выпадали из выдачи).
  const option = page.locator('.q-menu [role="option"], .q-menu .q-item, [role="listbox"] [role="option"]').first();
  let picked = null;
  for (let attempt = 1; attempt <= 3 && !picked; attempt++) {
    await dialog.locator('.q-field').first().click();
    const appeared = await option.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
    if (!appeared) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(2000);
      continue;
    }
    picked = (await option.innerText()).trim().split('\n')[0];
    await option.click();
    await page.waitForTimeout(600);
  }
  if (!picked) throw new Error('диалог выбора участка открылся, но список участков пуст');

  await dialog.locator('button:has-text("Продолжить")').first().click();
  await dialog.waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  return picked;
}

// Клик по пункту левого меню (AppDrawer канона).
//
// Разметка меню менялась: раньше это были `a` / `.q-item` Quasar'а, сейчас —
// `div.rail__item` со `span.rail__item-label` внутри. Сценарии, которые ходили
// по старым селекторам, молча пропускали пункт и снимали одну и ту же
// страницу под разными именами — тест, который ничего не проверяет.
// Поэтому: перебираем известные варианты разметки, а если пункта нет —
// падаем, а не «continue».
export async function clickMenu(page, text, { timeout = 15000 } = {}) {
  const candidates = [
    `.rail__item:has(.rail__item-label:text-is("${text}"))`,
    `.rail__item:has-text("${text}")`,
    `a:has-text("${text}")`,
    `.q-item:has-text("${text}")`,
  ];
  for (const sel of candidates) {
    const link = page.locator(sel).first();
    if (await link.isVisible().catch(() => false)) {
      await link.click();
      await page.waitForTimeout(1200);
      return sel;
    }
  }
  throw new Error(`пункт меню «${text}» не найден ни одним из селекторов: ${candidates.join(' | ')}`);
}

export async function dismissOnboardingDialogs(page) {
  await page.evaluate(() => {
    if (window.__onboardingDialogsBlocker) return;

    const isOnboarding = (el) => {
      const title = el.querySelector('.q-toolbar__title, .modal-base__title, h1, h2, h3, h4')?.textContent || '';
      if (/Прочитайте и подпишите/i.test(title)) return true;
      const body = el.textContent || '';
      // «Подписать» есть только когда документ уже сформирован; на стадии
      // «Формируем документ…» (PDF ещё рендерится, на стенде подпись зависает)
      // кнопки нет — ловим диалог и по этой фразе, иначе кадр захватит спиннер.
      if (/Прочитайте и подпишите документ/i.test(body) && /Подписать/i.test(body)) return true;
      return /Формируем документ/i.test(body) && /Прочитайте и подпишите/i.test(body);
    };

    // Quasar q-dialog рендерит контент через Teleport в q-portal--dialog--N.
    // v-show / transition мехнизмы могут перезаписывать inline style.display
    // даже с !important (Vue 3 v-show через el.style.display = ...). CSS-rule
    // с !important работает, НО Quasar также пересоздаёт q-portal-узлы при
    // mount/unmount. Самый надёжный путь — физически удалить узел: Vue не
    // сможет восстановить контент, так как Teleport target исчез. Это
    // вызовет warn в консоли, но визуально UI чист.
    const hide = (el) => {
      if (!el.parentNode) return;
      el.remove();
    };

    const cleanupBody = () => {
      document.body.classList.remove(
        'q-body--prevent-scroll',
        'q-body--has-fixed-dialog',
        'q-body--has-dialog',
      );
      document.body.style.paddingRight = '';
    };

    const scan = () => {
      let touched = 0;
      const portals = document.querySelectorAll('[id^="q-portal--dialog--"]');
      if (portals.length > 0 && !window.__onboardingScanLogged) {
        window.__onboardingScanLogged = true;
        portals.forEach((el) => {
          console.log(`[onboarding-blocker] portal ${el.id} visible=${getComputedStyle(el).display !== 'none'} bodyLen=${el.textContent?.length} onboarding=${isOnboarding(el)} hidden=${el.dataset.onboardingHidden === '1'}`);
        });
      }
      portals.forEach((el) => {
        const onboarding = isOnboarding(el);
        if (onboarding && el.dataset.onboardingHidden !== '1') {
          hide(el);
          touched++;
        }
      });
      if (touched > 0) {
        cleanupBody();
        console.log(`[onboarding-blocker] hidden ${touched} of ${portals.length} portals`);
        window.__onboardingScanLogged = false; // позволить новый дамп если новые портал-диалоги появятся
      }
    };

    const observer = new MutationObserver((mutations) => {
      // Не дёргаем scan на каждой мутации; делаем единый проход на любом
      // добавлении узлов в body.
      for (const m of mutations) {
        if (m.addedNodes.length > 0 || m.type === 'characterData') {
          scan();
          break;
        }
      }
      // Также: если body заново получил q-body--prevent-scroll, а все наши
      // скрытые порталы остались в DOM — снимаем класс. Это случается при
      // перерендере (Vue добавляет класс через q-dialog logic).
      const hasHidden = document.querySelector('[id^="q-portal--dialog--"][data-onboarding-hidden="1"]');
      if (hasHidden) cleanupBody();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Также — переодический scan на случай если MutationObserver промахнётся.
    const interval = setInterval(scan, 1000);

    window.__onboardingDialogsBlocker = { observer, interval };
    scan();
  });
  // Дать MutationObserver'у время прожать первый scan и скрыть существующие диалоги.
  await page.waitForTimeout(400);

  // Активный wait: убедиться, что нет ни одного видимого онбординг-портала.
  // Vue может смонтировать новые q-portal--dialog с задержкой 1-5 сек после
  // navigation, и observer должен их поймать — здесь мы просто блокируем до
  // отсутствия видимых онбординг-порталов на экране (до 12 сек).
  await page.waitForFunction(
    () => {
      const portals = Array.from(document.querySelectorAll('[id^="q-portal--dialog--"]'));
      const isOnboarding = (el) => {
        const body = el.textContent || '';
        return /Прочитайте и подпишите документ/i.test(body) && /Подписать/i.test(body);
      };
      return !portals.some((p) => isOnboarding(p) && getComputedStyle(p).display !== 'none');
    },
    { timeout: 12_000, polling: 200 },
  ).catch(() => {});
}

// Реально подписывает каскад типовых соглашений первого входа (Цифровой
// Кошелёк, ЭП, политика ПД, пользовательское). В отличие от
// dismissOnboardingDialogs (который DOM-hack'ом убирает порталы и проскакивает
// вперёд) — клик «Подписать» отправляет wallet::signagree on-chain, что нужно
// чтобы пайщик стал участником wallet-программы (иначе is_can_transfer fails
// на любом transfer от/к этому юзеру, см. inc 2026-05-18 #67).
//
// Возвращает { signed, attempts }: сколько диалогов реально подписалось vs
// сколько раз пытались найти следующий. Останавливаемся когда не найден ни
// один видимый «Подписать» в течение probeMs (значит каскад исчерпан).
export async function signOnboardingAgreements(page, opts = {}) {
  const {
    maxAgreements = 6,
    probeMs = 6000,
    dialogTimeoutMs = 30000,
    pauseBetweenMs = 1500,
  } = opts;
  let signed = 0;
  let attempts = 0;

  for (let i = 0; i < maxAgreements; i++) {
    attempts++;
    // Quasar монтирует портал-диалоги в q-portal--dialog--N. На каскаде
    // соглашений у chairman'а сразу 4 портала; видимый/активный — последний
    // (top-most), остальные перекрыты overlay. Берём «Подписать» из последнего.
    const sign = page.locator('button:visible:has-text("Подписать")').last();
    const visible = await sign.waitFor({ state: 'visible', timeout: probeMs }).then(() => true).catch(() => false);
    if (!visible) break;

    // Документ может ещё генерироваться (loader на кнопке). Дать ему отрисовать.
    await page.waitForTimeout(400);
    // force:true чтобы пройти overlay-intercept от соседних модалок.
    await sign.click({ force: true });

    // Ждём пока кнопка «Подписать» этого диалога исчезнет — обычно signagree
    // отправляется через 1-3 секунды (chain confirmation).
    await sign.waitFor({ state: 'hidden', timeout: dialogTimeoutMs }).catch(() => {});
    await page.waitForTimeout(pauseBetweenMs);
    signed++;
  }
  return { signed, attempts };
}

// Снимает overlay'и vite-plugin-checker (vue-tsc/eslint), vite HMR error
// overlay и custom-element <vite-error-overlay>, чтобы они не попадали на
// скриншоты при срабатывании HMR во время сценария. Безопасна: если оверлеев
// нет — ничего не делает.
export async function cleanViteOverlays(page, opts = {}) {
  await page.evaluate((preserveNotifications) => {
    document.querySelectorAll('vite-error-overlay').forEach((el) => el.remove());
    document.querySelectorAll('vite-plugin-checker-error-overlay').forEach((el) => el.remove());
    // q-notification toast'ы — это user-feedback, обычно мешают «чистому»
    // кадру; снимаем. Но для success/fail-кадров, где тост — суть кадра,
    // сценарий передаёт preserveNotifications.
    if (!preserveNotifications) {
      document.querySelectorAll('.q-notification').forEach((el) => el.remove());
      document.querySelectorAll('.q-notifications__list > *').forEach((el) => el.remove());
    }
  }, opts.preserveNotifications ?? false);
}

// Создаёт shot-функцию + manifest для сценария.
// mode — что сценарий производит помимо вердикта (см. GOAL.md):
//   'docs'  — кадры + проза + install в components/docs (страница инструкции);
//   'shots' — кадры без прозы: визуальный след, смотрится глазами;
//   'test'  — только вердикт; PNG не пишется, opts.expect по-прежнему работает.
// Проверки идут одинаково во всех режимах — режим управляет лишь артефактами.
export function makeShotContext({ scenarioName, outDir, mode = 'docs' }) {
  const shots = [];
  const noPng = mode === 'test';
  async function shot(page, name, description, opts = {}) {
    const filePath = path.join(outDir, `${name}.png`);
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // Опциональный expect перед снимком: падает шумно, а не тихо.
    if (opts.expect) await opts.expect(page);

    if (noPng) {
      const entry = { name, description, url: page.url(), skipped: 'mode=test', at: new Date().toISOString() };
      shots.push(entry);
      console.log(`  ✓ ${name} (проверка без кадра)`);
      return entry;
    }

    await page.waitForTimeout(opts.delay ?? 300);
    await cleanViteOverlays(page, { preserveNotifications: opts.preserveNotifications });

    // Экраны, которые никогда не бывают правильным содержимым кадра. Раньше
    // сценарий спокойно снимал «404» под именем «список ПВЗ» и считался
    // пройденным — документация получала картинку ошибки, а тест молчал.
    // Сценарию, который проверяет сам отказ, достаточно передать
    // { allowError: true } — тогда кадр разрешён осознанно.
    if (!opts.allowError) {
      const blocker = await page.evaluate(() => {
        const t = document.body.innerText || '';
        if (t.includes('404 страница не найдена')) return '404 — маршрута нет';
        if (t.includes('Недостаточно прав доступа')) return 'отказ в правах доступа';
        return null;
      });
      if (blocker) {
        throw new Error(`кадр «${name}»: на экране ${blocker} (${page.url()})`);
      }
    }

    await page.screenshot({ path: filePath, fullPage: opts.fullPage ?? false });
    const entry = {
      name,
      description,
      file: `${name}.png`,
      // Абсолютный путь — нужен сценариям, которые после shot вызывают annotate()
      // или другую пост-обработку PNG; в manifest путь не сериализуем.
      path: filePath,
      url: page.url(),
      at: new Date().toISOString(),
    };
    shots.push(entry);
    console.log(`  📸 ${name} → ${filePath}`);
    return entry;
  }

  // Снимает конкретный DOM-элемент (по selector или Locator) в его нативном рендере.
  // opts.zoom — временный CSS zoom (×N), при котором фоны и шрифты ререндерятся
  //   в целевом размере: ×2.5 даёт чёткий крупный PNG без ресэмплинга битмапа.
  // opts.padding — дополнительные px вокруг элемента (растянет bbox, чтобы захватить тень/обводку).
  async function shotElement(pageOrLocator, name, description, selectorOrLocator, opts = {}) {
    const page = pageOrLocator.page ? pageOrLocator.page() : pageOrLocator;
    const locator = typeof selectorOrLocator === 'string'
      ? page.locator(selectorOrLocator).first()
      : selectorOrLocator;
    await locator.waitFor({ state: 'visible', timeout: 15000 });

    const zoom = opts.zoom ?? 1;
    // Применяем zoom через CSS — элемент реально ре-лейаутится на zoom×,
    // шрифты/иконки ре-растеризуются нативно. Восстанавливаем в finally.
    if (zoom !== 1) {
      await locator.evaluate((el, z) => {
        el.dataset._prevZoom = el.style.zoom || '';
        el.style.zoom = String(z);
      }, zoom);
      await page.waitForTimeout(100); // reflow
    }

    const filePath = path.join(outDir, `${name}.png`);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await cleanViteOverlays(page);
    try {
      if (opts.padding) {
        const box = await locator.boundingBox();
        const p = opts.padding;
        await page.screenshot({
          path: filePath,
          clip: {
            x: Math.max(0, box.x - p), y: Math.max(0, box.y - p),
            width: box.width + p * 2, height: box.height + p * 2,
          },
        });
      } else {
        await locator.screenshot({ path: filePath });
      }
    } finally {
      if (zoom !== 1) {
        await locator.evaluate(el => { el.style.zoom = el.dataset._prevZoom || ''; delete el.dataset._prevZoom; });
      }
    }

    const entry = {
      name, description, file: `${name}.png`,
      url: page.url(), element: true, zoom,
      at: new Date().toISOString(),
    };
    shots.push(entry);
    console.log(`  📸 ${name} (element${zoom !== 1 ? ` ×${zoom}` : ''}) → ${filePath}`);
    return entry;
  }

  async function writeManifest(meta) {
    // path в entry — абсолютный, для пост-обработки в сценарии. В манифест
    // его не пишем: он привязан к локальной FS и засоряет diff'ы при коммите.
    const sanitized = shots.map(({ path: _, ...rest }) => rest);
    const manifest = { scenario: scenarioName, meta, shots: sanitized };
    await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    return manifest;
  }
  return { shot, shotElement, shots, writeManifest };
}

export { expect };
