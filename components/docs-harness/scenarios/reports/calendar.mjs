// Сценарий: Календарь отчётности.
import { reportPage } from '../../lib/reports.mjs';
const s = reportPage({ doc: 'calendar', p: 'documents/calendar', title: 'Календарь отчётности',
  description: 'Календарь отчётности: сроки сдачи форм в налоговую и фонды, ближайшие и просроченные.',
  rowDescription: null });
export const meta = {
  ...s.meta,
  fixtures: ['ivanpetrov'],
};
export default s.run;
