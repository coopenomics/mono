// Сценарий: Кошельки пайщиков.
import { reportPage } from '../../lib/reports.mjs';
const s = reportPage({ doc: 'wallets-participants', p: 'wallets/participants', title: 'Кошельки пайщиков',
  description: 'Кошельки пайщиков: паевые взносы каждого пайщика по программам, доступные и заблокированные средства.',
  rowDescription: null });
export const meta = {
  ...s.meta,
  fixtures: ['ivanpetrov'],
};
export default s.run;
