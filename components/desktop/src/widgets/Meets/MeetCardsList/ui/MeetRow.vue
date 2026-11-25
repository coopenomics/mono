<template lang="pug">
//- Строка собрания по образцу строки заказа (OrderCard, layout="row").
//- Зоны: опознание — «что это и когда», явка — «сколько проголосовало»,
//- состояние — «на каком шаге и что дальше». Нажатие по строке открывает собрание.
.meet-row(
  role='button',
  tabindex='0',
  @click='$emit("navigate")',
  @keydown.enter.prevent='$emit("navigate")',
  @keydown.space.prevent='$emit("navigate")'
)
  .meet-row__ident
    .meet-row__title {{ $t('meet.statusView.title', { number }) }}
    .meet-row__meta {{ datesLine }}
    .meet-row__meta(v-if='kindLine') {{ kindLine }}

  .meet-row__turnout(v-if='turnout')
    .meet-row__turnout-value {{ turnout.percent }}%
    .meet-row__turnout-label {{ $t('meet.statusView.turnoutLabel') }}

  .meet-row__state(v-if='status')
    BaseBadge(:variant='status.variant') {{ status.label }}
    .meet-row__note(v-if='status.detail') {{ status.detail }}
    .meet-row__note.meet-row__note--voted(v-if='voted')
      q-icon(name='how_to_vote', size='14px')
      span {{ $t('meet.statusView.youVoted') }}

  q-icon.meet-row__chevron(name='chevron_right', size='20px')
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { BaseBadge } from 'src/shared/ui/base';
import {
  meetDatesLine,
  meetKindLine,
  meetNumber,
  meetStatusView,
  meetTurnout,
  type IMeet,
} from 'src/entities/Meet';

const props = defineProps<{ meet: IMeet }>();
defineEmits<{ navigate: [] }>();

const S = Zeus.ExtendedMeetStatus;
// До открытия голосования явки нет — зона пустует, а не показывает 0%.
const BEFORE_VOTING: string[] = [S.NONE, S.CREATED, S.AUTHORIZED, S.WAITING_FOR_OPENING, S.ONRESTART];

const number = computed(() => meetNumber(props.meet) ?? '—');
const datesLine = computed(() => meetDatesLine(props.meet));
const kindLine = computed(() => meetKindLine(props.meet));
const status = computed(() => meetStatusView(props.meet));
const turnout = computed(() =>
  BEFORE_VOTING.includes(props.meet.processing?.extendedStatus ?? S.NONE) ? null : meetTurnout(props.meet),
);
const voted = computed(() => Boolean(props.meet.processing?.isVoted));
</script>

<style lang="scss" scoped>
.meet-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(200px, auto) auto;
  grid-template-areas: 'ident turnout state chevron';
  column-gap: var(--p-6, 24px);
  align-items: center;
  padding: var(--p-4, 16px) var(--p-5, 20px);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
  cursor: pointer;
  transition: border-color var(--p-dur-fast, 120ms) var(--p-ease-standard);

  &:hover {
    border-color: var(--p-ink-3);
  }

  &:focus-visible {
    outline: none;
    border-color: var(--p-line-1);
    box-shadow: inset var(--p-focus-ring);
  }

  &__ident {
    grid-area: ident;
    min-width: 0;
  }

  &__title {
    font-size: var(--p-fs-h3, 15px);
    font-weight: 600;
    line-height: var(--p-lh-h3, 1.3);
    color: var(--p-ink);
  }

  &__meta {
    margin-top: 2px;
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
  }

  &__turnout {
    grid-area: turnout;
    text-align: right;
  }

  &__turnout-value {
    font-size: var(--p-fs-h2, 18px);
    font-weight: 700;
    color: var(--p-ink);
    font-variant-numeric: tabular-nums;
  }

  &__turnout-label {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
  }

  &__state {
    grid-area: state;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--p-1, 4px);
    text-align: right;
  }

  &__note {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
  }

  &__note--voted {
    display: inline-flex;
    align-items: center;
    gap: var(--p-1, 4px);
    color: var(--p-pos);
  }

  &__chevron {
    grid-area: chevron;
    color: var(--p-ink-3);
  }

  // Узкий экран: те же зоны в два яруса — опознание сверху, явка и состояние под ним.
  @media (max-width: 600px) {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'ident chevron'
      'state turnout';
    row-gap: var(--p-3, 12px);
    column-gap: var(--p-4, 16px);
    padding: var(--p-4, 16px);

    &__state {
      align-items: flex-start;
      text-align: left;
    }
  }
}
</style>
