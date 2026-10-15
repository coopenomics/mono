// Сценарий: Реестр проводок.
import { reportPage } from '../../lib/reports.mjs';
const s = reportPage({ doc: 'postings', p: 'postings', title: 'Реестр проводок',
  description: 'Реестр проводок: двойная запись по плану счетов кооператива — дебет, кредит, сумма, операция.',
  rowDescription: null });
export const meta = {
  ...s.meta,
  fixtures: ['ivanpetrov'],
};
export default s.run;
