// Сценарий: Фонды кооператива на столе бухгалтера (задача 99D-24).
import { reportPage } from '../../lib/reports.mjs';

const s = reportPage({ doc: 'funds', p: 'funds', title: 'Фонды кооператива',
  description: 'Пять фондов кооператива на кошельках учётной книги: остатки, обороты за период, проценты отчислений фондов накопления.',
  rowDescription: 'Панель фонда: остаток, кошелёк и счёт, вкладки «История» и «О фонде»; председатель совета правит описание и процент.' });

export const meta = {
  ...s.meta,
  fixtures: ['ivanpetrov'],
};

export default s.run;
