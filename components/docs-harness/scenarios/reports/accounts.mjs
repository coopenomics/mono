// Сценарий: Реестр счетов.
import { reportPage } from '../../lib/reports.mjs';
const s = reportPage({ doc: 'accounts', p: 'accounts', title: 'Реестр счетов',
  description: 'Реестр счетов: план счетов кооператива с оборотами и сальдо.',
  rowDescription: null });
export const meta = s.meta;
export default s.run;
