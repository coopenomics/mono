// Сценарий: Кошельки кооператива.
import { reportPage } from '../../lib/reports.mjs';
const s = reportPage({ doc: 'wallets-coop', p: 'wallets/coop', title: 'Кошельки кооператива',
  description: 'Кошельки кооператива: паевой фонд, фонды и кошельки программ с остатками.',
  rowDescription: null });
export const meta = {
  ...s.meta,
  fixtures: ['ivanpetrov'],
};
export default s.run;
