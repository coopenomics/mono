// Сценарий: Стартовые страницы.
import { onePage } from '../../lib/chairman.mjs';
const s = onePage({ feature: 'chairman.settings', title: 'Стартовые страницы', doc: 'start-pages', p: 'system-settings',
  description: 'Стартовые страницы: стол и страница, которые открываются по умолчанию. Отдельно для вошедших пайщиков и для гостей.' });
export const meta = s.meta;
export default s.run;
