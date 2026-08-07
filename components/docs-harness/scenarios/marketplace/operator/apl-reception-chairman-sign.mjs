// Сценарий: operator-стол «Приёмка партии» — закрывающая подпись
// председателя КУ (шаг 7 магистрали II, on-chain `signchair`).
//
// Канон второй подписи: backend отдаёт по каждому Order группы агрегат
// (rawDocument + document с подписью поставщика); председатель накладывает
// свою подпись поверх (signatureId=2) тем же ключом сессии, документ не
// перегенерируется. После закрывающей подписи партия принимается в
// кооператив (ACCEPTED_TO_COOP).
//
// Предусловие: в КУ `krg` есть АПП в статусе PENDING_CHAIRMAN_RECEPTION_SIGN
// (поставщик уже подписал — шаг 6). Если такого нет — сценарий снимает
// empty/pending-list state и завершается.

import { cleanViteOverlays, dismissOnboardingDialogs, env, loginAs } from '../../../lib/harness.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'),
  );

export const meta = {
  title: 'Стол ПВЗ — закрывающая подпись приёмки',
  docPath: 'new/marketplace/operator/apl-reception-chairman-sign.md',
  assetsDir: 'assets/new/marketplace/operator/apl-reception-chairman-sign',
  role: 'user',
  fixture: 'chairkrg',
  fixtures: ['chairkrg'],
};

export default async ({ page, shot }) => {
  const fixture = loadFixture('chairkrg');
  await page.addInitScript(() => localStorage.setItem('harness:noBranchOverlay', '1'));
  await loginAs(page, fixture);
  await dismissOnboardingDialogs(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-pvz/reception`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await dismissOnboardingDialogs(page);

  // Загружаем АПП этого КУ.
  const branameInput = page.locator('label:has-text("ID кооперативного участка")').locator('input').first();
  await branameInput.click({ clickCount: 3 });
  await branameInput.fill('krg');
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Загрузить АПП")').first().click();
  await page.waitForTimeout(2000);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-reception-list',
    'Стол «Приёмка партии» председателя КУ Красногорск (`braname=krg`). В таблице — акты приёмки партий; для АПП в статусе PENDING_CHAIRMAN_RECEPTION_SIGN (поставщик уже подписал, шаг 6) доступна кнопка «Подписать председателем».',
  );

  // Ищем кнопку закрывающей подписи (видна только для PENDING_CHAIRMAN_RECEPTION_SIGN).
  const signBtn = page.locator('button:has-text("Подписать председателем")').first();
  const hasPending = await signBtn.count().then((c) => c > 0).catch(() => false);
  if (!hasPending) {
    console.warn('  ⚠️  Нет АПП в статусе PENDING_CHAIRMAN_RECEPTION_SIGN — сценарий ограничится списком');
    return;
  }

  await signBtn.click();
  await page.waitForTimeout(800);
  await cleanViteOverlays(page);

  await shot(
    page,
    '02-chairman-sign-dialog',
    'Диалог закрывающей подписи: поставщик уже подписал акт(ы) приёмки, председатель накладывает закрывающую подпись поверх ключом активной сессии — документ не перегенерируется. После подписи партия принимается в кооператив.',
  );

  // Накладываем подпись (председатель = текущая сессия chairkrg).
  await page.locator('.mp-sign-apl-chairman button:has-text("Подписать председателем")').first().click();

  // Ждём Notify об успехе.
  await page.waitForFunction(
    () => {
      const notifs = document.querySelectorAll('.q-notification__message');
      for (const n of notifs) {
        if ((n.textContent || '').includes('принята в кооператив')) return true;
      }
      return false;
    },
    { timeout: 45000 },
  ).catch(() => {});
  await page.waitForTimeout(800);

  await shot(
    page,
    '03-reception-accepted',
    'После закрывающей подписи председателя: Notify «Акт приёмки закрыт подписью председателя. Партия принята в кооператив» (positive). On-chain прошёл `signchair` с обеими подписями, АПП → ACCEPTED_TO_COOP.',
    { preserveNotifications: true },
  );
};
