// Общее для сценариев «Образования» (scenarios/edubridge/**).
//
// Маршруты столов берутся из desktop/extensions/edubridge/install.ts:
//   стол администратора — /:coopname/edubridge/…
//   стол ученика        — /:coopname/edubridge-member/…
//   стол преподавателя  — /:coopname/edubridge-teacher/…
// Состав стенда (имена, названия курса) — components/api-tests/src/seed/edubridge/index.ts.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env, cleanViteOverlays, dismissOnboardingDialogs, pickBranchIfAsked } from './harness.mjs';

const HARNESS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const EDU = {
  admin: (p) => `${env.APP_PREFIX}/${env.COOPNAME}/edubridge/${p}`,
  member: (p) => `${env.APP_PREFIX}/${env.COOPNAME}/edubridge-member/${p}`,
  teacher: (p) => `${env.APP_PREFIX}/${env.COOPNAME}/edubridge-teacher/${p}`,
  // Те же значения, что в засеве: сценарии ищут курс и людей по ним.
  COURSE_TITLE: 'Подготовка к ОГЭ по математике',
  SECTION_TITLE: 'Математика',
  TEACHER: 'orlova',
  PARENT: 'gromova',
  LEARNER_NAME: 'Громов Артём Николаевич',
};

export function loadFixture(username) {
  return JSON.parse(fs.readFileSync(path.join(HARNESS_ROOT, 'state/participants', `${username}.json`), 'utf8'));
}

/** Переход на страницу стола и ожидание её заголовка либо текста. */
export async function openPage(page, url, waitText, { timeout = 60000 } = {}) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  if (waitText) await page.waitForSelector(`text=${waitText}`, { timeout });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(900);
  await dismissOnboardingDialogs(page);
  await cleanViteOverlays(page);
}

/** После входа: диалог выбора участка и каскад соглашений платформы — не наши экраны. */
export async function settleAfterLogin(page) {
  await pickBranchIfAsked(page);
  await dismissOnboardingDialogs(page);
}

/** Поле формы по подписи (BaseInput): label → input/textarea внутри. */
export function field(page, label, kind = 'input') {
  return page.locator(`label:has-text("${label}")`).locator(kind).first();
}

export async function fill(page, label, value, kind = 'input') {
  const f = field(page, label, kind);
  await f.click();
  await f.fill(String(value));
  await page.waitForTimeout(150);
}

/** Выбор значения в BaseSelect по подписи поля и тексту пункта. */
export async function pick(page, label, optionText) {
  await page.locator(`label:has-text("${label}")`).first().click();
  const option = page.locator(`.q-menu .q-item:has-text("${optionText}")`).first();
  await option.waitFor({ state: 'visible', timeout: 15000 });
  await option.click();
  await page.waitForTimeout(300);
}

/**
 * Шаг документа в шлюзе стола (EduGateDocumentStep): документ прочитан —
 * галочка согласия — кнопка подписи. Подпись идёт ключом пайщика из сессии.
 */
export async function signGateStep(page, buttonText, { timeout = 90000 } = {}) {
  const agree = page.locator('.q-checkbox').last();
  await agree.waitFor({ state: 'visible', timeout: 60000 });
  await agree.click();
  const btn = page.locator(`button:has-text("${buttonText}")`).last();
  await btn.waitFor({ state: 'visible', timeout: 15000 });
  await btn.click();
  // Шаг исчезает после подписи: кнопка либо пропадает, либо открывается следующий шаг.
  await btn.waitFor({ state: 'hidden', timeout }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

/** Строка реестра (BaseTable) по тексту. */
export function row(page, text) {
  return page.locator('tbody tr').filter({ hasText: text }).first();
}

export async function closeDialog(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
}
