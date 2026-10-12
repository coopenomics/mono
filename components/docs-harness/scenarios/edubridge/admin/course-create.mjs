// Сценарий: администратор добавляет курс. Форма заполняется целиком, курс
// сохраняется черновиком — публикация показана на странице курса.

import { loginAsChairman } from '../../../lib/harness.mjs';
import { EDU, openPage, settleAfterLogin, fill, pick, next } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'edubridge.admin',
  title: 'Добавление курса',
  docPath: 'new/edubridge/admin/course-create.md',
  assetsDir: 'assets/new/edubridge/admin/course-create',
  role: 'chairman',
  prepare: ['edubridge:01-install', 'edubridge:02-course', 'edubridge:03-teacher'],
};

export default async ({ page, context, shot }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);

  await openPage(page, EDU.admin('courses/new'), 'Название');
  await shot(page, '01-empty-form', 'Новый курс — пошаговая форма: курс, обложка, занятия, взнос, выдача доступа, первая группа, преподаватели. Первый шаг — название, раздел и уровень, расписание, описание и учебная программа.');

  await fill(page, 'Название', 'Алгебра: уравнения и неравенства, 8 класс');
  await pick(page, 'Раздел', EDU.SECTION_TITLE);
  await fill(page, 'Расписание', 'Пн, Ср 16:00–17:30');
  await fill(page, 'Описание', 'Линейные и квадратные уравнения, системы, неравенства и их системы. Каждое занятие — теория и практикум.', 'textarea');
  await fill(page, 'Учебная программа', '1. Линейные уравнения\n2. Квадратные уравнения\n3. Системы уравнений\n4. Неравенства', 'textarea');
  await shot(page, '02-course-basics', 'Первый шаг заполнен. Описание и программа видны в каталоге всем посетителям.');

  await next(page); // обложка — по желанию
  await next(page); // занятия
  await fill(page, 'Занятий в месяц', '8');
  await fill(page, 'Длительность занятия', '90');
  await fill(page, 'Занятий в программе', '32');
  await fill(page, 'Гарантийный срок', '14');
  await page.waitForTimeout(500);
  await shot(page, '03-lessons', 'Занятия: число занятий в месяц и в программе, длительность занятия, гарантийный срок на материалы. Длительность программы считается сама.');

  await next(page); // взнос
  await fill(page, 'Плановая ставка часа', '1000');
  await page.waitForTimeout(800);
  await shot(page, '04-fee', 'Взнос: плановая ставка часа и способ расчёта с преподавателем. Ниже расчёт взноса ученика — оплата занятий по ставке и целевой членский взнос кооператива; отдельно взнос за весь курс разом со скидкой.');

  await next(page); // выдача доступа
  await pick(page, 'Тип направления', 'Очное обучение');
  await page.waitForTimeout(400);
  await shot(page, '05-access', 'Выдача доступа: направление и носитель — очно по коду пропуска либо курс на площадке.');

  await next(page); // первая группа
  await next(page); // преподаватели
  const teacherSelect = page.locator('label:has-text("Назначить преподавателя")').first();
  if (await teacherSelect.isVisible().catch(() => false)) {
    await teacherSelect.click();
    await page.locator('.q-menu .q-item').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    await shot(page, '06-teacher-pick', 'Преподаватели курса выбираются из пайщиков с подписанным договором участия и назначенной ставкой. У курса может быть несколько преподавателей.');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  await page.locator('button:has-text("Добавить курс")').last().click();
  // Курс сохранён — открылась его страница с хлебной крошкой к реестру.
  await page.waitForSelector('text=К реестру курсов', { timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await shot(page, '07-course-saved', 'Курс сохранён черновиком и открыт на своей странице. В каталог он попадёт после публикации.');
};
