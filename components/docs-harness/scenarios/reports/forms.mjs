// Сценарий: Формы отчётности.
import { reportPage } from '../../lib/reports.mjs';
const s = reportPage({ doc: 'forms', p: 'documents/forms', title: 'Формы отчётности',
  description: 'Формы отчётности кооператива: форма, период, состояние подготовки и отправки.',
  rowDescription: null });
export const meta = s.meta;
export default s.run;
