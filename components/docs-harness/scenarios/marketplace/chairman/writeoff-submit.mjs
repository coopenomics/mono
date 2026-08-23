// Сценарий: председатель выделяет имущество к списанию и выносит проект на
// совет.
//
// Списание — не единоличное действие председателя: он лишь готовит проект и
// подписывает Заявление, а решение принимает совет протоколом. Поэтому здесь
// цепочка заканчивается статусом «На повестке», а не выбытием со склада.
//
// Откуда на складе участка вообще берётся имущество: обезличенный остаток
// кооператива копится из недовыдач и из принятых гарантийных возвратов
// (см. сценарий приёма возврата — он идёт раньше по цепочке). Без него
// список кандидатов пуст и выделять нечего.
//
// Фикстура: председатель кооператива.

import { cleanViteOverlays, env, loginAsChairman } from '../../../lib/harness.mjs';

/** Причина списания — обязательна, её увидит совет в Заявлении. */
const WRITEOFF_REASON = 'Возвращённый по гарантии товар с подтверждённым дефектом — к дальнейшему обороту непригоден.';

export const meta = {
  title: 'Стол председателя — выделение имущества к списанию',
  assetsDir: 'assets/new/marketplace/chairman/writeoff-submit',
  role: 'chairman',
  mode: 'docs',
  feature: 'marketplace.writeoff',
  cases: ['mkt.wof.happy.02', 'mkt.wof.side.05'],
  prepare: [
    'marketplace:01-l1-accept',
    'marketplace:02-branches',
    'marketplace:03-assign-branches',
    'marketplace:04-supplier',
    'marketplace:05-sign-offer',
    'marketplace-deposits:fund',
  ],
};

export default async ({ page, shot, expect, context }) => {
  await loginAsChairman(page, context);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-admin/writeoffs`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.locator('text=Списания скоропорта').first().waitFor({ state: 'visible', timeout: 90000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await cleanViteOverlays(page);

  // Вкладка «Кандидаты» открыта по умолчанию. Позиция на складе обязана быть —
  // её оставил принятый гарантийный возврат.
  const firstCandidate = page.locator('.q-table tbody tr').first();
  await firstCandidate.waitFor({ state: 'visible', timeout: 30000 });

  await shot(
    page,
    '01-candidates',
    'Кандидаты на списание — имущество на складах участков. «Просрочен» — первоочередные, «Без гарантии» — можно списать сразу, «Годен» — ещё в сроке. Пока ничего не выделено, подписать Заявление нельзя, а поле причины заблокировано.',
    {
      expect: async (p) => {
        // Пустой проект в совет не уходит: без выделенных позиций главное
        // действие стола заблокировано.
        await expect(p.locator('button:has-text("Подписать и отправить в совет")').first())
          .toBeDisabled({ timeout: 20000 });
      },
    },
  );

  await firstCandidate.locator('.q-checkbox').first().click();
  await page.waitForTimeout(500);

  // Поле причины разблокируется вместе с выделением — до него оно disabled.
  const reasonField = page.locator('.q-field', { hasText: 'Причина списания' }).first();
  await reasonField.locator('input').first().fill(WRITEOFF_REASON);
  await page.waitForTimeout(400);
  await cleanViteOverlays(page);

  await shot(
    page,
    '02-selected',
    'Позиция выделена, причина указана. Главное действие стола — «Подписать и отправить в совет» — стало доступным в шапке и показывает число выделенных позиций.',
  );

  await page.locator('button:has-text("Подписать и отправить в совет")').first().click({ timeout: 20000 });

  // Заявление формируется сервером — ждём сам документ, а не паузу.
  const signDialog = page.locator('.q-dialog').filter({ hasText: 'Подписание Заявления о списании' }).first();
  await signDialog.waitFor({ state: 'visible', timeout: 30000 });
  await signDialog.locator('.submit-council__doc').waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForTimeout(800);
  await cleanViteOverlays(page);

  await shot(
    page,
    '03-statement-preview',
    'Заявление о списании скоропорта целиком: состав имущества, суммы, причина. Подпись председателя выносит вопрос на повестку совета — сама по себе она имущество не списывает.',
  );

  await signDialog.locator('button:has-text("Подписать и отправить в совет")').last().click();

  // После подписи стол сам переключается на вкладку «На повестке». Ждём именно
  // строку ленты, а не текст «На повестке»: так называется ещё и таб, он есть
  // на странице всегда, и ожидание по тексту прошло бы мгновенно и впустую.
  await page.locator('.writeoffs__row').first().waitFor({ state: 'visible', timeout: 90000 });
  await page.waitForTimeout(2000);
  await cleanViteOverlays(page);

  await shot(
    page,
    '04-on-agenda',
    'Проект списания на повестке совета. Дальше слово за советом: он утверждает списание протоколом, и только после этого председатель участка проводит выбытие со склада.',
    {
      expect: async (p) => {
        // Проверяем результат, а не факт подписи: проект обязан появиться в
        // ленте именно со статусом «На повестке».
        await expect(p.locator('.writeoffs__row').first()).toBeVisible({ timeout: 30000 });
        await expect(p.locator('.writeoffs__row').filter({ hasText: 'На повестке' }).first())
          .toBeVisible({ timeout: 30000 });
      },
    },
  );
};
