// Сценарий: Реестр процессов.
import { reportPage } from '../../lib/reports.mjs';
const s = reportPage({ doc: 'processes', p: 'processes', title: 'Реестр процессов',
  description: 'Реестр процессов: каждый процесс кооператива — вступление, взнос, возврат, расход — с хэшем, участником, состоянием и датой.',
  rowDescription: 'Процесс целиком: его операции, проводки и документы в порядке хода.' });
export const meta = {
  ...s.meta,
  fixtures: ['ivanpetrov'],
};
export default s.run;
