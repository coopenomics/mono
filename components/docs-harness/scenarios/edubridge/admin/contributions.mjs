// Сценарий: взносы преподавателей результатами интеллектуальной деятельности.

import { loginAsChairman } from '../../../lib/harness.mjs';
import { EDU, openPage, settleAfterLogin } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'edubridge.contract',
  title: 'Взносы преподавателей',
  docPath: 'new/edubridge/admin/contributions.md',
  assetsDir: 'assets/new/edubridge/admin/contributions',
  role: 'chairman',
  prepare: ['edubridge:01-install', 'edubridge:02-course', 'edubridge:03-teacher', 'edubridge:04-member', 'edubridge:05-lessons'],
};

export default async ({ page, context, shot }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, EDU.admin('contributions'), 'Взнос');
  await shot(page, '01-contributions', 'Взносы преподавателей: преподаватель, взнос, сумма и состояние. Решение принимает совет в повестке, акт приёма-передачи председатель подписывает в запросах одобрений.');
};
