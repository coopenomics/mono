// Сценарий: экономика программы «Образование».

import { loginAsChairman } from '../../../lib/harness.mjs';
import { EDU, openPage, settleAfterLogin } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'edubridge.economy',
  title: 'Экономика программы',
  docPath: 'new/edubridge/admin/economy.md',
  assetsDir: 'assets/new/edubridge/admin/economy',
  role: 'chairman',
  prepare: ['edubridge:01-install', 'edubridge:02-course', 'edubridge:03-teacher', 'edubridge:04-member', 'edubridge:05-lessons'],
};

export default async ({ page, context, shot }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, EDU.admin('economy'), 'Кошелёк программы');
  await shot(page, '01-money', 'Деньги программы по пути взноса ученика: кошельки учеников, кошелёк программы, резерв выплат преподавателям, удержанное по гарантии. Ниже — движения.');
  const settings = page.locator('text=Настройки').first();
  if (await settings.isVisible().catch(() => false)) {
    await settings.click();
    await page.waitForTimeout(1000);
    await shot(page, '02-settings', 'Настройки: целевой членский взнос в процентах — часть взноса ученика на ведение программы, издержки и возвраты по Положению. Один на все курсы кооператива.');
  }
  const expenses = page.locator('text=Расходы').first();
  if (await expenses.isVisible().catch(() => false)) {
    await expenses.click();
    await page.waitForTimeout(1000);
    await shot(page, '03-expenses', 'Расходы программы оплачиваются с кошелька программы: служебная записка, решение совета, выплата.');
  }
};
