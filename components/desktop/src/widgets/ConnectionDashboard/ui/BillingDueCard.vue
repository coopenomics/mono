<template lang="pug">
//- Просрочка — не строка в реестре, а состояние всей платформы: пока долг не
//- закрыт, кооператив рискует остаться без сервера. Поэтому сумма и её
//- последствия выносятся наверх страницы, до реестра и кошельков.
BaseCard(v-if="visible" :title="title" :subtitle="subtitle")
  .due-card
    .due-card__amount
      .due-card__amount-value.t-mono.t-num {{ formatPrice(summary.dueTotal) }}
      .due-card__amount-label к оплате сейчас

    ul.due-card__items(v-if="summary.overdue.length")
      li.due-card__item(v-for="sub in summary.overdue" :key="sub.id")
        span {{ sub.subscription_type_name }}
        span.t-mono.t-num {{ formatPrice(sub.price) }}

    //- Что произойдёт после оплаты — главный вопрос, когда обслуживание уже
    //- приостановлено: пайщик должен видеть, что данные никуда не делись.
    p.due-card__note {{ note }}

    .due-card__wallet
      span.due-card__wallet-label На кошельке членских взносов
      span.t-mono.t-num {{ formatPrice(walletAvailable) }}
    p.due-card__hint(v-if="shortfall > 0")
      | Не хватает&nbsp;
      span.t-mono.t-num {{ formatPrice(shortfall) }}
      | . Пополните кошелёк — списание пройдёт автоматически, отдельно
      | подтверждать оплату не нужно.
    p.due-card__hint(v-else)
      | Средств достаточно: списание пройдёт автоматически ближайшим циклом
      | оплаты.

  template(#footer)
    BaseButton(
      variant="primary"
      size="md"
      type="button"
      @click="openConvert"
    )
      q-icon(name="add" size="16px").q-mr-xs
      | Пополнить кошелёк
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { BaseButton, BaseCard } from 'src/shared/ui/base'
import { summarizeSubscriptions, useProviderSubscriptions } from 'src/features/Provider/model'
import { useConnectionAgreementStore } from 'src/entities/ConnectionAgreement'
import { useBillingWallet } from 'src/entities/Wallet/model'
import { useSessionStore } from 'src/entities/Session'
import { useSystemStore } from 'src/entities/System/model'
import { useConvertToBillingVisibility } from 'src/features/Billing/ConvertToBilling'
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits'

const session = useSessionStore()
const system = useSystemStore()
const connection = useConnectionAgreementStore()

// Подписки — общий стейт витрины подключения: их грузит реестр подписок,
// карточка просрочки читает те же данные и не ходит за ними второй раз.
const { subscriptions } = useProviderSubscriptions()

const summary = computed(() => summarizeSubscriptions(subscriptions.value))

const instance = computed(() => connection.currentInstance)
/** Сервер отдан хостеру: платформа поднимется заново из резервной копии. */
const isReleased = computed(() => instance.value?.is_released === true)
/** На домене стоит заглушка «временно недоступен». */
const isSuspended = computed(() => instance.value?.maintenance_mode === true)

const visible = computed(() => summary.value.hasDue || isSuspended.value || isReleased.value)

const title = computed(() =>
  isSuspended.value || isReleased.value ? 'Обслуживание приостановлено' : 'Подписки просрочены',
)

const subtitle = computed(() => {
  if (isReleased.value) return 'Сервер освобождён, данные сохранены в резервной копии'
  if (isSuspended.value) return 'Платформа кооператива закрыта до поступления оплаты'
  return 'Оплата не поступила в срок'
})

const note = computed(() => {
  if (isReleased.value) {
    return (
      'После оплаты провайдер арендует сервер той же конфигурации, установит платформу заново ' +
      'и вернёт данные из последней резервной копии — документы, базы и файлы. ' +
      'Заводить кооператив заново не нужно.'
    )
  }
  if (isSuspended.value) {
    return 'После оплаты заглушка снимается и платформа открывается в прежнем виде — данные на месте.'
  }
  return (
    'Пока оплата не поступила, обслуживание может быть приостановлено: платформа закроется ' +
    'заглушкой, а сервер будет освобождён — с сохранением резервной копии, из которой всё ' +
    'восстановится после оплаты.'
  )
})

const { available, symbol } = useBillingWallet(
  () => system.info.coopname || '',
  () => session.username || '',
)

const fallbackSymbol = computed(() => system.info.symbols?.root_govern_symbol || 'RUB')

const walletAvailable = computed(() => Number(available.value) || 0)

const shortfall = computed(() => Math.max(0, summary.value.dueTotal - walletAvailable.value))

// Та же запись суммы, что в реестре подписок: символ печатает форматтер.
const formatPrice = (price: number | string): string =>
  formatAsset2Digits(`${String(price)} ${symbol.value || fallbackSymbol.value}`)

const { isVisible } = useConvertToBillingVisibility()
const openConvert = () => {
  isVisible.value = true
}
</script>

<style scoped>
.due-card {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}
.due-card__amount {
  display: flex;
  align-items: baseline;
  gap: var(--p-2);
  flex-wrap: wrap;
}
.due-card__amount-value {
  font-size: var(--p-fs-h3);
  line-height: var(--p-lh-h3);
  font-weight: 600;
  color: var(--p-ink);
}
.due-card__amount-label {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-2);
}
.due-card__items {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}
.due-card__item {
  display: flex;
  justify-content: space-between;
  gap: var(--p-3);
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink-2);
}
.due-card__note {
  margin: 0;
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink);
}
.due-card__wallet {
  display: flex;
  justify-content: space-between;
  gap: var(--p-3);
  padding-top: var(--p-2);
  border-top: 1px solid var(--p-line);
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink);
}
.due-card__wallet-label {
  color: var(--p-ink-2);
}
.due-card__hint {
  margin: 0;
  font-size: var(--p-fs-meta);
  line-height: var(--p-lh-meta);
  color: var(--p-ink-2);
}
</style>
