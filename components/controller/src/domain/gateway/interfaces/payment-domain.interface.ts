/**
 * Форма платежа живёт в контракте `@coopenomics/innercoop`: расширения заводят
 * платежи и читают их состояние, значит форма общая, а не внутренняя для ядра.
 * Здесь она доступна под привычными ядру именами.
 */
export type {
  InnerPayment as PaymentDomainInterface,
  InnerPaymentDetails as PaymentDetailsDomainInterface,
} from '@coopenomics/innercoop';
