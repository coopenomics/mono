<template lang="pug">
//- Вся плашка — кнопка: нажатие открывает окно пункта выдачи (замечание
//- владельца 19.11.2026: отдельная кнопка «Сменить» убрана). Под названием —
//- адрес и режим работы: иначе заказчик видел время работы только при выборе.
.mp-ku-bar(
  role="button",
  tabindex="0",
  :aria-label="$t('marketplace.kuHeaderBar.ariaLabel')",
  @click="openDialog",
  @keydown.enter.prevent="openDialog",
  @keydown.space.prevent="openDialog"
)
  q-icon.mp-ku-bar__icon(name="location_on", size="20px", :color="cartStore.currentBraname ? 'primary' : 'warning'")
  .mp-ku-bar__info(v-if="cartStore.currentBraname")
    .mp-ku-bar__title
      span.mp-ku-bar__label {{ $t('marketplace.kuHeaderBar.label') }}
      span.mp-ku-bar__name {{ pointLabel }}
    .mp-ku-bar__meta(v-if="pointMeta") {{ pointMeta }}
  .mp-ku-bar__info(v-else)
    span.mp-ku-bar__label.text-warning {{ $t('marketplace.kuHeaderBar.notSelectedLabel') }}
  q-icon.mp-ku-bar__chevron(name="chevron_right", size="20px")

  BaseDialog(
    v-model="dialogOpen",
    maximized,
    canvas,
    :close-on-backdrop="!saving"
  )
    template(#head)
      .mp-ku-bar__dialog-head
        .mp-ku-bar__dialog-icon
          q-icon(name="location_on", size="22px")
        .mp-ku-bar__dialog-text
          .mp-ku-bar__dialog-title {{ $t('marketplace.kuHeaderBar.dialogTitle') }}
          .mp-ku-bar__dialog-hint {{ $t('marketplace.kuHeaderBar.dialogHint') }}
    template(#default)
      BaseCard.mp-ku-bar__picker
        KUSelector(v-model="picked", :coopname="coopname", map-min-height="calc(100vh - 280px)")
    template(#footer)
      BaseButton(variant="ghost", :disabled="saving", @click="dialogOpen = false") {{ $t('common.action.cancel') }}
      BaseButton(
        variant="primary",
        :disabled="!picked",
        :loading="saving",
        @click="apply"
      ) {{ $t('marketplace.kuHeaderBar.applyButton') }}
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useLiveReload } from 'src/shared/lib/realtime'
import { marketLiveTables } from 'src/shared/lib/marketplace'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { BaseButton, BaseCard, BaseDialog } from 'src/shared/ui/base'
import { KUSelector } from 'src/widgets/Marketplace/KUSelector'
import { formatWorkingHours, useMarketplaceKUDetailsStore } from 'src/entities/MarketplaceKUDetails'
import { useMarketplaceCartStore } from 'src/entities/MarketplaceCart'
import { t } from 'src/shared/i18n';

/**
 * Эпик 16 / Story 16.4: шапка стола с текущим КУ заказчика + смена КУ.
 *
 * Показывает выбранный пункт выдачи с адресом и режимом работы; нажатие на
 * плашку открывает окно с участками (список + карта). Смена пишется в корзину
 * (setCartDeliveryPoint) и эмитит `changed`, чтобы родитель перезагрузил
 * витрину под новый КУ. «Применить» доступна всегда: тот же участок просто
 * закрывает окно.
 */
const props = defineProps<{ coopname: string }>()

const emit = defineEmits<{ (e: 'changed', braname: string): void }>()

const cartStore = useMarketplaceCartStore()
const kuStore = useMarketplaceKUDetailsStore()

const dialogOpen = ref(false)
const picked = ref<string | null>(null)
const saving = ref(false)

// Человеческое имя текущего КУ: резолвим по braname из загруженных деталей
// (cart.delivery_point_name бэкенд пока не заполняет). braname пользователю
// не показываем НИКОГДА — в крайнем случае нейтральная подпись.
const pointLabel = computed<string>(() => {
  const current = cartStore.currentBraname
  if (!current) return ''
  const detail = kuStore.details.find((d) => d.coreBraname === current)
  return detail?.name || detail?.addressFull || cartStore.currentPointName || t('marketplace.kuHeaderBar.branchWordLabel')
})

/** Адрес и режим работы текущего участка одной строкой: «Москва · Пн–Пт 09:00–18:00; Сб выходной». */
const pointMeta = computed<string>(() => {
  const detail = kuStore.details.find((d) => d.coreBraname === cartStore.currentBraname)
  if (!detail) return ''
  const hours = formatWorkingHours(detail.workingHours).join('; ')
  return [detail.name ? detail.addressFull : null, hours].filter(Boolean).join(' · ')
})

function openDialog(): void {
  picked.value = cartStore.currentBraname
  dialogOpen.value = true
}

async function apply(): Promise<void> {
  if (!picked.value) return
  // Тот же участок — окно просто закрывается: «Применить» всегда доступна
  // (замечание владельца 19.11.2026), менять в корзине нечего.
  if (picked.value === cartStore.currentBraname) {
    dialogOpen.value = false
    return
  }
  saving.value = true
  try {
    await cartStore.changeDeliveryPoint(picked.value)
    SuccessAlert(t('marketplace.kuHeaderBar.updatedMessage'))
    dialogOpen.value = false
    emit('changed', picked.value)
  } catch (e) {
    FailAlert(e)
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  // КУ-детали — для имени, адреса и режима работы текущего пункта.
  if (kuStore.details.length || !props.coopname) return
  try {
    await kuStore.load({ coopname: props.coopname, onlyActive: true })
  } catch {
    // Без деталей шапка покажет нейтральную подпись; смена откроется по запросу.
  }
})

// Пункты выдачи живут по ленте: новый, закрытый или переименованный участок
// сразу меняет подпись и режим работы в плашке.
useLiveReload(marketLiveTables('ku'), () => kuStore.load({ coopname: props.coopname, onlyActive: true }))
</script>

<style scoped lang="scss">
.mp-ku-bar {
  display: flex;
  align-items: center;
  gap: var(--p-3, 12px);
  padding: var(--p-3, 12px) var(--p-4, 16px);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
  background: var(--p-surface);
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;

  &:hover {
    background: var(--p-surface-2);
    border-color: var(--p-line-2);
  }

  &:focus-visible {
    outline: 2px solid var(--p-primary);
    outline-offset: 2px;
  }

  &__icon {
    flex-shrink: 0;
  }

  &__info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  &__title {
    display: flex;
    align-items: baseline;
    gap: var(--p-2, 8px);
    min-width: 0;
  }

  &__label {
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm);
    flex-shrink: 0;
  }

  &__name {
    // Явный размер — НЕ наследуем от страницы, иначе на Каталоге и в Корзине
    // (разный базовый контекст) имя ПВЗ рендерится разной величиной.
    font-size: var(--p-fs-body, 14px);
    font-weight: 600;
    color: var(--p-ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__meta {
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-3);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__chevron {
    flex-shrink: 0;
    color: var(--p-ink-3);
  }

  // ── Окно пункта выдачи ──
  &__dialog-head {
    display: flex;
    align-items: center;
    gap: var(--p-3, 12px);
    min-width: 0;
  }

  &__dialog-icon {
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    border-radius: var(--p-r-md, 12px);
    background: var(--p-primary-soft);
    color: var(--p-primary);
  }

  &__dialog-text {
    min-width: 0;
  }

  &__dialog-title {
    font-size: var(--p-fs-h3);
    font-weight: 600;
    color: var(--p-ink);
  }

  &__dialog-hint {
    font-size: var(--p-fs-body-sm);
    font-weight: 400;
    color: var(--p-ink-2);
    white-space: normal;
  }

  &__picker {
    cursor: default;
  }
}
</style>
