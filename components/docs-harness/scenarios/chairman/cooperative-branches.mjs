// Сценарий: Кооперативные участки.
import { onePage } from '../../lib/chairman.mjs';
const s = onePage({ feature: 'chairman.settings', title: 'Кооперативные участки', doc: 'cooperative-branches', p: 'settings/branches',
  description: 'Кооперативные участки с председателями. С трёх участков кооператив переходит на мажоритарную систему управления.' });
export const meta = s.meta;
export default s.run;
