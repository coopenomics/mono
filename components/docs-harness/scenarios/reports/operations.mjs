// Сценарий: Реестр операций.
import { reportPage } from '../../lib/reports.mjs';
const s = reportPage({ doc: 'operations', p: 'operations', title: 'Реестр операций',
  description: 'Реестр операций: хозяйственные операции кооператива с процессом, суммой, кошельком и датой.',
  rowDescription: 'Операция целиком: проводки по счетам и документ-основание.' });
export const meta = s.meta;
export default s.run;
