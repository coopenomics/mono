// Помощники сценариев приложения «Кооперативный участок».
// Общие действия со страницами (переход, поле, выбор) — из lib/edu.mjs.

import { env } from './harness.mjs';
import { field } from './edu.mjs';

export const KU = {
  page: (p) => `${env.APP_PREFIX}/${env.COOPNAME}/ku/${p}`,
  // Те же имена, что в засеве (components/api-tests/src/seed/ku).
  FOUNDER: 'sokolov',
  JOINER: 'popova',
  APPLICANT: 'zakharova',
  BRANCH_NAME: 'Звенигородский',
  BRANCH_ADDRESS: 'Московская область, г. Звенигород, ул. Московская, д. 12',
  BRANCH_EMAIL: 'zvenigorod@voskhod.coop',
  BRANCH_PHONE: '+7 916 000-12-12',
  MEET_PLACE: 'Звенигород, ул. Московская, д. 12, зал собраний',
};

/**
 * Окно «Паспортные данные»: договор о полной материальной ответственности
 * требует паспорт пайщика. Окно открывается один раз — данные сохраняются в
 * профиле. Возвращает true, если окно было и заполнено.
 */
export async function fillPassportIfAsked(page, { shot, name, description, timeout = 8000 } = {}) {
  const dialog = page.locator('.q-dialog:has-text("Паспортные данные")').last();
  if (!(await dialog.waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false))) return false;
  const typeIn = async (label, value) => {
    const f = dialog.locator(`label:has-text("${label}")`).locator('input').first();
    await f.click();
    await f.fill('');
    await f.pressSequentially(value, { delay: 20 });
  };
  await typeIn('Серия паспорта', '4612');
  await typeIn('Номер паспорта', '345678');
  await typeIn('Кем выдан', 'ГУ МВД России по Московской области');
  await dialog.locator('label:has-text("Дата выдачи") input').first().fill('2015-06-18');
  await typeIn('Код подразделения', '500101');
  await page.waitForTimeout(400);
  if (shot && name) await shot(page, name, description);
  await dialog.locator('button:has-text("Сохранить и продолжить")').click();
  await dialog.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1200);
  return true;
}

/** Дата и время через неделю в формате поля datetime-local. */
export function nextWeekAt(hour = 18) {
  const d = new Date(Date.now() + 7 * 24 * 3600_000);
  d.setHours(hour, 0, 0, 0);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:00`;
}

export { field };
