<template lang="pug">
.participant-actions(:class='{ "participant-actions--compact": compact }')
  p.participant-actions__hint.t-sm.t-muted(v-if='!compact') {{ statusLabel }}

  .participant-actions__btns
    //- В строке списка пересчёт доступен всегда, пока доля не получена: пайщик
    //- пересчитывает стоимость в любой момент, а не только в стадии расчёта
    template(v-if='canRefresh')
      RefreshSegmentButton(
        :segment='segment',
        :mini='compact',
        @click.stop,
        @refreshed='emit("updated")'
      )

    template(v-if='segment.status === Zeus.SegmentStatus.READY && segment.has_vote && segment.is_votes_calculated === false')
      CalculateVotesButton(
        :coopname='coopname',
        :project-hash='segment.project_hash',
        :username='segment.username',
        @calculated='emit("updated")'
      )

    template(v-if='segment.username === currentUsername')
      template(v-if='segment.status === Zeus.SegmentStatus.READY && (!segment.has_vote || segment.is_votes_calculated === true)')
        PushResultButton(
          :segment='segment',
          @click.stop,
          @submitted='emit("updated")'
        )

      template(v-if='segment.status === Zeus.SegmentStatus.AUTHORIZED')
        SignActButton(
          :segment='segment',
          :coopname='coopname',
          @click.stop,
          @signed='emit("updated")'
        )

      template(v-if='segment.status === Zeus.SegmentStatus.CONTRIBUTED && !segment.is_completed')
        ConvertSegmentButton(
          @click.stop='showConvertDialog = true'
        )

    template(v-if='isChairman')
      template(v-if='segment.status === Zeus.SegmentStatus.ACT1')
        SignActButtonByChairman(
          :segment='segment',
          :coopname='coopname',
          @click.stop,
          @signed='emit("updated")'
        )

  ConvertSegmentDialog(
    v-model='showConvertDialog',
    :segment='segment',
    @converted='emit("updated")'
  )
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { PushResultButton } from 'app/extensions/capital/features/Result/PushResult/ui';
import { RefreshSegmentButton } from 'app/extensions/capital/features/Project/RefreshSegment/ui';
import { SignActButton, SignActButtonByChairman } from 'app/extensions/capital/features/Result/SignAct/ui';
import { ConvertSegmentButton, ConvertSegmentDialog } from 'app/extensions/capital/features/Project/ConvertSegment/ui';
import { CalculateVotesButton } from 'app/extensions/capital/features/Vote/CalculateVotes/ui';
import type { ISegment } from 'app/extensions/capital/entities/Segment/model';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session/model';
import { Zeus } from '@coopenomics/sdk';
import { getSegmentStatusLabel } from 'app/extensions/capital/shared/lib/segmentStatus';

interface Props {
  segment: ISegment;
  /**
   * Строка списка: текст статуса не дублируется (его несёт бейдж строки),
   * а пересчёт доли показывается компактной кнопкой-иконкой.
   */
  compact?: boolean;
}


const props = defineProps<Props>();

/**
 * Любое совершённое действие меняет долю: список держит собственные строки и
 * без этого сигнала показывал бы прежнюю стоимость и прежний статус.
 */
const emit = defineEmits<{ updated: [] }>();

const { info } = useSystemStore();
const { username, isChairman } = useSessionStore();

// Состояние диалога конвертации
const showConvertDialog = ref(false);

// Получаем coopname из system store
const coopname = computed(() => info.coopname);

// Текущий пользователь
const currentUsername = computed(() => username);

// Текст статуса сегмента
const statusLabel = computed(() => getSegmentStatusLabel(props.segment.status, props.segment.is_completed, props.segment));

const canRefresh = computed(() => {
  if (props.segment.is_completed) return false;
  if (props.compact) {
    return props.segment.status !== Zeus.SegmentStatus.FINALIZED;
  }
  return props.segment.status === Zeus.SegmentStatus.GENERATION;
});

</script>

<style lang="scss" scoped>
.participant-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--p-2);
  max-width: 280px;
}

// В строке списка виджет — не колонка, а продолжение ряда действий
.participant-actions--compact {
  flex-direction: row;
  align-items: center;
  gap: var(--p-1);
  max-width: none;
}

.participant-actions__hint {
  margin: 0;
  text-align: right;
  line-height: 1.35;
}

.participant-actions__btns {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--p-2);
}

@media (max-width: 640px) {
  .participant-actions {
    align-items: stretch;
    max-width: none;
  }

  .participant-actions__hint {
    text-align: left;
  }

  .participant-actions__btns {
    justify-content: flex-start;
  }
}
</style>
