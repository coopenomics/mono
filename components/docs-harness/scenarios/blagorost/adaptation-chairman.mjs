// Сценарий: «Адаптация (председатель)» — приём документов программ советом.
//
// На свежей цепочке, до того как Благорост начнёт работать в кооперативе,
// председатель проводит **адаптацию системы**: выносит на повестку совета
// пять документов двух программ (ГЕНЕРАТОР и БЛАГОРОСТ) — Положение,
// шаблон договора, шаблон оферты, и т.д. Совет голосует, председатель
// исполняет принятое решение, документ становится частью реестра. Пока все
// пять не приняты, пайщики в Благорост не пускаются.
//
// Снимаемые кадры:
//   01-overview         — лист из пяти шагов адаптации (CapitalOnboardingCard);
//   02-propose-dialog   — диалог «Предложение повестки» с проектом первого
//                          документа после клика «Объявить собрание совета».
//
// prepare:
//   capital:01-programs        — программы УХД (id=3) и Благорост (id=4).
//   capital:02-extension-config — глобальные agreements *_done в постгрес.
//   capital:04-contributor      — ant как pending Contributor (без него
//                                  CapitalBase редиректит на регистрацию).
//   capital:04b-approve-contributor — активирует УХД ant'а советом.

import { loginAsChairman } from '../../lib/harness.mjs';

export const meta = {
  title: 'Адаптация Благороста (председатель)',
  docPath: 'new/blagorost/adaptation-chairman.md',
  assetsDir: 'assets/new/blagorost/adaptation-chairman',
  role: 'chairman',
  fixture: 'ant',
  // bootExtra() сам через initExtensionsInPostgres ставит все
  // onboarding_*_done=true и UI считает адаптацию завершённой (Мастерская
  // вместо CapitalOnboardingCard). Для скриншотов нам нужно состояние
  // pending: 02-reset-onboarding обнуляет 5 флагов, оставляя саму запись —
  // иначе controller вернёт 500 на GetOnboardingState и UI сразу
  // редиректит на CapitalRegistrationPage.
  prepare: ['capital:01-programs', 'capital:02-reset-onboarding'],
};

async function clearNotifications(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.q-notification, .q-notifications__list > *').forEach((n) => n.remove());
  });
}

// На свежей цепочке у председателя ещё нет кошелька — закрываем wallet
// onboarding'и (Положение о ЦПП Кошелёк, ЭП, политика, пользсоглашение).
async function dismissAllWalletDialogs(page) {
  const portalsOpen = async () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll('[id^="q-portal--dialog--"]'))
        .some((p) => getComputedStyle(p).display !== 'none'),
    );

  await page.waitForFunction(
    () => Array.from(document.querySelectorAll('[id^="q-portal--dialog--"]'))
      .some((p) => getComputedStyle(p).display !== 'none'),
    { timeout: 30_000 },
  ).catch(() => {});

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (!(await portalsOpen())) return;

    const btnReady = await page.waitForFunction(
      () => {
        const portals = Array.from(document.querySelectorAll('[id^="q-portal--dialog--"]'))
          .filter((p) => getComputedStyle(p).display !== 'none');
        for (const p of portals) {
          const btn = Array.from(p.querySelectorAll('button'))
            .find((b) => b.textContent?.trim() === 'Подписать' && !b.disabled);
          if (btn) return true;
        }
        return false;
      },
      { timeout: 30_000 },
    ).then(() => true).catch(() => false);
    if (!btnReady) {
      await page.waitForTimeout(1000);
      continue;
    }

    await page.evaluate(() => {
      const portals = Array.from(document.querySelectorAll('[id^="q-portal--dialog--"]'))
        .filter((p) => getComputedStyle(p).display !== 'none');
      for (const p of portals) {
        const btn = Array.from(p.querySelectorAll('button'))
          .find((b) => b.textContent?.trim() === 'Подписать' && !b.disabled);
        if (btn) {
          btn.scrollIntoView({ block: 'center', behavior: 'instant' });
          btn.click();
          return;
        }
      }
    });
    await page.waitForTimeout(3500);
  }
}

export default async ({ page, context, shot, env }) => {
  // --- Шаг 1. Логин председателя. ---
  await loginAsChairman(page, context);

  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/capital/projects`, { waitUntil: 'domcontentloaded' });
  await dismissAllWalletDialogs(page);

  // --- Кадр 1. Список шагов адаптации (CapitalOnboardingCard) ---
  await page.waitForSelector('text=Адаптация к работе с программой', { timeout: 30_000 });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await clearNotifications(page);
  await page.waitForTimeout(800);

  await shot(
    page,
    '01-overview',
    'Карточка адаптации у председателя: «Адаптация к работе с программой "Благорост"». Пять шагов — Положение ЦПП Генератор, шаблон договора, шаблон оферты, Положение Благорост, оферта Благорост. У первого готового шага кнопка «Объявить собрание совета», у остальных — серый кружок (зависят от предыдущих).',
  );

  // --- Кадр 2. Диалог «Предложение повестки» с проектом документа ---
  // Клик по кнопке «Объявить собрание совета» в первом доступном шаге.
  await page.locator('button:has-text("Объявить собрание совета")').first().click();
  // Сначала спиннер «Генерация документа...», затем — диалог «Предложение
  // повестки» с проектом решения и кнопкой «Объявить» внутри.
  await page.waitForSelector('text=Предложение повестки', { timeout: 60_000 });
  // Ждём пока сгенерируется документ (спиннер уйдёт). Пометка успеха —
  // появление текста «Проект решения» в диалоге.
  await page.waitForSelector('text=Проект решения', { timeout: 60_000 });
  await page.waitForTimeout(800);
  await clearNotifications(page);

  await shot(
    page,
    '02-propose-dialog',
    'Диалог «Предложение повестки»: вопрос на повестке («Принять Положение о ЦПП "ГЕНЕРАТОР"?»), под ним — проект решения с полным текстом сгенерированного документа. Внизу кнопки «Отмена» и «Объявить» — нажав «Объявить», председатель выносит вопрос на ближайшую повестку совета.',
  );

  // Документ НЕ объявляем — иначе шаг становится in_progress и при повторном
  // прогоне сценарий упадёт (нельзя дважды запустить тот же шаг).
};
