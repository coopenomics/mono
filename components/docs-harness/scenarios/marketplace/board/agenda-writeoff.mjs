// Сценарий: Совет видит ленту проектов списания скоропорта в read-only.
// Эпик 8 / Story 8.x — обзор проектов в статусах ON_AGENDA / AUTHORIZED /
// EXECUTING / EXECUTED / REJECTED.
//
// Само голосование совета — через core soviet agenda (sov-flow);
// здесь только обзор статусов и сумм потерь. Polling 30s.
//
// Фикстура: chairman кооператива (ant, Иван Иванов) — у него же доступ
// member-совета по marketplace-roles.

import { loginAsChairman, dismissOnboardingDialogs } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Повестка совета: проекты списания скоропорта',
  docPath: 'new/marketplace/board/agenda-writeoff.md',
  assetsDir: 'assets/new/marketplace/board/agenda-writeoff',
  role: 'chairman',
};

export default async ({ page, context, shot, env }) => {
  await loginAsChairman(page, context);
  await dismissOnboardingDialogs(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/board-writeoff`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('text=Повестка совета', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await dismissOnboardingDialogs(page);

  await shot(
    page,
    '01-overview',
    'Лента проектов списания в активных статусах. DRAFT-проекты скрыты — это рабочая зона администратора на /market-admin/writeoffs. Совет видит «На повестке», «Одобрены», «Исполняются», «Исполнены», «Отклонены». Голосование выполняется на core soviet agenda (sov-flow).',
  );

  // Переключиться на фильтр «На повестке» — самый важный для совета.
  const onAgendaTab = page.locator('button:has-text("На повестке"), [role="tab"]:has-text("На повестке")').first();
  if (await onAgendaTab.isVisible().catch(() => false)) {
    await onAgendaTab.click();
    await page.waitForTimeout(700);
    await shot(
      page,
      '02-on-agenda',
      'Фильтр «На повестке» — проекты в статусе ON_AGENDA. После подписи Заявления 1106 председателем (через /market-admin/writeoffs) проект отправляется в совет через soviet::createagenda(mktwroff). По решению совета callback marketplace::onmktwoauth переводит проект в AUTHORIZED.',
    );
  }
};
