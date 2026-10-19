// Сценарий: Контакты кооператива.
import { onePage } from '../../lib/chairman.mjs';
const s = onePage({ feature: 'chairman.settings', title: 'Контакты кооператива', doc: 'cooperative-contacts', p: 'settings/change-contacts',
  description: 'Контакты кооператива: телефон и почта, которые видят пайщики и гости сайта.' });
export const meta = s.meta;
export default s.run;
