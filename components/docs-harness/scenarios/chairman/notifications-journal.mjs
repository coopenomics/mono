// Сценарий: журнал уведомлений кооператива.
import { onePage } from '../../lib/chairman.mjs';
const s = onePage({ feature: 'chairman.notifications', title: 'Журнал уведомлений', doc: 'notifications-journal', p: 'notifications-journal',
  description: 'Журнал уведомлений: письма и сообщения пайщикам с адресатом, событием, каналом и состоянием доставки. Недоставленное уведомление отправляется повторно.' });
export const meta = s.meta;
export default s.run;
