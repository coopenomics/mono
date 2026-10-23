// Сценарий: ученики на столе администратора.

import { loginAsChairman } from '../../../lib/harness.mjs';
import { EDU, openPage, settleAfterLogin, row } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'edubridge.admin',
  title: 'Ученики',
  docPath: 'new/edubridge/admin/members.md',
  assetsDir: 'assets/new/edubridge/admin/members',
  role: 'chairman',
  prepare: ['edubridge:01-install', 'edubridge:02-course', 'edubridge:03-teacher', 'edubridge:04-member'],
};

export default async ({ page, context, shot }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, EDU.admin('members'), 'Громова');
  await shot(page, '01-members', 'Ученики, их обучающиеся, подписки и выдача доступа. Красная метка — доступ не выдан.');
  await row(page, 'Громова').click();
  await page.waitForTimeout(1200);
  await shot(page, '02-card', 'Карточка ученика: учётное имя, обучающиеся, подписки с оплаченным сроком и состоянием доступа, задачи выдачи доступа.');
};
