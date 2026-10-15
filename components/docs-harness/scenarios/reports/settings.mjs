// Сценарий: Реквизиты отчётности.
import { reportPage } from '../../lib/reports.mjs';
const s = reportPage({ doc: 'settings', p: 'settings', title: 'Реквизиты отчётности',
  description: 'Реквизиты отчётности: данные кооператива и подписанта для форм — коды налоговой, ОКТМО, ИНН подписанта.',
  rowDescription: null });
export const meta = {
  ...s.meta,
  fixtures: ['ivanpetrov'],
};
export default s.run;
