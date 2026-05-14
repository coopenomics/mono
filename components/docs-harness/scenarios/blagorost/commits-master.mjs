// Сценарий: «Приёмка коммитов мастером» — взгляд со стороны мастера компонента.
//
// Готовится через seed-фазы 01..09 + 10a (pending-commit без приёмки).
// На цепочке остаётся один неутверждённый коммит ivanpetrov на 8 ч; мастер
// `ant` видит его на странице «Коммиты» (master-commits-list).
//
// Кадры:
//   01-master-tracker  — список коммитов у мастера, видна строка ivanpetrov'а
//                        в статусе «На рассмотрении».
//   02-approve-dialog  — диалог приёмки: звёздочки удовлетворения (рейтинг)
//                        и поле отзыва, которое уйдёт исполнителю.

import { loginAsChairman, dismissOnboardingDialogs } from '../../lib/harness.mjs';

export const meta = {
  title: 'Приёмка коммитов мастером',
  docPath: 'new/blagorost/commits.md',
  assetsDir: 'assets/new/blagorost/commits',
  role: 'chairman',
  fixture: 'ant',
  fixtures: ['ivanpetrov', 'ekaterina'],
  prepare: [
    'capital:01-programs',
    'capital:02-extension-config',
    'capital:04-contributor',
    'capital:05-additional-contributors',
    'capital:06-create-project-koshelek',
    'capital:07-master-and-plan',
    'capital:07b-clearance-all',
    'capital:08-investments', // запускает компонент в работу.
                              // Запустить компонент в работу можно только когда:
                              //   (1) у компонента уже есть мастер (иначе коммиты некому принимать);
                              //   (2) родительский проект уже в работе (иначе компонент окажется в работе под
                              //       незапущенным или закрытым проектом).
                              // Поэтому ему предшествуют создание проекта и компонента, назначение мастера и
                              // согласование участия — и сначала запускается родительский проект, потом компонент.
    'capital:09-tasks',
    'capital:10a-pending-commit',
  ],
};

async function clearNotifications(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.q-notification').forEach((n) => n.remove());
    document.querySelectorAll('.q-notifications__list > *').forEach((n) => n.remove());
  });
}

async function dropPersistentSign(page) {
  await page.evaluate(() => {
    document.querySelectorAll('[id^="q-portal--dialog--"]').forEach((p) => {
      if (p.textContent?.includes('Прочитайте и подпишите')) p.remove();
    });
  });
}

export default async ({ page, context, shot, env }) => {
  await loginAsChairman(page, context);
  await dismissOnboardingDialogs(page);

  await page.goto(
    `${env.BASE_URL}/${env.COOPNAME}/capital/commits`,
    { waitUntil: 'domcontentloaded' },
  );
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await dropPersistentSign(page);
  await page.waitForTimeout(500);
  // Ждём пока в списке появится строка с автором коммита.
  await page.waitForSelector('text=Петров Иван', { timeout: 30000 }).catch(() => {});
  await clearNotifications(page);
  await page.waitForTimeout(800);

  await shot(
    page,
    '03-master-commits',
    'Страница «Коммиты» у мастера компонента: один pending-коммит ivanpetrov на 8 ч ждёт приёмки. Слева — описание коммита, справа — кнопки «Принять» и «Отклонить».',
  );

  // --- Кадр диалога приёмки ---
  // Кнопка «Одобрить» в строке коммита открывает ApproveCommitDialog со
  // звёздочками рейтинга и полем отзыва.
  const approveBtn = page.locator('button:has-text("Одобрить")').first();
  if (await approveBtn.isVisible().catch(() => false)) {
    await approveBtn.click().catch(() => {});
    await page.waitForSelector('div.q-dialog:visible', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await shot(
      page,
      '04-approve-dialog',
      'Диалог приёмки коммита у мастера: пятизвёздочная шкала «Удовлетворение результатом» и поле «Отзыв» — отзыв уходит исполнителю и сохраняется в коммите. После «Одобрить» коммит уходит в Кошелёк Генерации исполнителя.',
    );
  } else {
    console.log('Кнопка «Одобрить» не найдена — пропуск кадра 04.');
  }
};
