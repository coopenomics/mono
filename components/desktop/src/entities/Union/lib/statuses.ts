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
      return 'подключение подтверждено'
    case 'pending':
      return 'ждёт решения совета'
    case 'blocked':
      return 'заблокирован'
    default:
      return status ?? '—'
  }
}

export const registryStatusVariant = (status: string | null | undefined): UnionChipVariant => {
  switch (normalize(status)) {
    case 'active':
      return 'pos'
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
      return 'работает'
    case 'install':
      return 'устанавливается'
    case 'rent':
      return 'арендуем сервер'
    case 'pending':
      return 'в очереди'
    case 'error':
      return 'ошибка'
    case 'blocked':
      return 'заблокирован'
    case 'requires_manual_review':
      return 'нужна проверка'
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
export const subscriptionStatusLabel = (status: string | null | undefined): string => {
  switch (normalize(status)) {
    case 'active':
      return 'активна'
    case 'pending':
      return 'ожидает оплаты'
    case 'cancelled':
    case 'canceled':
      return 'отменена'
    case 'expired':
      return 'истекла'
    default:
      return status ?? '—'
  }
}

export const subscriptionStatusVariant = (status: string | null | undefined): UnionChipVariant => {
  switch (normalize(status)) {
    case 'active':
      return 'pos'
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
