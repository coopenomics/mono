// Сценарий: Контакты.
// eslint-disable-next-line no-unused-vars
import { memberPage, USER, COOP_PAGE } from '../../lib/participant.mjs';
const s = memberPage({ doc: 'contacts', title: 'Контакты', url: COOP_PAGE('contacts'),
  description: 'Контакты кооператива: наименование, адрес, телефон и почта.',
  rowDescription: null });
export const meta = {
  ...s.meta,
  fixtures: ['ivanpetrov'],
};
export default s.run;
