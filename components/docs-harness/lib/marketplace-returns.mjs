// Приём гарантийного возврата председателем участка — общий поток для
// сценариев (обычный заказ и заказ из остатка кооператива).
//
// Поток двухступенчатый и одинаков для любого заказа: удалённое решение по
// фотографиям (пригласить на осмотр либо отказать) → очный осмотр с приёмом.
// Различается только то, что при этом происходит с имуществом, — поэтому
// подписи кадров сценарий задаёт свои.

import { cleanViteOverlays, env } from './harness.mjs';

/**
 * Проводит первое заявление в ленте участка через обе ступени до приёма.
 *
 * @param {object} ctx — контекст сценария: page, shot, expect.
 * @param {object} texts — тексты, которые вводит председатель.
 * @param {object} captions — подписи кадров по ключам шагов; описание кадра
 *   привязано к смыслу конкретного сценария, поэтому задаётся снаружи.
 */
export async function acceptFirstReturnClaim({ page, shot, expect }, { texts, captions }) {
  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-pvz/returns`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForFunction(() => document.body.innerText.includes('заявлени'), { timeout: 90000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await cleanViteOverlays(page);

  // Заявление пайщика подано предыдущим сценарием — в ленте участка оно
  // обязано быть, иначе принимать нечего.
  const claimRow = page.locator('.return-row').first();
  await claimRow.waitFor({ state: 'visible', timeout: 30000 });

  await shot(page, '01-claims-list', captions.list);

  await claimRow.click();
  await page
    .waitForFunction(
      () =>
        document.body.innerText.includes('Хронология') || document.body.innerText.includes('Обращение'),
      { timeout: 30000 }
    )
    .catch(() => {});
  await page.waitForTimeout(1500);
  await cleanViteOverlays(page);

  await shot(page, '02-claim-detail', captions.detail);

  // ── Ступень 1: удалённое решение ────────────────────────────────────────
  await page.locator('button:has-text("Принять решение")').first().click({ timeout: 20000 });

  // Диалоги двух ступеней различаем по заголовку, а не по `.first()`: на
  // переходе между ними в разметке недолго живут оба, и безымянный селектор
  // может поймать закрывающийся.
  const remoteDialog = page.locator('.mp-takeover').filter({ hasText: 'Удалённое решение' }).first();
  await remoteDialog.waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(600);

  // Приглашение на очный осмотр выбрано по умолчанию; комментарий при нём
  // необязателен, но в документации важно показать, что пайщику пишут.
  await remoteDialog.locator('textarea').first().fill(texts.visitInvite);
  await cleanViteOverlays(page);

  await shot(page, '03-remote-decision', captions.remoteDecision);

  await remoteDialog.locator('.mp-takeover__confirm').click();

  // После приглашения заявление переходит в «ожидает визита», и на карточке
  // появляется второе действие — очный осмотр.
  const onSiteBtn = page.locator('button:has-text("Очный осмотр")').first();
  await onSiteBtn.waitFor({ state: 'visible', timeout: 90000 });
  await page.waitForTimeout(1200);
  await cleanViteOverlays(page);

  await shot(page, '04-approved-for-visit', captions.approvedForVisit);

  // ── Ступень 2: очный осмотр и приём ─────────────────────────────────────
  await onSiteBtn.click();

  const onSiteDialog = page.locator('.mp-takeover').filter({ hasText: 'Очный осмотр по заявлению' }).first();
  await onSiteDialog.waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(600);

  // Результат осмотра — обязательное поле: без него кнопка подтверждения
  // остаётся заблокированной.
  await onSiteDialog.locator('textarea').first().fill(texts.inspectionResult);
  await page.waitForTimeout(400);
  await cleanViteOverlays(page);

  await shot(page, '05-onsite-inspection', captions.onsiteInspection);

  await onSiteDialog.locator('.mp-takeover__confirm').click();

  // Приём возврата — движение средств на цепи плюс зачисление имущества на
  // склад, ждём дольше обычного.
  await page.locator('text=Восстановлено пайщику').first().waitFor({ state: 'visible', timeout: 120000 });
  await page.waitForTimeout(1500);
  await cleanViteOverlays(page);

  await shot(page, '06-return-accepted', captions.accepted, {
    expect: async (p) => {
      // Деньги вернулись — это и есть результат приёма, а не сам факт клика.
      await expect(p.locator('text=Восстановлено пайщику').first()).toBeVisible({ timeout: 20000 });
      // Решение окончательное — действий по заявлению больше нет.
      await expect(p.locator('button:has-text("Очный осмотр")')).toHaveCount(0);
      await expect(p.locator('button:has-text("Принять решение")')).toHaveCount(0);
    },
  });
}
