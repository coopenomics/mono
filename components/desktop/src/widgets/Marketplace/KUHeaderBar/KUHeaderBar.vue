<template lang="pug">
.mp-ku-bar(role="region", aria-label="Текущий пункт выдачи")
  .mp-ku-bar__info
    q-icon(name="location_on", size="20px", :color="cartStore.currentBraname ? 'primary' : 'warning'")
    template(v-if="cartStore.currentBraname")
      span.mp-ku-bar__label Пункт выдачи:
      span.mp-ku-bar__name {{ pointLabel }}
    template(v-else)
      span.mp-ku-bar__label.text-warning Пункт выдачи не выбран
  BaseButton(
    v-if="multipleAvailable || !cartStore.currentBraname",
    variant="secondary",
    size="sm",
    @click="openDialog"
  ) {{ cartStore.currentBraname ? 'Сменить' : 'Выбрать пункт' }}

  BaseDialog(
    v-model="dialogOpen",
    title="Пункт выдачи (КУ)",
    maximized,
    :close-on-backdrop="!saving"
  )
    template(#default)
      .mp-ku-bar__hint Выберите кооперативный участок — каталог покажет товары, которые возят на него. При смене участка позиции корзины, которых нет на новом участке, станут недоступны для оформления.
      KUSelector(v-model="picked", :coopname="coopname", map-min-height="calc(100vh - 240px)")
    template(#footer)
      BaseButton(variant="ghost", :disabled="saving", @click="dialogOpen = false") Отмена
      BaseButton(
        variant="primary",
        :disabled="!picked || picked === cartStore.currentBraname",
        :loading="saving",
        @click="apply"
      ) Применить
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { BaseButton, BaseDialog } from 'src/shared/ui/base'
import { KUSelector } from 'src/widgets/Marketplace/KUSelector'
import { useMarketplaceKUDetailsStore } from 'src/entities/MarketplaceKUDetails'
import { useMarketplaceCartStore } from 'src/entities/MarketplaceCart'

/**
 * Эпик 16 / Story 16.4: шапка стола с текущим КУ заказчика + смена КУ.
 *
 * Показывает выбранный пункт выдачи; кнопка «Сменить» открывает диалог с
 * выбором КУ (список + карта). Смена пишется в корзину (setCartDeliveryPoint)
 * и эмитит `changed`, чтобы родитель перезагрузил витрину под новый КУ.
 * Кнопка смены показывается, только если активных КУ больше одного (иначе
 * менять не на что) — либо если КУ ещё не выбран вовсе.
 */
const props = defineProps<{ coopname: string }>()

const emit = defineEmits<{ (e: 'changed', braname: string): void }>()

const cartStore = useMarketplaceCartStore()
const kuStore = useMarketplaceKUDetailsStore()

const dialogOpen = ref(false)
const picked = ref<string | null>(null)
const saving = ref(false)

const multipleAvailable = computed(
  () => kuStore.details.filter((d) => d.status !== 'INACTIVE').length > 1,
)

// Человеческое имя текущего КУ: резолвим по braname из загруженных деталей
// (cart.delivery_point_name бэкенд пока не заполняет). braname пользователю
// не показываем НИКОГДА — в крайнем случае нейтральная подпись.
const pointLabel = computed<string>(() => {
  const current = cartStore.currentBraname
  if (!current) return ''
  const detail = kuStore.details.find((d) => d.coreBraname === current)
  return detail?.name || detail?.addressFull || cartStore.currentPointName || 'Пункт выдачи'
})

function openDialog(): void {
  picked.value = cartStore.currentBraname
  dialogOpen.value = true
}

async function apply(): Promise<void> {
  if (!picked.value) return
  saving.value = true
  try {
    await cartStore.changeDeliveryPoint(picked.value)
    SuccessAlert('Пункт выдачи обновлён')
    dialogOpen.value = false
    emit('changed', picked.value)
  } catch (e) {
    FailAlert(e)
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  // Грузим КУ-детали для имени текущего пункта и корректного multipleAvailable
  // (показывать «Сменить», только если активных участков больше одного).
  if (kuStore.details.length || !props.coopname) return
  try {
    await kuStore.load({ coopname: props.coopname, onlyActive: true })
  } catch {
    // Без деталей шапка покажет нейтральную подпись; смена откроется по запросу.
  }
})
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

  &__info {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
    flex: 1;
    min-width: 0;
  }

  &__label {
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm);
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

  &__hint {
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-2);
    margin-bottom: var(--p-3, 12px);
  }
}
</style>
