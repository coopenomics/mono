// Сценарий: календарь преподавателя. Занятия ставятся в календарь окнами
// расписания курса; плитка открывает занятие, у прошедшего — отчёт.
// Преподаватель отчитывается о втором внеочередном занятии (фаза 05-lessons
// ставит два прошедших: первое отчитывает засев, второе — этот сценарий).
// Отчёты, документы на подпись и журнал — на странице «Отчёты» (сценарий reports).

import { loginAs } from '../../../lib/harness.mjs';
import { EDU, loadFixture, openPage, settleAfterLogin, fill } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'edubridge.teacher',
  title: 'Календарь',
  docPath: 'new/edubridge/teacher/lessons.md',
  assetsDir: 'assets/new/edubridge/teacher/lessons',
  role: 'user',
  fixtures: ['orlova'],
  prepare: ['edubridge:01-install', 'edubridge:02-course', 'edubridge:03-teacher', 'edubridge:04-member', 'edubridge:05-lessons'],
};

export default async ({ page, shot, expect }) => {
  await loginAs(page, loadFixture(EDU.TEACHER));
  await settleAfterLogin(page);
  await openPage(page, EDU.teacher('lessons'), 'Календарь занятий');
  await page.waitForTimeout(1200);
  await shot(page, '01-calendar', 'Календарь преподавателя: занятия по месяцам, цвет плитки — состояние: запланировано, проведено, отчёт просрочен, отменено. Занятия ставит в календарь администратор окнами расписания курса.');

  // Прошедшее занятие без отчёта: плитка «запланировано» либо «отчёт просрочен»,
  // у которой в панели есть кнопка отчёта. Будущие занятия кнопки не показывают.
  const chips = page.locator('.edu-cal__chip--planned, .edu-cal__chip--overdue');
  await expect(chips.first(), 'в календаре нет ни одного занятия: окна расписания курса не построили календарь').toBeVisible({ timeout: 20000 });
  const reportBtn = page.locator('button:has-text("Создать отчёт")').first();
  let found = false;
  for (let i = 0; i < Math.min(await chips.count(), 12); i += 1) {
    await chips.nth(i).click();
    await page.waitForTimeout(900);
    if (await reportBtn.isVisible().catch(() => false)) { found = true; break; }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
  expect(found, 'нет прошедшего занятия без отчёта: фаза 05-lessons ставит два внеочередных занятия').toBe(true);
  await shot(page, '02-lesson', 'Занятие из календаря: курс, группа, номер, время, длительность. Занятие прошло — внизу панели кнопка «Создать отчёт». До конца занятия панель называет момент, с которого отчёт принимается.');

  await reportBtn.click();
  await page.waitForSelector('text=Тема занятия', { timeout: 15000 });
  await fill(page, 'Тема занятия', 'Алгебраические выражения: преобразование и сокращение дробей');
  await fill(page, 'Материалы занятия', 'https://cloud.voskhod.coop/edu/oge-math/02-konspekt.pdf\nhttps://cloud.voskhod.coop/edu/oge-math/02-zadaniya.pdf', 'textarea');
  await page.waitForTimeout(400);
  await shot(page, '03-report-dialog', 'Отчёт о занятии: тема и материалы — по одной ссылке на строку. Материалы — результат интеллектуальной деятельности преподавателя, кооператив принимает их на ответственное хранение.');
  await page.locator('button:has-text("Создать отчёт")').last().click();
  await page.waitForSelector('text=Отчёт создан', { timeout: 60000 });
  await page.waitForTimeout(1500);
  await shot(page, '04-reported', 'Отчёт создан: занятие в календаре стало проведённым. Документы на материалы подписываются на странице «Отчёты».');
};
