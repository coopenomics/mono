// Сценарий: Карта кооператора.
// eslint-disable-next-line no-unused-vars
import { memberPage, USER, COOP_PAGE } from '../../lib/participant.mjs';
const s = memberPage({ doc: 'cardcoop', title: 'Карта кооператора', url: USER('cardcoop'),
  description: 'Карта кооператора: подтверждение членства пайщика в сети кооперативной экономики.',
  rowDescription: null });
export const meta = s.meta;
export default s.run;
