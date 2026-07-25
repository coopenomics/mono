<template lang="pug">
BaseButton(
  v-if='mini',
  variant='ghost',
  size='sm',
  icon-only,
  :loading='loading',
  aria-label='Пересчитать результат',
  @click.stop='handleRefreshSegment'
)
  template(#icon-left)
    q-icon(name='refresh', size='18px')
  q-tooltip(anchor='bottom middle', self='top middle') Пересчитать результат

BaseButton(
  v-else,
  variant='primary',
  :loading='loading',
  @click.stop='handleRefreshSegment'
) Пересчитать результат
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRefreshSegment } from '../model';
import { FailAlert } from 'src/shared/api/alerts';
import type { ISegment } from 'app/extensions/capital/entities/Segment/model';
import { useSystemStore } from 'src/entities/System/model';
import type { IRefreshSegmentProps } from '../model';
import { BaseButton } from 'src/shared/ui/base';

interface Props {
  segment: ISegment;
  /** Компактная иконка для строк списка участников */
  mini?: boolean;
}

const props = defineProps<Props>();
const { info } = useSystemStore();

const refreshProps = computed<IRefreshSegmentProps>(() => ({
  segment: props.segment,
  coopname: info.coopname,
}));

const { refreshSegmentAndUpdateStore, refreshSegmentInput } =
  useRefreshSegment(refreshProps);
const loading = ref(false);

const handleRefreshSegment = async () => {
  loading.value = true;
  try {
    await refreshSegmentAndUpdateStore(refreshSegmentInput.value);
  } catch (error) {
    FailAlert(error);
  } finally {
    loading.value = false;
  }
};
</script>
