// Сценарий: реестр платежей кооператива — кассир подтверждает выплаты по
// программе «Образование»: возврат паевого взноса преподавателю (решение
// совета — фаза 07) и оплату расхода программы (фаза 08), прикладывает
// чек об оплате и закрывающие документы.

import path from 'node:path';
import { env, loginAsChairman, HARNESS_ROOT } from '../../../lib/harness.mjs';
import { runPrepare } from '../../../lib/prepare.mjs';
import { openPage, settleAfterLogin } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'edubridge.economy',
  title: 'Выплаты',
  docPath: 'new/edubridge/admin/payments.md',
  assetsDir: 'assets/new/edubridge/admin/payments',
  role: 'chairman',
  prepare: ['edubridge:01-install', 'edubridge:02-course', 'edubridge:03-teacher', 'edubridge:04-member', 'edubridge:05-lessons'],
};

const PROOF = path.join(HARNESS_ROOT, 'fixtures', 'sok.jpg');

/** Первая исходящая строка реестра, которая ждёт кассира. */
function pendingRow(page) {
  return page.locator('tr.data-row').filter({ hasText: 'Исходящий' }).filter({ has: page.locator('button:has-text("Подтвердить")') }).first();
}

/** Кассир подтверждает платёж строки: кнопка в строке, подтверждение в окне. */
async function confirmPayment(page, row) {
  await row.locator('button:has-text("Подтвердить")').first().click();
  await page.waitForSelector('text=Подтвердить платеж', { timeout: 15000 });
  await page.locator('.q-dialog button:has-text("Продолжить")').last().click();
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
}

export default async ({ page, context, shot, expect }) => {
  // Решения совета по заявлениям, поданным со столов: возврат преподавателю и расход программы.
  runPrepare(['edubridge:07-council-return', 'edubridge:08-council-expense'], { log: (m) => console.log(`    ${m}`) });

  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, `${env.APP_PREFIX}/${env.COOPNAME}/soviet/payments`, 'Платеж');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '01-registry', 'Реестр платежей кооператива: исходящие платежи по решениям совета ждут кассира — возврат паевого взноса преподавателю и оплата расхода программы. Кассир переводит деньги по реквизитам и подтверждает платёж.');

  const first = pendingRow(page);
  await expect(first, 'в реестре нет исходящего платежа, который ждёт кассира').toBeVisible({ timeout: 30000 });
  await first.click();
  await page.waitForTimeout(1200);
  await shot(page, '02-payment', 'Платёж целиком: получатель, сумма, реквизиты и назначение. Кнопка «Подтвердить» — деньги переведены.');
  await confirmPayment(page, first);
  await shot(page, '03-paid', 'Платёж подтверждён: состояние «Выплачено». В раскрытой строке — чек об оплате: кассир прикладывает подтверждение перевода.');

  const proofInput = page.locator('tr.expand-row input[type="file"]').first();
  if (await proofInput.count()) {
    await proofInput.setInputFiles(PROOF);
    await page.waitForSelector('text=Чек об оплате приложен', { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await shot(page, '04-proof', 'Чек об оплате приложен к платежу. По расходу организации кассир прикладывает ещё закрывающие документы: акт, счёт-фактуру, накладную.');
  }

  // Второй платёж — расход программы либо возврат, смотря что пришло первым.
  const second = pendingRow(page);
  if (await second.isVisible().catch(() => false)) {
    await second.click();
    await page.waitForTimeout(1000);
    await confirmPayment(page, second);
    await shot(page, '05-second-paid', 'Второй платёж подтверждён. По оплате счёта организации в строке открыты закрывающие документы, по авансу пайщику — отчёт пайщика по чекам.');
  }
};
