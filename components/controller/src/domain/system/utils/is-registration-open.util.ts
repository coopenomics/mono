import type { AgreementNumberDomainInterface } from '~/domain/agreement/interfaces/agreement-number.interface';
import type { VarsDomainInterface } from '~/domain/system/interfaces/vars-domain.interface';

const REGISTRATION_REQUIRED_AGREEMENT_VARS = [
  'wallet_agreement',
  'signature_agreement',
  'privacy_agreement',
  'user_agreement',
  'participant_application',
] as const satisfies ReadonlyArray<keyof VarsDomainInterface>;

function isAgreementVarFilled(agreement?: AgreementNumberDomainInterface | null): boolean {
  if (!agreement) {
    return false;
  }

  const protocolNumber = agreement.protocol_number?.trim();
  const protocolDate = agreement.protocol_day_month_year?.trim();

  return Boolean(protocolNumber) && Boolean(protocolDate);
}

/**
 * Регистрация пайщиков доступна, когда заполнены реквизиты протоколов
 * базовых соглашений кооператива — без них factory не сгенерирует пакет документов.
 */
export function isRegistrationOpen(vars: VarsDomainInterface | null | undefined): boolean {
  if (!vars) {
    return false;
  }

  return REGISTRATION_REQUIRED_AGREEMENT_VARS.every((field) =>
    isAgreementVarFilled(vars[field] as AgreementNumberDomainInterface | null | undefined)
  );
}
