import { registerEnumType } from '@nestjs/graphql';

/**
 * Вид аккаунта в кооперативе — верхнеуровневая классификация субъекта, к
 * которому относится аккаунт. В отличие от AccountType (individual/organization/
 * entrepreneur — форма приватных данных пайщика), AccountKind отвечает на вопрос
 * «кто это»: пайщик, кооперативный участок, сам кооператив или нераспознанный.
 * Нужен потребителям (реестры процессов/заказов/платежей), чтобы единообразно
 * отрисовать субъект — например, пометить кооперативный участок, а не принять
 * его за организацию-пайщика.
 */
export enum AccountKind {
  participant = 'participant',
  branch = 'branch',
  cooperative = 'cooperative',
  unknown = 'unknown',
}

registerEnumType(AccountKind, {
  name: 'AccountKind',
  description: 'Вид аккаунта: пайщик, кооперативный участок, кооператив или нераспознанный',
});
