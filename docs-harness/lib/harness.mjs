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
  page.on('console', m => consoleLog.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => consoleLog.push(`[pageerror] ${e.message}`));
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
    const manifest = { scenario: scenarioName, meta, shots };
    await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    return manifest;
  }
  return { shot, shotElement, shots, writeManifest };
}

export { expect };
