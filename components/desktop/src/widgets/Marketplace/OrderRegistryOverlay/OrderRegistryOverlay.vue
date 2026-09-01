<template lang="pug">
DetailsDrawer(
  :model-value='overlay.isOpen.value',
  :width='860',
  title='Заказ',
  @update:model-value='(v) => !v && overlay.close()'
)
  template(#actions)
    BaseButton(
      v-if='fullPageRouteName',
      variant='ghost',
      size='sm',
      aria-label='Открыть заказ на отдельной странице',
      @click='openFullPage'
    )
      template(#icon-left)
        q-icon(name='open_in_full', size='16px')
      | Открыть заказ

  OrderRegistryDetail(
    v-if='overlay.value.value',
    :key='overlay.value.value',
    :coopname='coopname',
    :order-id='overlay.value.value',
    :show-offer-link='showOfferLink',
    @offer-click='(id) => emit("offer-click", id)'
  )
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useQueryOverlay } from 'src/shared/lib/navigation';
import { DetailsDrawer } from 'src/shared/ui/domain';
import { BaseButton } from 'src/shared/ui/base';
import { OrderRegistryDetail } from 'src/widgets/Marketplace/OrderRegistryDetail';

/**
 * Заказ реестра — оверлеем поверх реестра (`?order=<id>`, см. useQueryOverlay).
 *
 * Реестр под оверлеем не размонтируется: страница серверной пагинации и
 * фильтр статусов остаются на месте, а администратор смотрит заказы подряд, не
 * возвращаясь каждый раз на первую страницу. Ссылка с открытым заказом
 * пересылается, «назад» закрывает оверлей.
 *
 * Содержимое — тот же OrderRegistryDetail, что на полных страницах столов
 * администратора и ПВЗ: он самодостаточен и грузится по orderId сам.
 */
const props = defineProps<{
  coopname: string;
  /** Ссылка «открыть предложение» — скрыта у ролей без доступа к карточке */
  showOfferLink?: boolean;
  /** Маршрут полной страницы заказа своего стола; без него кнопки нет */
  fullPageRouteName?: string;
}>();

const emit = defineEmits<{
  'offer-click': [offerId: string];
}>();

const overlay = useQueryOverlay('order');
const router = useRouter();

function openFullPage(): void {
  if (!props.fullPageRouteName || !overlay.value.value) return;
  void router.push({
    name: props.fullPageRouteName,
    params: { coopname: props.coopname, orderId: overlay.value.value },
  });
}
</script>
