// Сценарий: Провайдер платежей.
import { onePage } from '../../lib/chairman.mjs';
const s = onePage({ feature: 'chairman.settings', title: 'Провайдер платежей', doc: 'payment-provider', p: 'settings/payment-provider',
  description: 'Провайдер входящих платежей по умолчанию. Банковский платёж по коду даёт пайщику реквизиты, кассир подтверждает оплату в реестре платежей.' });
export const meta = s.meta;
export default s.run;
