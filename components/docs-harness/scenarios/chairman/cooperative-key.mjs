// Сценарий: Ключ кооператива.
import { onePage } from '../../lib/chairman.mjs';
const s = onePage({ feature: 'chairman.settings', title: 'Ключ кооператива', doc: 'cooperative-key', p: 'settings/cooperative-key',
  description: 'Ключ кооператива: приватный ключ подписи транзакций, хранится зашифрованным и после сохранения не показывается.' });
export const meta = s.meta;
export default s.run;
