// Сценарий: каталог курсов — вход на стол ученика.

import { loginAs } from '../../../lib/harness.mjs';
import { EDU, loadFixture, openPage, settleAfterLogin } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'edubridge.catalog',
  title: 'Каталог курсов',
  docPath: 'new/edubridge/member/catalog.md',
  assetsDir: 'assets/new/edubridge/member/catalog',
  role: 'user',
  fixtures: ['gromova'],
  prepare: ['edubridge:01-install', 'edubridge:02-course'],
};

export default async ({ page, shot }) => {
  await loginAs(page, loadFixture(EDU.PARENT));
  await settleAfterLogin(page);
  await openPage(page, EDU.member('catalog'), EDU.COURSE_TITLE);
  await shot(page, '01-catalog', 'Каталог курсов кооператива: карточки с разделом, уровнем, взносом в месяц и преподавателем. Фильтры по разделу и уровню сверху. Каталог открыт всем посетителям.');
};
