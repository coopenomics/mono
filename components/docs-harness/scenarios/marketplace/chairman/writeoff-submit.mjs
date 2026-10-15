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

import { runSeedPhase } from '../../../lib/fixtures.mjs';
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
  // Робот совета утверждает списание за секунду — ручной путь совета (сценарий
  // writeoff-authorize) с ним не снять. Выключаем; обратно включает
  // writeoff-authorize после своих кадров.
  runSeedPhase('08-robot-off', { log: (m) => console.log(`[writeoff-submit] ${m}`) });

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

  // Главное действие стола — кнопка «Отправить» в шапке. Пока ничего не
  // выделено, она закрыта: пустой проект в совет не уходит.
  const submitBtn = page.locator('#header-actions-host button').filter({ hasText: 'Отправить' }).first();

  await shot(
    page,
    '01-candidates',
    'Кандидаты на списание — имущество на складах участков. «Просрочен» — первоочередные, «Без гарантии» — можно списать сразу, «Годен» — ещё в сроке. Пока ничего не выделено, кнопка «Отправить» в шапке закрыта.',
    {
      expect: async () => {
        await expect(submitBtn).toBeDisabled({ timeout: 20000 });
      },
    },
  );

  await firstCandidate.locator('.q-checkbox').first().click();
  await page.waitForTimeout(500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '02-selected',
    'Позиция выделена: кнопка «Отправить» в шапке стала доступной и показывает число выделенных позиций, под таблицей — их сумма.',
    {
      expect: async () => {
        await expect(submitBtn).toBeEnabled({ timeout: 20000 });
      },
    },
  );

  await submitBtn.click({ timeout: 20000 });

  // Окно «Отправка списания в совет»: сначала причина, затем Заявление.
  const dialog = page.locator('[id^="q-portal--dialog--"]').filter({ hasText: 'Причина списания' }).first();
  // Обёртка портала для Playwright «скрыта» всегда — ждём поле внутри окна.
  const reasonInput = dialog.locator('.q-field', { hasText: 'Причина списания' }).locator('input').first();
  await reasonInput.waitFor({ state: 'visible', timeout: 30000 });
  await reasonInput.fill(WRITEOFF_REASON);
  await page.waitForTimeout(400);

  await shot(
    page,
    '02b-reason',
    'Окно отправки в совет: число выделенных позиций, их сумма и причина списания. Причина попадает в Заявление и в проект решения совета.',
  );

  // «Далее» — последняя кнопка подвала окна; сервер формирует Заявление.
  await dialog.locator('button:has-text("Далее")').last().click();
  const signDialog = page.locator('[id^="q-portal--dialog--"]').filter({ has: page.locator('.submit-council__doc') }).first();
  await signDialog.locator('.submit-council__doc').waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForTimeout(800);
  await cleanViteOverlays(page);

  await shot(
    page,
    '03-statement-preview',
    'Заявление о списании скоропорта целиком: состав имущества, суммы, причина. Подпись председателя выносит вопрос на повестку совета — сама по себе она имущество не списывает.',
  );

  // «Подписать» — последняя кнопка подвала окна с документом.
  await signDialog.locator('button').last().click();

  // После подписи стол сам переключается на вкладку «На повестке». Ждём строку
  // таблицы проектов со статусом, а не текст «На повестке»: так называется
  // ещё и вкладка, она есть на странице всегда.
  const agendaRow = page.locator('tbody tr').filter({ hasText: 'На повестке' }).first();
  await agendaRow.waitFor({ state: 'visible', timeout: 90000 });
  await page.waitForTimeout(2000);
  await cleanViteOverlays(page);

  await shot(
    page,
    '04-on-agenda',
    'Проект списания на повестке совета. Дальше слово за советом: он утверждает списание протоколом, и только после этого председатель участка проводит выбытие со склада.',
    {
      expect: async () => {
        // Проверяем результат, а не факт подписи: проект обязан появиться в
        // таблице именно со статусом «На повестке».
        await expect(agendaRow).toBeVisible({ timeout: 30000 });
      },
    },
  );
};
