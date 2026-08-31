<template lang="pug">
.cardcoop-page
  //- Одна подсказка на страницу: зачем эта карта вообще нужна. Человек видит её первый
  //- раз и без объяснения принимает за ещё один пластик кооператива.
  PageHint(storage-key='cardcoop:card:banner-dismissed')
    | Карта пайщика — общая для всей кооперативной сети. Она подтверждает участие в нашем
    | кооперативе и, если вы состоите в других, собирает членства в одном месте. Анкету и
    | документы карта не хранит — они остаются здесь.

  BaseCard(title='Карта пайщика')
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

      .cardcoop-page__actions
        BaseButton(variant='secondary', @click='openCard')
          template(#icon-left)
            q-icon(name='open_in_new', size='18px')
          | Открыть мою карту

    template(v-else)
      EmptyState(
        title='Карта ещё не выпущена',
        body='Выпуск занимает минуту: вы перейдёте в сеть карт и войдёте через свою учётную запись кооператива. Заполнять анкету заново не нужно.'
      )
        template(#icon)
          q-icon(name='badge', size='28px')

      .cardcoop-page__actions
        BaseButton(variant='primary', @click='openCard')
          template(#icon-left)
            q-icon(name='badge', size='18px')
          | Выпустить карту пайщика
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { BaseButton, BaseCard, BaseChip, EmptyState } from 'src/shared/ui/base';
import { DataRow, PageHint } from 'src/shared/ui/domain';
import { cardcoopCardApi, type ICardcoopCard } from 'src/entities/CardcoopCard';
import { formatToHumanDate } from 'src/shared/lib/utils/dates';
import type { BaseChipVariant } from 'src/shared/ui/base/BaseChip/BaseChip.types';

/**
 * Карта пайщика в столе кооператива (story 7.4 / 3B5-32, FR-E4).
 *
 * Главный вход в выпуск карты: человек уже аутентифицирован в кооперативе, и ему остаётся
 * один переход. Состояние берётся из журнала самого кооператива, а не из сети, — стол
 * обязан работать, когда card.coop недоступен (NFR-3).
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

onMounted(async () => {
  try {
    card.value = await cardcoopCardApi.loadMyCard();
  } finally {
    loading.value = false;
  }
});
</script>

<style lang="scss" scoped>
.cardcoop-page {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);

  &__actions {
    display: flex;
    justify-content: flex-end;
    margin-top: var(--p-4);
  }
}
</style>
