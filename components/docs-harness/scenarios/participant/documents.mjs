// Сценарий: Документы.
// eslint-disable-next-line no-unused-vars
import { memberPage, USER, COOP_PAGE } from '../../lib/participant.mjs';
const s = memberPage({ doc: 'documents', title: 'Документы', url: USER('documents'),
  description: 'Документы пайщика: заявления, решения совета и договоры с датой и подписями.',
  rowDescription: 'Документ целиком: текст и подписи.' });
export const meta = s.meta;
export default s.run;
