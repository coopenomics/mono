// Общий сканер стола ПВЗ (598-62) — один путь для всех сценариев участка.
//
// На столе ПВЗ одна кнопка «Сканировать» в шапке страницы. Оператор вводит
// ЛЮБОЙ код, сервер разбирает его и отвечает визитом: кто пришёл и какие дела
// у него на участке (выдать, принять поставку, гарантийный возврат). Одно дело
// стол открывает сразу, несколько — листом выбора «Пайщик на пункте выдачи».
//
// Камеры в harness нет, поэтому код вводится штатным ручным вводом окна
// сканера. Прежние коды вида `blago:<вид>:<кооператив>:<пайщик>` сервер больше
// не принимает; ручной ввод оператора понимает логин пайщика — его и вводим.

import { cleanViteOverlays } from './harness.mjs';

/** Подписи кнопок листа выбора по виду дела (marketplace.universalScannerHost). */
const MATTER_LABEL = {
  issuance: 'Выдать заказы',
  reception: 'Принять поставку',
  return: 'Гарантийный возврат',
};

/** Кнопка общего сканера в шапке страницы стола ПВЗ. */
export function scanButton(page) {
  return page.locator('#header-actions-host button:has-text("Сканировать")').first();
}

/**
 * Открывает окно сканера и ждёт поле ручного ввода. Окно ищется по своему
 * содержимому: обёртка q-portal нулевого размера и «скрыта» всегда.
 */
export async function openScanner(page) {
  await scanButton(page).waitFor({ state: 'visible', timeout: 60000 });
  await scanButton(page).click();
  const dialog = page
    .locator('.q-dialog__inner:visible')
    .filter({ hasText: 'Или введите код вручную' })
    .first();
  await dialog.waitFor({ state: 'visible', timeout: 20000 });
  return dialog;
}

/**
 * Вводит код в открытое окно сканера и применяет его.
 *
 * Поле с очисткой перерисовывается под вводом — печатаем посимвольно.
 */
export async function submitCode(page, dialog, code) {
  const input = dialog.locator('input').first();
  await input.click();
  await input.type(code, { delay: 20 });
  await page.waitForTimeout(400);
  await dialog.locator('button:has-text("Применить")').first().click();
}

/**
 * Лист выбора «Пайщик на пункте выдачи» появляется, только если у пайщика на
 * участке несколько дел. Хост сначала закрывает окно сканера и потом решает,
 * поэтому звать после закрытия окна. Выбирает дело `matter`.
 */
export async function pickMatterIfAsked(page, matter) {
  const choice = page
    .locator('.q-dialog__inner:visible')
    .filter({ hasText: 'Пайщик на пункте выдачи' })
    .first();
  const asked = await choice
    .waitFor({ state: 'visible', timeout: 2500 })
    .then(() => true)
    .catch(() => false);
  if (asked) {
    await choice.locator(`button:has-text("${MATTER_LABEL[matter]}")`).first().click();
  }
}

/**
 * Полный ход: «Сканировать» → ручной ввод → визит → нужное дело.
 * `matter` — issuance | reception | return.
 */
export async function scanOnPvz(page, code, { matter } = {}) {
  const dialog = await openScanner(page);
  await submitCode(page, dialog, code);
  // Отказ сервера (неизвестный код) оставляет окно открытым — дела нет.
  const closed = await dialog
    .waitFor({ state: 'hidden', timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  if (closed && matter) await pickMatterIfAsked(page, matter);

  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await cleanViteOverlays(page);
}
