// Сценарий: Реквизиты.
// eslint-disable-next-line no-unused-vars
import { memberPage, USER, COOP_PAGE } from '../../lib/participant.mjs';
const s = memberPage({ doc: 'requisites', title: 'Реквизиты', menu: 'Реквизиты',
  description: 'Реквизиты пайщика: способы получения выплат — счёт в банке или номер для системы быстрых платежей.',
  rowDescription: null });
export const meta = {
  ...s.meta,
  fixtures: ['ivanpetrov'],
};
export default s.run;
