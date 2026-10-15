// Сценарий: НДФЛ.
import { reportPage } from '../../lib/reports.mjs';
const s = reportPage({ doc: 'ndfl', p: 'ndfl', title: 'НДФЛ',
  description: 'НДФЛ: удержанный налог по выплатам пайщикам — пайщик, выплата, база, налог и состояние перечисления.',
  rowDescription: null });
export const meta = s.meta;
export default s.run;
