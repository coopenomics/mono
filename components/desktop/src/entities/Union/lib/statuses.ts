import { t } from 'src/shared/i18n';
/**
 * Словарь статусов реестра кооперативов — общий для списка и карточки.
 *
 * GraphQL отдаёт enum именем ключа (`PENDING`, `ACTIVE`), а не значением, и
 * раньше каждая страница сравнивала его со строчным `'active'`: сравнение не
 * срабатывало, в чипе оставалась английская подпись, а кнопка «Активировать»
 * показывалась даже у активного кооператива. Поэтому регистр приводим здесь
 * один раз и в одном месте.
 */
export type UnionChipVariant = 'neutral' | 'accent' | 'pos' | 'neg' | 'warn' | 'info'

export type RegistryStatus = 'pending' | 'active' | 'blocked'

const normalize = (status: string | null | undefined): string => (status ?? '').toLowerCase()

export const registryStatus = (status: string | null | undefined): RegistryStatus | '' =>
  normalize(status) as RegistryStatus | ''

export const isRegistryStatus = (
  status: string | null | undefined,
  expected: RegistryStatus,
): boolean => normalize(status) === expected

export const registryStatusLabel = (status: string | null | undefined): string => {
  switch (normalize(status)) {
    case 'active':
      return t('union.registry.status.active')
    case 'pending':
      return t('union.registry.status.pending')
    case 'blocked':
      return t('union.registry.status.blocked')
    default:
      return status ?? '—'
  }
}

export const registryStatusVariant = (status: string | null | undefined): UnionChipVariant => {
  switch (normalize(status)) {
    case 'active':
      return 'pos'
    case 'trial':
      return 'info'
    case 'pending':
      return 'warn'
    case 'blocked':
      return 'neg'
    default:
      return 'neutral'
  }
}

export const instanceStatusLabel = (status: string | null | undefined): string => {
  switch (normalize(status)) {
    case 'active':
      return t('union.instance.status.active')
    case 'install':
      return t('union.instance.status.install')
    case 'rent':
      return t('union.instance.status.rent')
    case 'pending':
      return t('union.instance.status.pending')
    case 'error':
      return t('union.instance.status.error')
    case 'blocked':
      return t('union.instance.status.blocked')
    case 'requires_manual_review':
      return t('union.instance.status.requiresManualReview')
    default:
      return status ?? '—'
  }
}

export const instanceStatusVariant = (status: string | null | undefined): UnionChipVariant => {
  switch (normalize(status)) {
    case 'active':
      return 'pos'
    case 'install':
    case 'rent':
    case 'pending':
      return 'warn'
    case 'error':
    case 'blocked':
    case 'requires_manual_review':
      return 'neg'
    default:
      return 'neutral'
  }
}

/** Статус подписки провайдера — тот же словарь, что у инстанса, плюс отмена. */
/**
 * Подпись состояния подписки. Для неоплаченной подписки провайдер отдаёт
 * EXPIRED; пайщику это «не оплачена», а если кончился пробный период —
 * «пробный период закончился» (второй аргумент).
 */
export const subscriptionStatusLabel = (status: string | null | undefined, isTrial = false): string => {
  if (normalize(status) === 'expired' && isTrial) return t('union.subscription.status.trialEnded')
  switch (normalize(status)) {
    case 'active':
      return t('union.subscription.status.active')
    // Пробный период провайдер отдаёт отдельным статусом (SubscriptionStatus.TRIAL),
    // и без своей ветки он доезжал до совета сырым «TRIAL».
    case 'trial':
      return t('union.subscription.status.trial')
    case 'pending':
      return t('union.subscription.status.pending')
    case 'cancelled':
    case 'canceled':
      return t('union.subscription.status.cancelled')
    case 'expired':
      return t('union.subscription.status.expired')
    default:
      return status ?? '—'
  }
}

export const subscriptionStatusVariant = (status: string | null | undefined): UnionChipVariant => {
  switch (normalize(status)) {
    case 'active':
      return 'pos'
    case 'trial':
      return 'info'
    case 'pending':
      return 'warn'
    case 'cancelled':
    case 'canceled':
    case 'expired':
      return 'neg'
    default:
      return 'neutral'
  }
}

/**
 * Состояние списания из журнала биллинга хаба.
 *
 * SUBMITTING/SUBMITTED — попытка в пути: транзакция отправлена, но провайдер
 * ещё не подтвердил счёт оплаченным. Совет должен отличать их от CONFIRMED,
 * иначе зависшее списание читается как успешная оплата.
 */
/**
 * Попытка списания «зависла»: отправка началась, но исход неизвестен и
 * автоповтора у неё нет — нужна сверка с цепью. Показывать такую строку как
 * «отправляется» нельзя: пайщик возвращается на страницу через час и видит всё
 * тот же вечный процесс (@ant 2026-08-27).
 */
const isStalledAttempt = (status: string | null | undefined, hasError: boolean): boolean =>
  hasError && normalize(status) === 'submitting'

export const paymentStatusLabel = (status: string | null | undefined, hasError = false): string => {
  if (isStalledAttempt(status, hasError)) return t('union.payment.status.stalled')
  switch (normalize(status)) {
    case 'confirmed':
      return t('union.payment.status.confirmed')
    case 'submitted':
      return t('union.payment.status.submitted')
    case 'submitting':
      return t('union.payment.status.submitting')
    case 'failed':
      return t('union.payment.status.failed')
    default:
      return status ?? '—'
  }
}

export const paymentStatusVariant = (
  status: string | null | undefined,
  hasError = false,
): UnionChipVariant => {
  if (isStalledAttempt(status, hasError)) return 'neg'
  switch (normalize(status)) {
    case 'confirmed':
      return 'pos'
    case 'submitted':
      return 'info'
    case 'submitting':
      return 'warn'
    case 'failed':
      return 'neg'
    default:
      return 'neutral'
  }
}
