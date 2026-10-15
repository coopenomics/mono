// Сценарий: Настройки.
// eslint-disable-next-line no-unused-vars
import { memberPage, USER, COOP_PAGE } from '../../lib/participant.mjs';
const s = memberPage({ doc: 'settings', title: 'Настройки', url: USER('settings'),
  description: 'Настройки пайщика: пароль входа, уведомления и вид рабочего стола.',
  rowDescription: null });
export const meta = {
  ...s.meta,
  fixtures: ['ivanpetrov'],
};
export default s.run;
