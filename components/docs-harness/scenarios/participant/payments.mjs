// Сценарий: Платежи.
// eslint-disable-next-line no-unused-vars
import { memberPage, USER, COOP_PAGE } from '../../lib/participant.mjs';
const s = memberPage({ doc: 'payments', title: 'Платежи', url: USER('payments'),
  description: 'Платежи пайщика: взносы, возвраты и выплаты с суммой, направлением и состоянием.',
  rowDescription: 'Платёж целиком: назначение, сумма и реквизиты.' });
export const meta = s.meta;
export default s.run;
