// Сценарий: реестр документов кооператива, документ и шаблоны документов с
// редакциями и утверждением советом.

import { env, loginAsChairman } from '../../lib/harness.mjs';
import { openPage, settleAfterLogin } from '../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'soviet.documents',
  title: 'Реестр документов',
  docPath: 'new/council/documents.md',
  assetsDir: 'assets/new/council/documents',
  role: 'chairman',
  prepare: ['soviet:01-template'],
};

const SOVIET = (p) => `${env.APP_PREFIX}/${env.COOPNAME}/soviet/${p}`;

export default async ({ page, context, shot, expect }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);
  await openPage(page, SOVIET('documents'), 'Документы');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await shot(page, '01-registry', 'Реестр документов кооператива: заявления, решения, протоколы и акты с датой, подписантами и пакетом процесса.');

  const first = page.locator('tbody tr').first();
  await expect(first, 'реестр документов пуст').toBeVisible({ timeout: 30000 });
  await first.click();
  await page.waitForTimeout(2000);
  await shot(page, '02-document', 'Документ целиком: текст, подписи с ключами и временем, связанные документы процесса.');

  await openPage(page, SOVIET('documents/templates'), 'Шаблоны');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await shot(page, '03-templates', 'Шаблоны документов кооператива: редакция, выпущенная оператором, и редакция, утверждённая советом, состояние и действия. Новую редакцию совет утверждает, до решения кооператив работает по прежней.');

  const open = page.locator('button:has-text("Открыть текст")').first();
  if (await open.isVisible().catch(() => false)) {
    await open.click();
    await page.waitForTimeout(2000);
    await shot(page, '04-template-text', 'Текст шаблона в утверждённой редакции с хэшем текста. Вкладки переключают утверждённую и новую редакцию.');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
  const propose = page.locator('button:has-text("Вынести на совет")').first();
  if (await propose.isVisible().catch(() => false)) {
    await propose.scrollIntoViewIfNeeded();
    await shot(page, '05-new-edition', 'Оператор выпустил новую редакцию шаблона: строка показывает обе редакции, кнопка «Вынести на совет» ставит утверждение в повестку.');
    await propose.click();
    await page.waitForSelector('text=Документ вынесен на совет', { timeout: 90000 });
    await page.waitForTimeout(2500);
    await shot(page, '06-proposed', 'Новая редакция вынесена на совет: состояние «На рассмотрении», ссылка «К повестке» ведёт к вопросу.');
  }
};
