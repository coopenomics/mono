// Сценарий: offerer-стол «Подпись приёмки» (Эпик 5 / Story 5.7).
// Поставщик ставит первую подпись signsupp на акте приёмки партии ПВЗ.
// После backend-фикса DTO (fact_quantity_per_order опционально) АПП
// создаётся оператором КУ в статусе PENDING_SUPPLIER_SIGN — здесь
// поставщик-владелец Offer'ов подписывает его ключом своей сессии, и
// АПП переходит в PENDING_CHAIRMAN_RECEPTION_SIGN.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, dismissOnboardingDialogs, env, loginAs } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'),
  );

export const meta = {
  title: 'Стол поставщика — подпись приёмки',
  docPath: 'new/marketplace/offerer/apl-reception-sign.md',
  assetsDir: 'assets/new/marketplace/offerer/apl-reception-sign',
  role: 'user',
  fixture: 'ivanpetrov',
  fixtures: ['ivanpetrov'],
};

export default async ({ page, shot }) => {
  // ivanpetrov — поставщик-владелец individual Offer'ов, по которым
  // оператор КУ открыл АПП на шаге 5 магистрали II.
  const fixture = loadFixture('ivanpetrov');
  await page.addInitScript(() => localStorage.setItem('harness:noBranchOverlay', '1'));
  await loginAs(page, fixture);
  await dismissOnboardingDialogs(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/apl-receptions`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await dismissOnboardingDialogs(page);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-apl-receptions-pending',
    'Стол «Акты приёмки на подпись» поставщика. URL: `' + page.url() + '`. В таблице — АПП в статусе PENDING_SUPPLIER_SIGN, сформированный оператором КУ; справа кнопка «Подписать».',
  );

  const signBtn = page.locator('button:has-text("Подписать")').first();
  if ((await signBtn.count()) === 0) {
    console.warn('  ⚠️  Нет АПП в статусе PENDING_SUPPLIER_SIGN — сценарий ограничится списком');
    return;
  }
  await signBtn.click();
  await page.waitForTimeout(800);
  await cleanViteOverlays(page);

  await shot(
    page,
    '02-sign-dialog',
    'Диалог подписи акта приёмки: поставщик подтверждает подпись ключом текущей сессии как владелец Offer\'ов. Показаны КУ, вариант и сумма к приёмке.',
  );

  // Подпись каждого Order-акта группы ключом сессии + on-chain signsupp.
  const confirmBtn = page.locator('.mp-sign-apl button:has-text("Подписать")').first();
  await confirmBtn.click();

  // Ждём SuccessAlert о принятой подписи (on-chain signsupp может занять
  // несколько секунд на каждый Order группы).
  await page.waitForFunction(
    () => {
      const notifs = document.querySelectorAll('.q-notification__message');
      for (const n of notifs) {
        if (/Акт приёмки подписан|Ожидается закрывающая подпись/i.test(n.textContent || '')) return true;
      }
      return false;
    },
    { timeout: 45000 },
  ).catch(() => {});
  await page.waitForTimeout(800);

  await shot(
    page,
    '03-signed',
    'После подписи: Notify «Акт приёмки подписан». АПП переходит в PENDING_CHAIRMAN_RECEPTION_SIGN, on-chain `signsupp` зафиксирован per-Order; теперь ожидается закрывающая подпись председателя КУ (шаг 7 магистрали II).',
    { preserveNotifications: true },
  );
};
