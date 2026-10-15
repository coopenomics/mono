// Сценарий: Удостоверение.
// eslint-disable-next-line no-unused-vars
import { memberPage, USER, COOP_PAGE } from '../../lib/participant.mjs';
const s = memberPage({ doc: 'profile', title: 'Удостоверение', url: USER('profile'),
  description: 'Удостоверение пайщика: фотография, ФИО, номер в реестре, дата вступления и участок.',
  rowDescription: null });
export const meta = s.meta;
export default s.run;
