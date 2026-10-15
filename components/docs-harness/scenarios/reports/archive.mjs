// Сценарий: Архив отчётности.
import { reportPage } from '../../lib/reports.mjs';
const s = reportPage({ doc: 'archive', p: 'documents/archive', title: 'Архив отчётности',
  description: 'Архив отчётности: сданные формы с датой отправки и квитанциями.',
  rowDescription: null });
export const meta = {
  ...s.meta,
  fixtures: ['ivanpetrov'],
};
export default s.run;
