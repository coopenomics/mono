<template lang="pug">
.cardcoop-page
  //- Заголовок и подсказка страницы не дублируются: заголовок уже в шапке, главное
  //- действие («Выпустить карту» / «Открыть карту») тоже там (канон стола).
  BaseCard
    //- Пока состояние едет с сервера, на его месте каркас той же формы: спиннер поверх
    //- содержимого дёргает экран, а «карта не выпущена» на секунду читается как ответ.
    template(v-if='loading')
      DataRow(label='Номер карты')
        template(#value-override)
          q-skeleton(type='text', width='180px')
      DataRow(label='Состояние')
        template(#value-override)
          q-skeleton(type='QChip', width='140px')

    template(v-else-if='card?.issued')
      DataRow(
        v-if='card.cardNumber',
        label='Номер карты',
        :value='formattedNumber',
        mono,
        copyable
      )
      DataRow(label='Состояние')
        template(#value-override)
          BaseChip(:variant='status.variant') {{ status.label }}
      DataRow(
        v-if='card.memberSince',
        label='Участие с',
        :value='formatToHumanDate(card.memberSince)'
      )

    template(v-else)
      EmptyState(
        title='Карта ещё не выпущена',
        body='Карта пайщика одна на всю кооперативную сеть: она подтверждает членство в нашем кооперативе и собирает членства в других. Нажмите «Выпустить карту пайщика» — вы перейдёте в сеть карт и войдёте через кооператив, анкету заново заполнять не нужно.'
      )
        template(#icon)
          q-icon(name='badge', size='28px')
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue';
import { BaseCard, BaseChip, EmptyState } from 'src/shared/ui/base';
import { DataRow } from 'src/shared/ui/domain';
import { useHeaderActions } from 'src/shared/hooks';
import { cardcoopCardApi, type ICardcoopCard } from 'src/entities/CardcoopCard';
import { formatToHumanDate } from 'src/shared/lib/utils/dates';
import type { BaseChipVariant } from 'src/shared/ui/base/BaseChip/BaseChip.types';
import { cardcoopHeaderState } from '../model/header';
import CardcoopHeaderActions from './CardcoopHeaderActions.vue';

/**
 * Карта пайщика в столе кооператива (story 7.4 / 3B5-32, FR-E4).
 *
 * Главный вход в выпуск карты: человек уже аутентифицирован в кооперативе, и ему остаётся
 * один переход. Состояние берётся из журнала самого кооператива, а не из сети, — стол
 * обязан работать, когда card.coop недоступен (NFR-3). Кнопка выпуска/открытия — в шапке
 * страницы (решение владельца 02.09.2026): подсказки и повторного заголовка на странице нет.
 */
const card = ref<ICardcoopCard | null>(null);
const loading = ref(true);

/** Как назвать состояние членства человеку и каким цветом его показать. */
const STATUS: Record<string, { label: string; variant: BaseChipVariant }> = {
  active: { label: 'Членство подтверждено', variant: 'pos' },
  pending: { label: 'Членство подтверждается', variant: 'warn' },
  revoked: { label: 'Членство прекращено', variant: 'neutral' },
  rejected: { label: 'Свидетельство отклонено сетью', variant: 'neg' },
};

const status = computed(
  () => STATUS[card.value?.state ?? ''] ?? { label: 'Состояние неизвестно', variant: 'neutral' as BaseChipVariant }
);

/** Номер показывается четырьмя блоками — так его читают вслух и переписывают. */
const formattedNumber = computed(() => (card.value?.cardNumber ?? '').replace(/(.{4})(?=.)/g, '$1 '));

/**
 * Уводит человека в сеть карт.
 *
 * Один и тот же адрес и для выпуска, и для входа: у кого карты нет — выпустит, у кого есть —
 * попадёт в свой кабинет. Второй адрес означал бы второе место, где можно ошибиться.
 */
const openCard = (): void => {
  if (card.value?.enterUrl) window.open(card.value.enterUrl, '_blank', 'noopener');
};

const { registerAction } = useHeaderActions();

watchEffect(() => {
  cardcoopHeaderState.value = {
    issued: Boolean(card.value?.issued),
    loading: loading.value,
    onOpen: openCard,
  };
});

onMounted(async () => {
  registerAction({ id: 'cardcoop-actions', component: CardcoopHeaderActions, order: 1 });
  try {
    card.value = await cardcoopCardApi.loadMyCard();
  } finally {
    loading.value = false;
  }
});

onBeforeUnmount(() => {
  cardcoopHeaderState.value = null;
});
</script>

<style lang="scss" scoped>
.cardcoop-page {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}
</style>
