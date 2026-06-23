<template lang="pug">
.row.items-center.q-gutter-sm(v-if='state')
  BaseButton(
    v-if='state.canJoin',
    variant='primary',
    size='sm',
    :loading='state.busy',
    @click='state.onJoin'
  ) Участвовать
  span(v-if='state.canStart')
    BaseButton(
      variant='primary',
      size='sm',
      :disabled='!state.hasQuorum',
      :loading='state.busy',
      @click='state.onStartOpen'
    ) Открыть голосование
    q-tooltip(v-if='!state.hasQuorum')
      | Для открытия голосования нужно не менее 3 участников собрания.
      | Пока их меньше — собрание можно только отменить.
  BaseButton(
    v-if='state.canClose',
    variant='primary',
    size='sm',
    :loading='state.busy',
    @click='state.onClose'
  ) Завершить и утвердить протокол
  BaseButton(
    v-if='state.canExec',
    variant='primary',
    size='sm',
    :loading='state.busy',
    @click='state.onExec'
  ) Направить в совет
  BaseButton(
    v-if='state.canCancel',
    variant='secondary',
    size='sm',
    :loading='state.busy',
    @click='state.onCancelOpen'
  ) Отменить собрание
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { BaseButton } from 'src/shared/ui/base';
import { kuMeetingHeaderActions } from '../model/header-actions-store';

const state = computed(() => kuMeetingHeaderActions.value);
</script>
