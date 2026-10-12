// Сценарий: Председатель кооператива принимает ЦПП «Стол заказов».
// Эпик 1 / Story 1.9-1.10 — L1 онбординг кооператива.
//
// Председатель видит статус ЦПП (active / not_accepted) и кнопку
// «Принять ЦПП Marketplace». После клика — диалог подтверждения с
// stub `accepted_by_board_decision_id` (в MVP — текстовая ссылка;
// полноценная повестка совета — FR40 / Эпик 8, Phase 2).
//
// Фикстура: chairman кооператива (ant, Иван Иванов).

import { loginAsChairman, dismissOnboardingDialogs } from '../../../lib/harness.mjs';
import { runSeedPhase } from '../../../lib/fixtures.mjs';

export const meta = {
  mode: 'docs',
  // Сценарий живёт в группе L0 сюиты: раннер прогоняет её ДО глобальных
  // prepare-фаз, поэтому ЦПП здесь ещё не принята и процесс снимается живым.
  // Первый документ председатель выносит на совет кликами; голоса совета,
  // протокол и второй документ доводит фаза 01-l1-accept (runSeedPhase) —
  // она подхватывает уже опубликованное решение по hash шага.
  feature: 'marketplace.onboarding',
  cases: ['mkt.onb.ui.02'],
  title: 'L1 онбординг — приём ЦПП «Стол заказов» кооперативом',
  docPath: 'new/marketplace/connection/coop-accept-cpp.md',
  assetsDir: 'assets/new/marketplace/connection/coop-accept-cpp',
  role: 'chairman',
};

async function signAllAgreements(page) {
  await page.waitForFunction(
    () => !document.body.innerText.includes('Формируем документ'),
    { timeout: 30000 },
  ).catch(() => {});
  await page.waitForTimeout(500);
  for (let i = 0; i < 8; i++) {
    const clicked = await page.evaluate(() => {
      const portals = Array.from(document.querySelectorAll('[id^="q-portal--dialog--"]'))
        .filter((p) => getComputedStyle(p).display !== 'none');
      if (portals.length === 0) return false;
      const top = portals[portals.length - 1];
      const btn = Array.from(top.querySelectorAll('button'))
        .find((b) => b.textContent?.trim() === 'Подписать' && !b.disabled);
      if (!btn) return false;
      btn.scrollIntoView({ block: 'center', behavior: 'instant' });
      btn.click();
      return true;
    });
    if (!clicked) break;
    await page.waitForTimeout(3500);
  }
}

export default async ({ page, context, shot, env, expect }) => {
  await loginAsChairman(page, context);
  await signAllAgreements(page);
  await dismissOnboardingDialogs(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-admin/onboarding/coop-cpp`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('text=Подключение ЦПП', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await dismissOnboardingDialogs(page);

  // Карточка подключения советом (CouncilOnboardingCard): «Объявить все (N)»
  // либо «Объявить вопрос», подтверждение «Объявить», метка «В совете».
  const announceBtn = page.locator('button:has-text("Объявить все"), button:has-text("Объявить вопрос"), button:has-text("Объявить собрание совета")').first();
  const notAccepted = (await announceBtn.count()) > 0;

  await shot(
    page,
    '01-status',
    'Страница подключения ЦПП «Стол заказов». Совет утверждает два документа по очереди — Положение ЦПП и шаблон публичной оферты; пока оба не утверждены, статус «Не подключено», а шаги добавления участков и пунктов выдачи заблокированы.',
  );

  if (notAccepted) {
    await announceBtn.click();
    await page.locator('.q-dialog').first().waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(800);

    await shot(
      page,
      '02-announce-dialog',
      'Подтверждение объявления: вопросы уйдут в совет по порядку проектами решений — Положение о ЦПП «Стол заказов» и шаблон публичной оферты. Кнопка «Объявить» подписывает проекты и выносит их на повестку совета.',
    );

    await page.locator('.q-dialog button:has-text("Объявить")').last().click();
    await page.waitForTimeout(2000);
    await signAllAgreements(page);
    await page.locator('text=В совете, text=Ожидаем решение совета').first()
      .waitFor({ state: 'visible', timeout: 120000 });
    await page.waitForTimeout(800);
    await dismissOnboardingDialogs(page);

    await shot(
      page,
      '03-waiting-council',
      'Вопросы ушли в совет: у шагов метка «В совете». Члены совета голосуют на своём столе, после протокола председателя документ считается утверждённым.',
    );

    // Голоса трёх членов совета, протокол, исполнение и второй документ —
    // фаза 01: она подхватывает опубликованное решение по hash шага и не
    // создаёт дубликата. В жизни это делает совет на своём столе.
    runSeedPhase('01-l1-accept', { log: (m) => console.log(`[coop-accept-cpp] ${m}`) });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await dismissOnboardingDialogs(page);
  }

  await shot(
    page,
    '04-connected',
    'ЦПП «Стол заказов» подключена: совет утвердил Положение и шаблон оферты, оферта зарегистрирована, пайщики могут пользоваться столом. Ниже разблокированы оставшиеся шаги подключения — кооперативные участки и пункты выдачи.',
    {
      expect: async (p) => {
        await expect(p.locator('text=«Стол заказов» подключена').first())
          .toBeVisible({ timeout: 30000 });
      },
    },
  );
};
