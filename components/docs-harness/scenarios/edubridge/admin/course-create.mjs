// Сценарий: администратор добавляет курс. Форма из шести шагов: курс,
// занятия и взнос (окна расписания), выдача доступа, первая группа,
// преподаватели, обложка. Курс не сохраняется: на стенде документации нет
// ключей Skillspace и GetCourse, а курс для остальных статей создаёт
// подготовка `edubridge:02-course`. Очное направление скрыто с 22.10.2026.

import path from 'node:path';
import { HARNESS_ROOT, loginAsChairman } from '../../../lib/harness.mjs';
import { EDU, openPage, settleAfterLogin, field, fill, pick, next, scrollDown } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'edubridge.admin',
  title: 'Добавление курса',
  docPath: 'new/edubridge/admin/course-create.md',
  assetsDir: 'assets/new/edubridge/admin/course-create',
  role: 'chairman',
  prepare: ['edubridge:01-install', 'edubridge:02-course', 'edubridge:03-teacher'],
};

export default async ({ page, context, shot, expect }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);

  await openPage(page, EDU.admin('courses/new'), 'Название');
  await shot(page, '01-empty-form', 'Новый курс — пошаговая форма: курс, занятия и взнос, выдача доступа, первая группа, преподаватели, обложка. Первый шаг — название, раздел и уровень, описание и учебная программа.');

  await fill(page, 'Название', 'Алгебра: уравнения и неравенства, 8 класс');
  await pick(page, 'Раздел', EDU.SECTION_TITLE);
  await fill(page, 'Описание', 'Линейные и квадратные уравнения, системы, неравенства и их системы. Каждое занятие — теория и практикум.', 'textarea');
  await fill(page, 'Учебная программа', '1. Линейные уравнения\n2. Квадратные уравнения\n3. Системы уравнений\n4. Неравенства', 'textarea');
  await shot(page, '02-course-basics', 'Первый шаг заполнен. Описание и программа видны в каталоге всем посетителям.');

  // ── Занятия и взнос: окна расписания ────────────────────────────────────
  await next(page);
  await page.locator('button:has-text("Добавить окно")').first().waitFor({ state: 'visible', timeout: 20000 });
  await page.locator('button:has-text("Добавить окно")').first().click();
  await page.waitForTimeout(500);
  // Первое окно: вторник, 16:00, 90 минут, 1000 за час. Второе окно копирует
  // время, минуты и стоимость первого и встаёт на четверг.
  await fill(page, 'Начало', '16:00');
  await fill(page, 'Минут', '90');
  await fill(page, 'Стоимость часа', '1000');
  await page.locator('button:has-text("Добавить окно")').first().click();
  await page.waitForTimeout(600);
  await fill(page, 'Длительность программы', '4');
  await fill(page, 'Гарантийный срок', '14');
  await page.waitForTimeout(800);
  await shot(page, '03-lessons', 'Занятия и взнос: окна расписания — день недели, время начала, длительность и стоимость часа преподавателя. Из окон и даты начала группы строится календарь занятий. Справа — сводка: занятий и часов в месяц, стоимость месяца.');
  await expect(page.locator('.edu-slots__row')).toHaveCount(2, { timeout: 10000 });

  await scrollDown(page, 900);
  await shot(page, '04-fee', 'Ниже окон — длительность программы, гарантийный срок, способ расчёта с преподавателем и взнос за весь курс разом. Расчёт взноса показывает оплату занятий и целевой членский взнос кооператива.');

  // ── Выдача доступа ──────────────────────────────────────────────────────
  await next(page);
  // Без ключей площадки реестр школы не читается: сообщение об этом гаснет до снимка.
  await page.locator('.q-notification').first().waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(400);
  await shot(page, '05-access', 'Выдача доступа: площадка курса — Skillspace или GetCourse, курс выбирается из реестра школы.');

  // ── Первая группа и преподаватели ───────────────────────────────────────
  await next(page);
  await page.waitForTimeout(500);
  await shot(page, '05b-group', 'Первая группа — по желанию: дата начала занятий. От неё и окон расписания встают занятия в календаре.');
  await next(page);
  const teacherSelect = page.locator('label:has-text("Назначить преподавателя")').first();
  if (await teacherSelect.isVisible().catch(() => false)) {
    await teacherSelect.click();
    await page.locator('.q-menu .q-item').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    await shot(page, '06-teacher-pick', 'Преподаватели курса выбираются из пайщиков с подписанным договором участия. Окно расписания без преподавателя сервер заполняет сам по допускам курса.');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  // ── Обложка и сохранение ────────────────────────────────────────────────
  await next(page);
  await page.locator('input.edu-course-form__file').setInputFiles(path.join(HARNESS_ROOT, 'fixtures', 'cover-oge-math.jpg'));
  await page.waitForTimeout(1500);
  await shot(page, '07-cover', 'Обложка курса для каталога: JPEG, PNG или WEBP, лучше 1600 × 900. Без обложки плитка курса в каталоге пустая.');
};
