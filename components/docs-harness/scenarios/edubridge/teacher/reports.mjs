// Сценарий: отчёты преподавателя — журнал занятий и путь взноса результатом
// интеллектуальной деятельности. Два занятия в журнале: оба отчитаны (первое —
// фазой 05-lessons, второе — в календаре, сценарий lessons), документы на
// материалы подписаны вместе с отчётом. Срок хранения на стенде короткий:
// заявления ушли в совет, по первому совет принял взнос (фаза 06-council-rid)
// — преподаватель подписывает акт приёма-передачи.

import { loginAs } from '../../../lib/harness.mjs';
import { runPrepare } from '../../../lib/prepare.mjs';
import { EDU, loadFixture, openPage, settleAfterLogin, row } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'edubridge.teacher',
  title: 'Отчёты',
  docPath: 'new/edubridge/teacher/reports.md',
  assetsDir: 'assets/new/edubridge/teacher/reports',
  role: 'user',
  fixtures: ['orlova'],
  prepare: ['edubridge:01-install', 'edubridge:02-course', 'edubridge:03-teacher', 'edubridge:04-member', 'edubridge:05-lessons'],
};

export default async ({ page, shot, expect }) => {
  // Совет принимает взнос здесь, а не в общей подготовке: заявление уходит в
  // совет по истечении срока хранения, фаза ждёт очередь расширения.
  runPrepare(['edubridge:06-council-rid'], { log: (m) => console.log(`    ${m}`) });

  await loginAs(page, loadFixture(EDU.TEACHER));
  await settleAfterLogin(page);
  await openPage(page, EDU.teacher('reports'), 'Отчёты');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const sign = row(page, 'Требуется подпись акта');
  await expect(sign, 'нет строки «Требуется подпись акта»: совет не принял взнос').toBeVisible({ timeout: 30000 });
  await shot(page, '01-reports', 'Отчёты по занятиям: номер, курс, дата, обучающиеся, взнос и его состояние. Строка с действием стоит первой: совет принял взнос — требуется подпись акта. Второй взнос на рассмотрении совета.');

  await sign.click();
  await page.waitForTimeout(1500);
  await shot(page, '02-details', 'Занятие целиком: курс, номер, дата, длительность, обучающиеся с оплаченным доступом, взнос и его состояние, материалы и документы. Внизу панели — действие по состоянию.');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);

  await sign.locator('button:has-text("Подписать акт")').click();
  await page.waitForSelector('text=Акт подписан', { timeout: 90000 });
  await page.waitForTimeout(1500);
  await shot(page, '03-act-signed', 'Акт приёма-передачи подписан преподавателем и направлен председателю. Состояние — «Акт ожидает подписи председателя».');
};
