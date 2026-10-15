// Сценарий: отчёты преподавателя — журнал занятий и путь взноса результатом
// интеллектуальной деятельности. Два занятия в журнале: второе отчитано в
// календаре (сценарий lessons) и ждёт подписи документов на материалы; первое
// отчитано фазой 05-lessons, срок хранения вышел, совет принял взнос
// (фаза 06-council-rid) — преподаватель подписывает акт приёма-передачи.

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
  // Совет принимает взнос за первое занятие здесь, а не в общей подготовке:
  // заявление уходит в совет по истечении срока хранения, фаза ждёт очередь.
  runPrepare(['edubridge:06-council-rid'], { log: (m) => console.log(`    ${m}`) });

  await loginAs(page, loadFixture(EDU.TEACHER));
  await settleAfterLogin(page);
  await openPage(page, EDU.teacher('reports'), 'Отчёты');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '01-reports', 'Отчёты по занятиям: номер, курс, дата, обучающиеся, взнос и его состояние. Действие по строке зависит от состояния: подписать документы на материалы, подписать акт приёма-передачи.');

  // Второе занятие: отчёт создан, материалы ждут документов — акт хранения и
  // заявление о взносе подписываются разом.
  const transfer = row(page, 'Ожидает передачи материалов');
  await expect(transfer, 'нет строки «Ожидает передачи материалов»: отчёт из календаря не создан').toBeVisible({ timeout: 20000 });
  await transfer.locator('button:has-text("Подписать документы")').click();
  await page.waitForSelector('text=Документы подписаны', { timeout: 90000 });
  await page.waitForTimeout(1500);
  await shot(page, '02-held', 'Документы подписаны: акт приёма на ответственное хранение и заявление о паевом взносе результатом. Материалы на хранении до конца гарантийного срока курса, взнос — «На ответственном хранении».');

  // Первое занятие: совет принял взнос — преподаватель подписывает акт.
  const sign = row(page, 'Требуется подпись акта');
  await expect(sign, 'нет строки «Требуется подпись акта»: совет не принял взнос за первое занятие').toBeVisible({ timeout: 30000 });
  await sign.locator('button:has-text("Подписать акт")').click();
  await page.waitForSelector('text=Акт подписан', { timeout: 90000 });
  await page.waitForTimeout(1500);
  await shot(page, '03-act-signed', 'Акт приёма-передачи подписан преподавателем и направлен председателю. Состояние — «Акт ожидает подписи председателя».');

  await row(page, 'Акт ожидает подписи председателя').click();
  await page.waitForTimeout(1500);
  await shot(page, '04-details', 'Занятие целиком: курс, номер, дата, длительность, обучающиеся с оплаченным доступом, взнос и его состояние, материалы и документы.');
};
