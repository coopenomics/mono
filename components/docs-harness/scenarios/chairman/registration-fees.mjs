// Сценарий: Регистрационные взносы.
import { onePage } from '../../lib/chairman.mjs';
const s = onePage({ feature: 'chairman.settings', title: 'Регистрационные взносы', doc: 'registration-fees', p: 'settings/initial-contributions',
  description: 'Регистрационные взносы: вступительный и минимальный паевой взнос для физических лиц и ИП и для юридических лиц.' });
export const meta = s.meta;
export default s.run;
