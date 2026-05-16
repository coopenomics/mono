// Общие хелперы для сценариев документации.
// Контракт сценария: default export async ({ page, context, shot, expect, env }) => {}
// shot(name, description) — снимает viewport-скриншот, добавляет запись в manifest,
//   падает с ошибкой если соответствующий селектор (если передан) не виден.

import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const HARNESS_ROOT = path.resolve(__dirname, '..');
export const REPO_ROOT = path.resolve(HARNESS_ROOT, '..');

export const env = {
  BASE_URL: process.env.BASE_URL || 'http://127.0.0.1:2999',
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
  const debugConsole = process.env.DEBUG_CONSOLE === '1';
  page.on('console', m => {
    const line = `[${m.type()}] ${m.text()}`;
    consoleLog.push(line);
    if (debugConsole) console.log('  [browser]', line.slice(0, 300));
  });
  page.on('pageerror', e => {
    consoleLog.push(`[pageerror] ${e.message}`);
    if (debugConsole) console.log('  [browser pageerror]', e.message.slice(0, 300));
  });
  page.on('requestfailed', r => {
    const u = r.url();
    if (!u.includes('/src/') && !u.includes('/node_modules/') && !u.includes('/@vite')) {
      consoleLog.push(`[reqfail] ${u} — ${r.failure()?.errorText}`);
    }
  });

  return { browser, context, page, consoleLog };
}

// Логин председателя через форму. Кэширует storageState.
export async function loginAsChairman(page, context) {
  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/auth/signin`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('button:has-text("Войти")', { timeout: 60000 });
  await page.locator('label:has-text("электронную почту")').locator('input').fill(env.CHAIRMAN_EMAIL);
  await page.locator('label:has-text("ключ доступа")').locator('input').fill(env.CHAIRMAN_WIF);
  await page.locator('button:has-text("Войти")').click();
  await page.waitForURL(/\/(chairman|participant|soviet)/, { timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
}

// Логин обычного пайщика по фикстуре (state/participants/<username>.json).
// fixture: { username, email, wif, ... }
export async function loginAs(page, fixture) {
  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/auth/signin`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('button:has-text("Войти")', { timeout: 60000 });
  await page.locator('label:has-text("электронную почту")').locator('input').fill(fixture.email);
  await page.locator('label:has-text("ключ доступа")').locator('input').fill(fixture.wif);
  await page.locator('button:has-text("Войти")').click();
  await page.waitForURL(/\/(chairman|participant|soviet|user)/, { timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
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
export async function dismissOnboardingDialogs(page) {
  await page.evaluate(() => {
    if (window.__onboardingDialogsBlocker) return;

    const isOnboarding = (el) => {
      const title = el.querySelector('.q-toolbar__title, .modal-base__title, h1, h2, h3, h4')?.textContent || '';
      if (/Прочитайте и подпишите/i.test(title)) return true;
      const body = el.textContent || '';
      return /Прочитайте и подпишите документ/i.test(body) && /Подписать/i.test(body);
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

// Создаёт shot-функцию + manifest для сценария.
export function makeShotContext({ scenarioName, outDir }) {
  const shots = [];
  async function shot(page, name, description, opts = {}) {
    const filePath = path.join(outDir, `${name}.png`);
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // Опциональный expect перед снимком: падает шумно, а не тихо.
    if (opts.expect) await opts.expect(page);

    await page.waitForTimeout(opts.delay ?? 300);
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
