// Сценарий: журнал занятий и отчёт о занятии. Занятие № 1 отчитано фазой
// 05-lessons и материалы переданы на хранение; здесь преподаватель отчитывает
// занятие № 2 через интерфейс и передаёт его материалы.

import { loginAs } from '../../../lib/harness.mjs';
import { EDU, loadFixture, openPage, settleAfterLogin, fill, row } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'edubridge.teacher',
  title: 'Занятия',
  docPath: 'new/edubridge/teacher/lessons.md',
  assetsDir: 'assets/new/edubridge/teacher/lessons',
  role: 'user',
  fixtures: ['orlova'],
  prepare: ['edubridge:01-install', 'edubridge:02-course', 'edubridge:03-teacher', 'edubridge:04-member', 'edubridge:05-lessons'],
};

export default async ({ page, shot }) => {
  await loginAs(page, loadFixture(EDU.TEACHER));
  await settleAfterLogin(page);
  await openPage(page, EDU.teacher('lessons'), 'Занятие');
  await shot(page, '01-journal', 'Журнал занятий: номер, тема, дата, взнос по занятию и его состояние. Взнос считает контракт — по ставке преподавателя за каждую подписку с оплаченным доступом на дату занятия.');

  await page.locator('button:has-text("Создать отчёт")').first().click();
  await page.waitForSelector('text=Отчёт о занятии', { timeout: 15000 });
  await page.waitForTimeout(600);
  // Список курсов открывается сам при фокусе — закрываем кликом по заголовку окна.
  await page.locator('.q-dialog :text("Отчёт о занятии")').first().click().catch(() => {});
  await page.waitForTimeout(300);
  const today = new Date().toISOString().slice(0, 10);
  await fill(page, 'Номер занятия', '2');
  await fill(page, 'Дата занятия', today);
  await fill(page, 'Тема занятия', 'Алгебраические выражения: тождественные преобразования');
  await fill(page, 'Материалы занятия', 'https://cloud.voskhod.coop/edu/oge-math/02-konspekt.pdf\nhttps://cloud.voskhod.coop/edu/oge-math/02-zadaniya.pdf', 'textarea');
  await shot(page, '02-report-dialog', 'Отчёт о занятии: номер, дата, тема и материалы по одной ссылке на строку. Материалы передаются кооперативу на ответственное хранение вместе с отчётом.');

  await page.locator('.q-dialog button:has-text("Создать отчёт")').last().click();
  // Окно закрывается после ответа контроллера; отказ (порядок дат, незакрытое занятие) оставляет его открытым — сценарий падает.
  await page.waitForSelector('text=Отчёт о занятии', { state: 'hidden', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '03-reported', 'Занятие № 2 в журнале. Пока материалы не переданы на хранение, следующий отчёт по курсу не принимается.');

  const transfer = page.locator('button:has-text("Передать материалы")').first();
  if (await transfer.isVisible().catch(() => false)) {
    await transfer.click();
    await page.waitForTimeout(4000);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await shot(page, '04-held', 'Материалы переданы: подписан акт передачи на ответственное хранение. Они хранятся гарантийный срок курса, затем заявление о взносе уходит совету.');
  }

  await row(page, 'Занятие № 2').click();
  await page.waitForTimeout(1200);
  await shot(page, '05-details', 'Занятие целиком: курс, номер, дата, длительность, обучающиеся с оплаченным доступом, взнос и его состояние, материалы.');
};
