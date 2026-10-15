// Сценарий: реестр курсов на столе администратора.

import { loginAsChairman } from '../../../lib/harness.mjs';
import { EDU, openPage, settleAfterLogin } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'edubridge.admin',
  title: 'Курсы кооператива',
  docPath: 'new/edubridge/admin/courses.md',
  assetsDir: 'assets/new/edubridge/admin/courses',
  role: 'chairman',
  prepare: ['edubridge:01-install', 'edubridge:02-course'],
};

export default async ({ page, context, shot }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, EDU.admin('courses'), EDU.COURSE_TITLE);
  await shot(page, '01-courses', 'Реестр курсов кооператива: карточка курса показывает раздел, взнос в месяц, преподавателя и состояние публикации. Опубликованные курсы видны в каталоге всем посетителям.');
};
