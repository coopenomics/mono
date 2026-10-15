// Сценарий: запросы одобрений — председатель подписывает договор пайщика
// второй подписью (фаза chairman:01-approval).
import { openChairman } from '../../lib/chairman.mjs';
export const meta = { mode: 'docs', feature: 'chairman.approvals', title: 'Запросы одобрений', docPath: 'new/chairman/approval-requests.md',
  assetsDir: 'assets/new/chairman/approval-requests', role: 'chairman', prepare: ['chairman:01-approval'] };
export default async ({ page, context, shot, expect }) => {
  await openChairman(page, context, 'approvals');
  const row = page.locator('tbody tr').filter({ hasText: 'Белоусов' }).first();
  await expect(row, 'нет запроса одобрения Белоусова: фаза chairman:01-approval').toBeVisible({ timeout: 30000 });
  await shot(page, '01-list', 'Запросы одобрений: пайщик, действие, состояние и дата. Здесь документы, которые пайщик подписал первым и которые ждут подписи председателя.');
  await row.click();
  await page.waitForTimeout(2000);
  await shot(page, '02-request', 'Запрос целиком: документ с подписью пайщика. Кнопка «Одобрить» ставит подпись председателя, кнопка «Отклонить» возвращает документ с причиной.');
  await page.locator('button:has-text("Одобрить")').first().click();
  await page.waitForSelector('text=Подтверждение одобрения', { timeout: 15000 });
  await page.waitForTimeout(500);
  await shot(page, '03-confirm', 'Подтверждение одобрения документа председателем.');
  await page.locator('.q-dialog button:has-text("Одобрить")').last().click();
  // Сообщение об успехе живёт секунды; факт одобрения — строка ушла из ожидающих.
  await expect(page.locator('tbody tr').filter({ hasText: 'Белоусов' }).first(), 'запрос не ушёл из ожидающих').toBeHidden({ timeout: 90000 });
  await page.waitForTimeout(2000);
  await shot(page, '04-signed', 'Документ одобрен: председатель поставил вторую подпись, запрос ушёл из ожидающих. Отбор «Статус» показывает одобренные и отклонённые.');
};
