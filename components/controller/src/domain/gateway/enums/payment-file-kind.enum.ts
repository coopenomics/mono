import { registerEnumType } from '@nestjs/graphql';

/**
 * Назначение файла, приложенного к платежу (бакет `gateway:files`).
 *
 * Ядровая «культура денег»: каждый ИСХОДЯЩИЙ платёж сопровождается чеком об
 * оплате (подтверждающий документ — для кассира «чем оплатил», для пайщика «на
 * что»). Сейчас единственный вид — PAYMENT_PROOF; enum оставлен расширяемым.
 */
export enum PaymentFileKind {
  PAYMENT_PROOF = 'PAYMENT_PROOF',
}

registerEnumType(PaymentFileKind, {
  name: 'PaymentFileKind',
  description: 'Тип файла, приложенного к платежу.',
  valuesMap: {
    PAYMENT_PROOF: { description: 'Чек об оплате — подтверждающий документ по исполненному платежу.' },
  },
});
