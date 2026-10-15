// Сценарий: онбординг председателя — адаптация кооператива к платформе.
import { onePage } from '../../lib/chairman.mjs';
const s = onePage({ feature: 'chairman.onboarding', title: 'Онбординг', doc: 'onboarding', p: 'connect',
  description: 'Онбординг: шаги адаптации кооператива к платформе — решения совета о положениях и формах документов, вступление в ПК «Восход», импорт пайщиков, общее собрание. Сверху срок адаптации.' });
export const meta = s.meta;
export default s.run;
