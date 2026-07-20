import type { PaymentMethodDomainEntity } from '~/domain/payment-method/entities/method-domain.entity';
import type {
  SBPDataDomainInterface,
  BankTransferDataDomainInterface,
} from '~/domain/payment-method/interfaces/payment-methods-domain.interface';

/**
 * Полная строка реквизитов платёжного метода — для документов (СЗ в совет,
 * поручение бухгалтеру). Сокращённое представление для UI делает фронт.
 */
export function formatPaymentMethodRequisites(method: PaymentMethodDomainEntity): string {
  if (method.method_type === 'sbp') {
    const data = method.data as SBPDataDomainInterface;
    return `СБП, телефон ${data.phone}`;
  }

  const data = method.data as BankTransferDataDomainInterface;
  const parts = [`Банковский перевод: счёт ${data.account_number}`];
  if (data.bank_name) parts.push(data.bank_name);
  if (data.details?.bik) parts.push(`БИК ${data.details.bik}`);
  if (data.details?.corr) parts.push(`к/с ${data.details.corr}`);
  if (data.card_number) parts.push(`карта ${data.card_number}`);
  return parts.join(', ');
}
