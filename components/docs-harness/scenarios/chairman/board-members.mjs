// Сценарий: Члены совета.
import { onePage } from '../../lib/chairman.mjs';
const s = onePage({ feature: 'chairman.settings', title: 'Члены совета', doc: 'board-members', p: 'settings/members',
  description: 'Члены совета: позиция, учётное имя и ФИО. Состав совета утверждает общее собрание пайщиков.' });
export const meta = s.meta;
export default s.run;
