import { registerEnumType } from '@nestjs/graphql';

/** Тип доверенности кооператива. */
export enum KuPowerOfAttorneyType {
  /** Председателю кооперативного участка. */
  BRANCH_TRUSTEE = 'branch_trustee',
  /** Доверенному лицу кооперативного участка. */
  BRANCH_TRUSTED = 'branch_trusted',
}

/** Состояние доверенности на сегодня. */
export enum KuPowerOfAttorneyStatus {
  /** Подписана доверенным лицом, ждёт встречной подписи. */
  PENDING = 'pending',
  /** Подписана обеими сторонами, срок не истёк. */
  ACTIVE = 'active',
  /** Срок истёк. */
  EXPIRED = 'expired',
  /** Встречную подпись не поставили. */
  DECLINED = 'declined',
}

/** Договор о полной материальной ответственности председателя участка. */
export enum KuTrusteeLiabilityStatus {
  NONE = 'none',
  PENDING = 'pending',
  APPROVED = 'approved',
  DECLINED = 'declined',
}

registerEnumType(KuPowerOfAttorneyType, { name: 'KuPowerOfAttorneyType', description: 'Тип доверенности кооператива' });
registerEnumType(KuPowerOfAttorneyStatus, { name: 'KuPowerOfAttorneyStatus', description: 'Состояние доверенности' });
registerEnumType(KuTrusteeLiabilityStatus, {
  name: 'KuTrusteeLiabilityStatus',
  description: 'Состояние договора о полной материальной ответственности председателя участка',
});
