// Сценарий: председатель кооперативного участка принимает возвращаемое
// имущество по заявлению пайщика.
//
// Обработка заявления двухступенчатая, и обе ступени делает один и тот же
// человек на одном столе:
//
//  1. удалённо, по фотографиям — пригласить пайщика на очный осмотр либо
//     отказать сразу;
//  2. очно, с имуществом на руках — принять возврат либо отказать на месте.
//
// Принятие возврата — единственный шаг, который двигает деньги: средства
// восстанавливаются пайщику, а имущество зачисляется на склад участка
// обезличенным остатком кооператива. Этот остаток потом и становится
// кандидатом на списание.
//
// Фикстура: chairkrg — председатель КУ Красногорск, к нему привязан заказ.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs, pickBranchIfAsked } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'),
  );

/** Что председатель пишет пайщику, приглашая на очный осмотр. */
const VISIT_INVITE = 'Приходите с продукцией в часы работы участка — осмотрим на месте.';

/** Результат очного осмотра — обязательное поле, без него приём не подтвердить. */
const INSPECTION_RESULT =
  'Упаковка вскрыта, продукт с посторонним запахом — дефект подтверждён при осмотре.';

export const meta = {
  title: 'Стол ПВЗ — приём возвращаемого имущества',
  docPath: 'new/marketplace/operator/return-accept.md',
  assetsDir: 'assets/new/marketplace/operator/return-accept',
  role: 'user',
  mode: 'docs',
  fixture: 'chairkrg',
  fixtures: ['chairkrg'],
  feature: 'marketplace.return',
  cases: ['mkt.ret.happy.02'],
  prepare: [
    'marketplace:01-l1-accept',
    'marketplace:02-branches',
    'marketplace:03-assign-branches',
    'marketplace:04-supplier',
    'marketplace:05-sign-offer',
    'marketplace-deposits:fund',
  ],
};

export default async ({ page, shot, expect }) => {
  await loginAs(page, loadFixture('chairkrg'));
  await pickBranchIfAsked(page);

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

  await shot(
    page,
    '01-claims-list',
    'Лента гарантийных возвратов участка: заявление пайщика ждёт рассмотрения. Табы разделяют работу по стадиям — ждут рассмотрения, ожидают визита, архив.',
  );

  await claimRow.click();
  await page.waitForFunction(() => document.body.innerText.includes('Хронология')
    || document.body.innerText.includes('Обращение'), { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '02-claim-detail',
    'Карточка заявления: обращение пайщика, фотографии товара, суммы к возврату и хронология. Отсюда принимается решение.',
  );

  // ── Ступень 1: удалённое решение ────────────────────────────────────────
  await page.locator('button:has-text("Принять решение")').first().click({ timeout: 20000 });

  const remoteDialog = page.locator('.mp-takeover').first();
  await remoteDialog.waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(600);

  // Приглашение на очный осмотр выбрано по умолчанию; комментарий при нём
  // необязателен, но в документации важно показать, что пайщику пишут.
  await remoteDialog.locator('textarea').first().fill(VISIT_INVITE);
  await cleanViteOverlays(page);

  await shot(
    page,
    '03-remote-decision',
    'Удалённое решение по фотографиям: пригласить заказчика на очный осмотр либо отказать сразу. Отказ обязан быть мотивирован, приглашение — нет.',
  );

  await remoteDialog.locator('.mp-takeover__confirm').click();

  // После приглашения заявление переходит в «ожидает визита», и на карточке
  // появляется второе действие — очный осмотр.
  const onSiteBtn = page.locator('button:has-text("Очный осмотр")').first();
  await onSiteBtn.waitFor({ state: 'visible', timeout: 90000 });
  await page.waitForTimeout(1200);
  await cleanViteOverlays(page);

  await shot(
    page,
    '04-approved-for-visit',
    'Заявление одобрено к очному осмотру: пайщик приглашён на участок с имуществом. Пока осмотр не проведён, деньги не двигаются.',
  );

  // ── Ступень 2: очный осмотр и приём ─────────────────────────────────────
  await onSiteBtn.click();

  const onSiteDialog = page.locator('.mp-takeover').first();
  await onSiteDialog.waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(600);

  // Результат осмотра — обязательное поле: без него кнопка подтверждения
  // остаётся заблокированной.
  await onSiteDialog.locator('textarea').first().fill(INSPECTION_RESULT);
  await page.waitForTimeout(400);
  await cleanViteOverlays(page);

  await shot(
    page,
    '05-onsite-inspection',
    'Очный осмотр: председатель фиксирует, что обнаружено, и принимает возврат. Подтверждение — вторая подпись на том же заявлении пайщика, контракт требует обе.',
  );

  await onSiteDialog.locator('.mp-takeover__confirm').click();

  // Приём возврата — движение средств на цепи плюс зачисление имущества на
  // склад, ждём дольше обычного.
  await page.locator('text=Восстановлено пайщику').first().waitFor({ state: 'visible', timeout: 120000 });
  await page.waitForTimeout(1500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '06-return-accepted',
    'Возврат принят: средства восстановлены пайщику, имущество зачислено на склад участка обезличенным остатком кооператива. Дальше председатель либо предлагает его снова, либо списывает.',
    {
      expect: async (p) => {
        // Деньги вернулись — это и есть результат приёма, а не сам факт клика.
        await expect(p.locator('text=Восстановлено пайщику').first()).toBeVisible({ timeout: 20000 });
        // Решение окончательное — действий по заявлению больше нет.
        await expect(p.locator('button:has-text("Очный осмотр")')).toHaveCount(0);
        await expect(p.locator('button:has-text("Принять решение")')).toHaveCount(0);
      },
    },
  );
};
