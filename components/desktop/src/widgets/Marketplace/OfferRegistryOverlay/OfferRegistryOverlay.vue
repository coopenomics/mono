<template lang="pug">
DetailsDrawer(
  :model-value='overlay.isOpen.value',
  :width='760',
  title='Предложение',
  @update:model-value='(v) => !v && overlay.close()'
)
  template(#actions)
    //- Полная страница предложения живёт на столе администратора: там, где её
    //- нет (стол ПВЗ), кнопка вела бы в недоступный маршрут.
    BaseButton(
      v-if='showFullPage',
      variant='ghost',
      size='sm',
      aria-label='Открыть предложение на отдельной странице',
      @click='openFullPage'
    )
      template(#icon-left)
        q-icon(name='open_in_full', size='16px')
      | Открыть страницу

  OfferRegistryDetail(
    v-if='overlay.value.value',
    :key='overlay.value.value',
    :offer-id='overlay.value.value',
    :moderatable='moderatable',
    @moderated='() => emit("moderated")'
  )
</template>

<script setup lang="ts">
/**
 * Предложение — оверлеем поверх реестра (`?offer=<id>`, см. useQueryOverlay).
 *
 * Реестр под оверлеем не размонтируется: страница пагинации, фильтры и
 * прокрутка остаются на месте, а председатель смотрит предложения подряд, не
 * возвращаясь каждый раз в начало списка. Ссылка с открытым предложением
 * пересылается, «назад» закрывает оверлей. Тем же оверлеем склад открывает
 * предложение своей позиции — карточка одна на все реестры стола.
 */
import { useRouter } from 'vue-router';
import { useQueryOverlay } from 'src/shared/lib/navigation';
import { DetailsDrawer } from 'src/shared/ui/domain';
import { BaseButton } from 'src/shared/ui/base';
import { OfferRegistryDetail } from 'src/widgets/Marketplace/OfferRegistryDetail';

const props = withDefaults(
  defineProps<{
    coopname: string;
    /** Показывать решения модератора, когда предложение ждёт модерации. */
    moderatable?: boolean;
    /** Откуда открыт оверлей — подпись кнопки «назад» на полной странице. */
    from?: string;
    /** Показывать переход на полную страницу предложения (стол администратора). */
    showFullPage?: boolean;
  }>(),
  { moderatable: false, showFullPage: true },
);

const emit = defineEmits<{
  (e: 'moderated'): void;
}>();

const overlay = useQueryOverlay('offer');
const router = useRouter();

function openFullPage(): void {
  if (!overlay.value.value) return;
  void router.push({
    name: 'marketplace-admin-offer-detail',
    params: { coopname: props.coopname, offerId: overlay.value.value },
    ...(props.from ? { query: { from: props.from } } : {}),
  });
}
</script>
